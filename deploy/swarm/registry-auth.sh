#!/usr/bin/env bash
# Distribute private-registry credentials to every Swarm node.
#
# After secrets-bootstrap.sh creates the registry_htpasswd secret, Swarm nodes
# still need a docker login (config.json) to PULL from the registry. This script
# logs into the registry on the manager, captures the auth, and ships it to every
# node so that `docker stack deploy --with-registry-auth` propagates it.
#
# Run once after bootstrap, and again whenever you add a node.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$HERE/.env" ] && set -a && . "$HERE/.env" && set -a 2>/dev/null || true

REG_USER="${REGISTRY_USERNAME:-lms}"
REG_HOST="${REGISTRY:-127.0.0.1:5000}"

# Pull the password Terraform generated (or from .env).
REG_PASS=""
if [ -d "$HERE/../../infrastructure/terraform" ] && command -v terraform >/dev/null 2>&1; then
  REG_PASS="$( (cd "$HERE/../../infrastructure/terraform" && terraform output -raw generated_registry_password 2>/dev/null) || true )"
fi
REG_PASS="${REG_PASS:-$REGISTRY_PASSWORD}"
: "${REG_PASS:?need generated_registry_password (terraform output) or REGISTRY_PASSWORD in .env}"

echo ">> Logging into registry ${REG_HOST} as ${REG_USER} (manager)"
echo "$REG_PASS" | docker login "$REG_HOST" -u "$REG_USER" --password-stdin

# Ship the auth config to every node via the manager's swarm raft store.
# `docker stack deploy --with-registry-auth` reads the manager's config.json and
# distributes it to worker nodes for the deploy. So just ensure the manager is
# logged in (above) and always deploy with the flag.
echo ""
echo "Manager is logged in. All deploys MUST use --with-registry-auth:"
echo "  docker stack deploy -c stack.yml --with-registry-auth lms"
echo ""
echo "If you add a NEW worker node, re-run deploy.sh and the auth propagates automatically."
