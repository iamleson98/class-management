#!/usr/bin/env bash
# Deploy (or update) the LMS stack to the Docker Swarm.
#
# Run on the Swarm manager (or over DOCKER_HOST=ssh://...):
#   ./deploy.sh                       # uses .env (TAG=... selects images)
#   TAG=sha-1a2b3c4 ./deploy.sh       # deploy an immutable CI build
#
# What it does:
#   1. validates .env (required vars present, secrets exist)
#   2. logs in to GHCR when credentials are available (private packages)
#   3. docker stack deploy --with-registry-auth (propagates registry auth to
#      worker nodes so they can pull)
#   4. waits for the rollout to converge
#   5. smoke-tests the public endpoints
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_NAME="${STACK_NAME:-lms}"

# Environment variables take precedence over .env (so CI / rollback.sh can
# pin TAG without editing the file): remember what the caller set, source
# .env, then restore.
CALLER_TAG="${TAG:-}"
CALLER_RTCD_TAG="${RTCD_TAG:-}"

if [ -f "$HERE/.env" ]; then
    set -a; . "$HERE/.env"; set +a
fi

[ -n "$CALLER_TAG" ] && TAG="$CALLER_TAG"
[ -n "$CALLER_RTCD_TAG" ] && RTCD_TAG="$CALLER_RTCD_TAG"

# ── 1. Validate configuration ──────────────────────────────────────────
fail=0
require_var() {
    if [ -z "${!1:-}" ]; then
        echo "!! .env: required variable $1 is not set (see .env.example)" >&2
        fail=1
    fi
}
require_var DOMAIN
require_var ACME_EMAIL
require_var TRAEFIK_AUTH
require_var TAG
require_var RTCD_ICE_HOST_OVERRIDE
[ "$fail" -eq 0 ] || exit 1

# Secrets must exist before the stack can deploy (stack.yml marks them
# external). secrets-bootstrap.sh creates them.
for s in db_password db_dsn rustfs_access_key rustfs_secret_key grafana_admin_password; do
    if ! docker secret inspect "$s" >/dev/null 2>&1; then
        echo "!! Docker secret '$s' is missing — run ./secrets-bootstrap.sh first" >&2
        exit 1
    fi
done

# The config sources referenced by stack.yml must resolve relative to $HERE
# (docker stack deploy resolves config `file:` paths relative to the compose
# file's directory).
for f in "$HERE/configs/prometheus.yml" \
         "$HERE/../../observability/grafana/provisioning/datasources/prometheus.yml" \
         "$HERE/../../observability/grafana/provisioning/dashboards/dashboards.yml"; do
    if [ ! -f "$f" ]; then
        echo "!! Missing config source: $f" >&2
        exit 1
    fi
done

