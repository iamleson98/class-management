#!/usr/bin/env bash
# Create the Docker secrets the LMS Swarm stack expects (see stack.yml).
#
# Idempotent: existing secrets are left untouched (Docker secrets cannot be
# read back after creation, so regeneration would orphan the old value —
# rotating is a deliberate act, see "Rotation" at the bottom).
#
# Run ONCE on the Swarm manager before the first `deploy.sh`:
#   cd deploy/swarm
#   cp .env.example .env && $EDITOR .env     # set DOMAIN etc.
#   ./secrets-bootstrap.sh
#
# Creates:
#   db_password            postgres password            (hex 48)
#   db_dsn                 postgres://...               (assembled)
#   rustfs_access_key      S3 access key ID             (lms-<hex 24>)
#   rustfs_secret_key      S3 secret access key         (hex 64)
#   grafana_admin_password Grafana admin password       (hex 32)
#
# All generated values are plain alphanumeric (URL-safe, no shell quoting
# hazards in the DSN).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$HERE/.env" ] && set -a && . "$HERE/.env" && set +a

POSTGRES_USER="${POSTGRES_USER:-mmuser}"
POSTGRES_DB="${POSTGRES_DB:-mattermost}"

# ── Preflight ──────────────────────────────────────────────────────────
if ! docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null | grep -q 'active'; then
    echo "!! This node is not an active Swarm member. Run: docker swarm init" >&2
    exit 1
fi

have_secret() {
    docker secret inspect "$1" >/dev/null 2>&1
}

create_secret() { # name value
    local name="$1" value="$2"
    printf '%s' "$value" | docker secret create "$name" - >/dev/null
    echo "   created: $name"
}

gen_hex() { openssl rand -hex "${1:-16}"; }

echo ">> Creating Docker secrets (existing ones are kept)"

# ── PostgreSQL ─────────────────────────────────────────────────────────
# db_password and db_dsn must be created together: the DSN embeds the
# password, and an existing secret's value cannot be recovered.
if have_secret db_password || have_secret db_dsn; then
    if have_secret db_password && have_secret db_dsn; then
        echo "   kept:    db_password, db_dsn"
    else
        echo "!! Inconsistent state: exactly one of db_password/db_dsn exists." >&2
        echo "   Docker secrets cannot be read back, so the DSN cannot be rebuilt." >&2
        echo "   Fix (loses the old DB password — needs ALTER USER if the DB is" >&2
        echo "   already initialized):" >&2
        echo "     docker secret rm db_password db_dsn && $0" >&2
        exit 1
    fi
else
    DB_PASSWORD="$(gen_hex 24)"
    create_secret db_password "$DB_PASSWORD"
    create_secret db_dsn \
        "postgres://${POSTGRES_USER}:${DB_PASSWORD}@postgres:5432/${POSTGRES_DB}?sslmode=disable&connect_timeout=10"
fi

# ── rustfs (S3) ────────────────────────────────────────────────────────
if have_secret rustfs_access_key; then
    echo "   kept:    rustfs_access_key"
else
    create_secret rustfs_access_key "lms-$(gen_hex 12)"
fi

if have_secret rustfs_secret_key; then
    echo "   kept:    rustfs_secret_key"
else
    create_secret rustfs_secret_key "$(gen_hex 32)"
fi

# ── Grafana ────────────────────────────────────────────────────────────
if have_secret grafana_admin_password; then
    echo "   kept:    grafana_admin_password"
else
    create_secret grafana_admin_password "$(gen_hex 16)"
fi

echo
echo ">> Done. Secrets in the swarm:"
docker secret ls --format '{{.Name}}' | grep -E '^(db_|rustfs_|grafana_)' | sort | sed 's/^/   /'
echo
echo ">> Next: ./deploy.sh"
echo
echo ">> Rotation (deliberate, per-secret):"
echo "   db_password:      docker secret rm db_password db_dsn && $0"
echo "                     then ALTER USER on postgres to the NEW password,"
echo "                     then redeploy. (Only safe on a fresh DB.)"
echo "   rustfs_secret_key: docker secret rm rustfs_secret_key && $0"
echo "                     rustfs keeps the OLD key until restarted; the S3"
echo "                     credentials are validated by lms-server on boot."
echo "   grafana_admin_password: docker secret rm grafana_admin_password && $0"
echo "                     Grafana only reads it on first boot (stored in its"
echo "                     own DB afterwards); reset via grafana-cli."
