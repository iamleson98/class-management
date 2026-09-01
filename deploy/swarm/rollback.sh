#!/usr/bin/env bash
# Roll back the LMS stack.
#
# Two modes:
#   1. Immediate in-place rollback to the previous spec (what Swarm last
#      rolled out successfully):
#         ./rollback.sh                # docker stack rollback lms
#
#   2. Redeploy an older immutable image tag (e.g. from CI):
#         ./rollback.sh sha-1a2b3c4    # TAG=sha-1a2b3c4 ./deploy.sh
#
# Mode 1 is instant but only reverts to the PREVIOUS stack spec — if you have
# deployed twice since the incident, use mode 2 with the known-good SHA
# (find tags at https://github.com/iamleson98/class-management/pkgs).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_NAME="${STACK_NAME:-lms}"

if [ "$#" -gt 1 ]; then
    echo "usage: $0 [image-tag]" >&2
    exit 2
fi

if [ "$#" -eq 0 ]; then
    echo ">> docker stack rollback $STACK_NAME (reverts to the previous stack spec)"
    docker stack rollback "$STACK_NAME"
    echo
    echo ">> Watching rollout:"
    watch -n 3 "docker stack ps $STACK_NAME"
    exit 0
fi

TAG="$1"
echo ">> Redeploying stack '$STACK_NAME' with TAG=$TAG"
TAG="$TAG" "$HERE/deploy.sh"
