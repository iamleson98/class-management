#!/usr/bin/env bash
# Deploy (or update) the LMS stack to the Swarm.
#
# Run on the Swarm manager, or on a host that can reach the manager socket:
#   DOCKER_HOST=ssh://root@<manager-ip> ./deploy.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$HERE/.env" ] && set -a && . "$HERE/.env" && set -a 2>/dev/null || true

# Sanity: ensure required env is set.
: "${DOMAIN:?set DOMAIN in .env}"
: "${ACME_EMAIL:?set ACME_EMAIL in .env}"
: "${TRAEFIK_AUTH:?set TRAEFIK_AUTH in .env (htpasswd string for the dashboard)}"

echo ">> Deploying stack 'lms' to the Swarm"
docker stack deploy -c "$HERE/stack.yml" --with-registry-auth lms

echo ""
echo ">> Stack deployed. Services:"
docker stack services lms

echo ""
echo "Watch rollout:"
echo "  watch 'docker stack ps lms'"
echo ""
echo "Routes (after DNS points *.DOMAIN at the manager):"
echo "  https://app.${DOMAIN}      (frontend)"
echo "  https://api.${DOMAIN}      (backend API)"
echo "  https://minio.${DOMAIN}    (MinIO console)"
echo "  https://grafana.${DOMAIN}  (Grafana)"
echo "  https://traefik.${DOMAIN}  (Traefik dashboard, basic-auth)"