# ── 1b. Immutable-config drift cleanup ─────────────────────────────────
# Docker configs cannot be updated in place ("only updates to Labels are
# allowed"): a stack deploy whose config content differs from the version
# already on the node aborts. This bit us when a partial/manual earlier run
# left stale observability configs behind. Compare each stack config with
# the bundle's file and remove it when it differs — docker config rm is
# REFUSED while any running task still mounts the config, so this can never
# pull a live config out from under a service.
# NOTE: this list must mirror the `configs:` section of stack.yml.
STACK_CONFIGS=(
    "prometheus_config|$HERE/configs/prometheus.yml"
    "prometheus_rules|$HERE/../../observability/prometheus-rules.yml"
    "grafana_datasource|$HERE/../../observability/grafana/provisioning/datasources/prometheus.yml"
    "grafana_dashboards_provider|$HERE/../../observability/grafana/provisioning/dashboards/dashboards.yml"
    "grafana_alerts|$HERE/../../observability/grafana/provisioning/alerting/alerts.yml"
    "grafana_dash_overview|$HERE/../../observability/grafana/dashboards/lms-overview.json"
    "grafana_dash_system|$HERE/../../observability/grafana/dashboards/lms-system.json"
    "grafana_dash_containers|$HERE/../../observability/grafana/dashboards/lms-containers.json"
    "grafana_dash_api|$HERE/../../observability/grafana/dashboards/lms-http-api.json"
    "grafana_dash_chat|$HERE/../../observability/grafana/dashboards/lms-chat-ws.json"
    "grafana_dash_uploads|$HERE/../../observability/grafana/dashboards/lms-uploads.json"
    "grafana_dash_database|$HERE/../../observability/grafana/dashboards/lms-database.json"
    "grafana_dash_business|$HERE/../../observability/grafana/dashboards/lms-business.json"
    "grafana_dash_calls|$HERE/../../observability/grafana/dashboards/lms-calls.json"
)
for entry in "${STACK_CONFIGS[@]}"; do
    cfg="${STACK_NAME}_${entry%%|*}"
    file="${entry#*|}"
    if [ ! -f "$file" ]; then
        echo "!! Missing config source: $file" >&2
        exit 1
    fi
    remote_b64=$(docker config inspect "$cfg" --format '{{json .Spec.Data}}' 2>/dev/null | tr -d '"' || true)
    if [ -n "$remote_b64" ]; then
        local_b64=$(base64 -w0 "$file")
        if [ "$remote_b64" != "$local_b64" ]; then
            if ! docker config rm "$cfg" >/dev/null 2>&1; then
                # The config is still mounted by a running service (a stale
                # manual/partial deploy). Remove THIS stack's services that
                # reference it — the stack deploy below recreates them
                # immediately with the new config. In this stack only the
                # observability services (prometheus / grafana) mount
                # configs; their data lives in named volumes, not tasks.
                consumers=$(docker stack services "$STACK_NAME" --format '{{.Name}}' 2>/dev/null | while read -r svc; do
                    mounted=$(docker service inspect "$svc" --format '{{range .Spec.TaskTemplate.ContainerSpec.Configs}}{{.ConfigName}} {{end}}' 2>/dev/null || true)
                    case " $mounted " in *" $cfg "*) echo "$svc";; esac
                done)
                if [ -z "$consumers" ]; then
                    echo "!! Config '$cfg' changed and could not be removed (no consuming service found — resolve manually)" >&2
                    exit 1
                fi
                for svc in $consumers; do
                    echo ">> Removing '$svc' so stale config '$cfg' can be replaced (recreated below)"
                    docker service rm "$svc" >/dev/null
                done
                if ! docker config rm "$cfg" >/dev/null 2>&1; then
                    echo "!! Config '$cfg' still in use after removing consumers — resolve manually" >&2
                    exit 1
                fi
            fi
            echo ">> Replaced stale config '$cfg' (content changed)"
        fi
    fi
done

# ── 2. Registry login (only needed for PRIVATE GHCR packages) ─────────
GHCR_USER="${GHCR_USER:-}"
GHCR_TOKEN="${GHCR_TOKEN:-}"
GHCR_TOKEN_FILE="${GHCR_TOKEN_FILE:-}"
if [ -z "$GHCR_TOKEN" ] && [ -n "$GHCR_TOKEN_FILE" ] && [ -r "$GHCR_TOKEN_FILE" ]; then
    GHCR_TOKEN="$(tr -d '\r\n' < "$GHCR_TOKEN_FILE")"
fi
if [ -n "$GHCR_TOKEN" ] && [ -n "$GHCR_USER" ]; then
    printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
    echo ">> Logged in to ghcr.io as $GHCR_USER"
else
    echo ">> No GHCR credentials configured — assuming public packages (or an existing login)"
fi

# ── 3. Deploy ──────────────────────────────────────────────────────────
# Public hostnames (subdomain prefix + DOMAIN; see stack.yml header).
APP_HOST="${APP_SUBDOMAIN:-app}.${DOMAIN}"
API_HOST="${API_SUBDOMAIN:-api}.${DOMAIN}"
S3_HOST="${S3_SUBDOMAIN:-s3}.${DOMAIN}"
GRAFANA_HOST="${GRAFANA_SUBDOMAIN:-grafana}.${DOMAIN}"
TRAEFIK_HOST="${TRAEFIK_SUBDOMAIN:-traefik}.${DOMAIN}"

echo ">> Deploying stack '$STACK_NAME' (TAG=${TAG}, DOMAIN=${DOMAIN})"
docker stack deploy -c "$HERE/stack.yml" --with-registry-auth "$STACK_NAME"

# ── 4. Wait for the rollout ────────────────────────────────────────────
echo
echo ">> Waiting for services to converge (this can take minutes on first deploy)"

