#!/usr/bin/env bash
# Create the Docker Swarm secrets referenced by stack.yml.
#
# Run ONCE on the Swarm manager (or any node that can reach the manager socket)
# after `terraform apply`. Safe to re-run: existing secrets are left in place.
#
# Secrets created (all external: referenced in stack.yml under `secrets:`):
#   db_password            — PostgreSQL password (plaintext)
#   db_dsn                 — full Postgres DSN for the backend
#   minio_root_password    — MinIO root password
#   grafana_admin_password — Grafana admin password
#   registry_htpasswd      — htpasswd entry for the private registry user
#
# Values come from Terraform outputs if present, else from .env, else are
# generated and printed.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${HERE}/.env"
[ -f "$ENV_FILE" ] && set -a && . "$ENV_FILE" && set -a 2>/dev/null || true

PGUSER="${POSTGRES_USER:-mmuser}"
PGDB="${POSTGRES_DB:-mattermost}"
PGHOST="${PGHOST:-postgres}"

require() { : "${1:?missing $2 — set it in $ENV_FILE (see .env.example) }"; }

# Resolve each secret value: Terraform output > .env > generate.
get_value() {
  local tf_var="$1" env_var="$2"
  # Try terraform output first (cd to the terraform dir)
  local val=""
  if [ -d "$HERE/../../infrastructure/terraform" ] && command -v terraform >/dev/null 2>&1; then
    val="$( (cd "$HERE/../../infrastructure/terraform" && terraform output -raw "$tf_var" 2>/dev/null) || true )"
  fi
  if [ -z "$val" ]; then val="${!env_var:-}"; fi
  if [ -z "$val" ]; then val="$(openssl rand -base64 30 | tr -d '\n/=+')"; echo "  (generated new $env_var — record it)" >&2; fi
  printf '%s' "$val"
}

# db_password
DB_PASS="$(get_value generated_db_password DB_PASSWORD)"
# db_dsn: full DSN the backend expects
DB_DSN="$(get_value _ DB_DSN 2>/dev/null || true)"
if [ -z "$DB_DSN" ]; then
  DB_DSN="postgres://${PGUSER}:${DB_PASS}@${PGHOST}:5432/${PGDB}?sslmode=disable&connect_timeout=10"
fi
MINIO_PASS="$(get_value generated_minio_root_password MINIO_ROOT_PASSWORD)"
GRAFANA_PASS="$(get_value generated_grafana_admin_password GRAFANA_ADMIN_PASSWORD)"

# registry htpasswd for user ${REGISTRY_USERNAME:-lms}
REG_USER="${REGISTRY_USERNAME:-lms}"
REG_PASS="$(get_value generated_registry_password REGISTRY_PASSWORD)"
if command -v htpasswd >/dev/null 2>&1; then
  REG_HTPASSWD="$(htpasswd -nbB "$REG_USER" "$REG_PASS")"
else
  echo "htpasswd not found — generating via docker run (apache2-utils)..." >&2
  REG_HTPASSWD="$(docker run --rm httpd:2.4 htpasswd -nbB "$REG_USER" "$REG_PASS")"
fi

# Create each secret (idempotent: skip if it already exists).
create_secret() {
  local name="$1" file="$2"
  if docker secret inspect "$name" >/dev/null 2>&1; then
    echo "secret '$name' already exists — skipping"
    return
  fi
  printf '%s' "$(cat "$file")" | docker secret create "$name" - >/dev/null
  echo "secret '$name' created"
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

printf '%s' "$DB_PASS"        > "$tmp/db_password"
printf '%s' "$DB_DSN"         > "$tmp/db_dsn"
printf '%s' "$MINIO_PASS"     > "$tmp/minio_root_password"
printf '%s' "$GRAFANA_PASS"   > "$tmp/grafana_admin_password"
printf '%s' "$REG_HTPASSWD"   > "$tmp/registry_htpasswd"

create_secret db_password          "$tmp/db_password"
create_secret db_dsn               "$tmp/db_dsn"
create_secret minio_root_password  "$tmp/minio_root_password"
create_secret grafana_admin_password "$tmp/grafana_admin_password"
create_secret registry_htpasswd    "$tmp/registry_htpasswd"

echo ""
echo "All secrets ready. Next:"
echo "  ./registry-auth.sh   # distribute registry creds to nodes"
echo "  ./build-and-push.sh  # build & push images"
echo "  ./deploy.sh          # docker stack deploy"
