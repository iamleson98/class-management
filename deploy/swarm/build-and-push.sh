#!/usr/bin/env bash
# Build the backend and frontend images and push them to the in-cluster
# private registry, so every Swarm node can pull them.
#
# Run on a host with docker that can reach the manager (or on the manager).
# If the manager's 5000 port isn't reachable from here, SSH-tunnel it first:
#   ssh -L 5000:127.0.0.1:5000 root@<manager-ip>
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
[ -f "$HERE/.env" ] && set -a && . "$HERE/.env" && set -a 2>/dev/null || true

REG_HOST="${REGISTRY:-127.0.0.1:5000}"
TAG="${TAG:-latest}"

REG_USER="${REGISTRY_USERNAME:-lms}"
REG_PASS="${REGISTRY_PASSWORD:-}"
# Try terraform output if env var unset
if [ -z "$REG_PASS" ] && [ -d "$HERE/../../infrastructure/terraform" ] && command -v terraform >/dev/null 2>&1; then
  REG_PASS="$( (cd "$HERE/../../infrastructure/terraform" && terraform output -raw generated_registry_password 2>/dev/null) || true )"
fi

# Only attempt login if the registry is reachable; otherwise assume tunnel/manager.
if [ -n "$REG_PASS" ]; then
  echo "$REG_PASS" | docker login "$REG_HOST" -u "$REG_USER" --password-stdin 2>/dev/null \
    && echo ">> Logged in to $REG_HOST" \
    || echo ">> registry login skipped (not reachable?) — make sure you can push to $REG_HOST"
fi

build_push() {
  local name="$1" ctx="$2" dockerfile="$3" domain_arg="$4"
  local image="${REG_HOST}/${name}:${TAG}"
  echo ">> Building $name -> $image"
  if [ -n "$domain_arg" ]; then
    docker build -t "$image" -f "$ctx/$dockerfile" --build-arg "$domain_arg" "$ctx"
  else
    docker build -t "$image" -f "$ctx/$dockerfile" "$ctx"
  fi
  echo ">> Pushing $image"
  docker push "$image"
}

# Backend
build_push lms-server "$ROOT/server" Dockerfile ""

# Frontend — bake the public API URL into the client bundle.
# In Swarm the frontend talks to the backend through Traefik (api.DOMAIN),
# so NEXT_PUBLIC_API_URL is the public https URL.
DOMAIN_VAL="${DOMAIN:-example.com}"
build_push lms-fe "$ROOT/lms-fe" Dockerfile "NEXT_PUBLIC_API_URL=https://api.${DOMAIN_VAL}"

echo ""
echo "Done. Images pushed to ${REG_HOST}. Now run:"
echo "  ./deploy.sh"