wait_for_services() {
    local deadline=$((SECONDS + ${ROLLOUT_TIMEOUT:-300}))
    while [ $SECONDS -lt $deadline ]; do
        local total running
        # Exclude the one-shot rustfs-init job: it reports "0/1 (complete)"
        # once it has created the bucket and is not meant to stay running.
        local list
        list=$(docker stack services "$STACK_NAME" --format '{{.Name}}\t{{.Replicas}}' | grep -v -- '-init' || true)
        total=$(printf '%s\n' "$list" | grep -c . || true)
        running=$(printf '%s\n' "$list" | awk -F'\t' '{split($2,a,"/"); if (a[1]==a[2]) c++} END {print c+0}')
        if [ "$total" -gt 0 ] && [ "$running" -eq "$total" ]; then
            echo ">> All $total long-running services are up"
            return 0
        fi
        printf '   %s/%s services running…\r' "$running" "$total"
        sleep 5
    done
    echo
    echo "!! Rollout did not converge within ${ROLLOUT_TIMEOUT:-300}s. Current state:" >&2
    docker stack ps "$STACK_NAME" --format 'table {{.Name}}\t{{.Node}}\t{{.CurrentState}}\t{{.Error}}' | head -30 >&2
    return 1
}

if ! wait_for_services; then
    echo ">> Inspect failures with: docker service logs lms_<name>" >&2
    exit 1
fi

# ── 4b. One extra backend roll (rtcd DNS race) ──────────────────────────
# A stack update restarts every service at once. lms-server can boot before
# the rtcd task (dnsrr endpoint on the video node) is back in swarm DNS,
# and its rtcd client manager only initializes at process start — calls
# would then stay down until the next restart. Roll the backend once more
# AFTER convergence so that init runs with rtcd resolvable.
echo ">> Rolling lms-server once more (rtcd DNS race on shared rollouts)"
if ! docker service update --force "${STACK_NAME}_lms-server" >/dev/null; then
    echo "!! lms-server re-roll failed; check: docker service ps ${STACK_NAME}_lms-server" >&2
fi

# ── 5. Smoke test ──────────────────────────────────────────────────────
echo
echo ">> Smoke tests (public endpoints)"
smoke() { # name url expected-status
    local name="$1" url="$2" want="${3:-200}"
    local code
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url" || echo 000)
    if [ "$code" = "$want" ]; then
        echo "   OK   $name ($code)"
    else
        # 000 = DNS/TLS not ready yet on a cold bootstrap (Let's Encrypt
        # issuance) — warn, don't fail the deploy.
        echo "   WARN $name (got $code, want $want; cold-start TLS/DNS can lag)"
    fi
}
smoke "frontend"  "https://${APP_HOST}/"                       200
smoke "api"       "https://${API_HOST}/api/v4/system/ping"     200
smoke "app api"   "https://${APP_HOST}/api/v4/system/ping"     200
smoke "grafana"   "https://${GRAFANA_HOST}/api/health"         200

# WebSocket upgrade through the SAME app origin (the calls signaling path:
# Traefik -> lms-fe run-server.js proxy -> lms-server). The server accepts
# unauthenticated upgrades (clients authenticate in-band), so a 101 response
# proves the whole chain relays upgrades correctly.
smoke_ws() { # name url
    local name="$1" url="$2" out
    out=$(curl -s -i -N --http1.1 --max-time 8 \
        -H "Connection: Upgrade" -H "Upgrade: websocket" \
        -H "Sec-WebSocket-Version: 13" \
        -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
        "$url" 2>/dev/null | head -n 1 || true)
    if echo "$out" | grep -q "101"; then
        echo "   OK   $name (101 Switching Protocols)"
    else
        echo "   WARN $name (got '${out:-none}'; calls WebSocket not relayed — check lms-fe LMS_BACKEND_URL)"
    fi
}
smoke_ws "app ws"  "https://${APP_HOST}/api/v4/websocket"

echo
echo ">> Deployed. Useful commands:"
echo "   docker stack services $STACK_NAME"
echo "   docker stack ps $STACK_NAME"
echo "   docker service logs ${STACK_NAME}_lms-server --tail 100"
echo
echo ">> Routes:"
echo "   https://${APP_HOST}      (frontend + API, same origin)"
echo "   https://${API_HOST}      (backend API)"
echo "   https://${S3_HOST}       (rustfs console)"
echo "   https://${GRAFANA_HOST}  (Grafana)"
echo "   https://${TRAEFIK_HOST}  (Traefik dashboard, basic auth)"
