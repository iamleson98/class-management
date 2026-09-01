#!/usr/bin/env bash
# Build the three LMS images and push them to GitHub Container Registry.
#
# This is the MANUAL path (from a workstation with docker). The automated
# path is .github/workflows/lms-deploy.yml, which builds the same images in
# GitHub Actions. Use this for local experiments or air-gapped CI runners.
#
# Usage (from the repo root or anywhere — paths are resolved):
#   ./build-and-push.sh                      # TAG=latest
#   TAG=sha-1a2b3c4 ./build-and-push.sh       # immutable CI-style tag
#
# Auth: GHCR_USER + GHCR_TOKEN (a PAT with write:packages), from env or
#   ~/.docker/config.json (an existing `docker login ghcr.io`).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

GHCR_USER="${GHCR_USER:-}"
GHCR_TOKEN="${GHCR_TOKEN:-}"
REGISTRY_PREFIX="${REGISTRY_PREFIX:-ghcr.io/iamleson98}"
TAG="${TAG:-latest}"
PLATFORMS="${PLATFORMS:-linux/amd64}"

# Environment variables take precedence over .env (same rule as deploy.sh).
CALLER_TAG="${TAG:-}"
CALLER_REGISTRY_PREFIX="${REGISTRY_PREFIX:-}"

if [ -f "$HERE/.env" ]; then set -a && . "$HERE/.env" && set +a; fi

[ -n "$CALLER_TAG" ] && TAG="$CALLER_TAG"
[ -n "$CALLER_REGISTRY_PREFIX" ] && REGISTRY_PREFIX="$CALLER_REGISTRY_PREFIX"

if [ -n "$GHCR_TOKEN" ] && [ -n "$GHCR_USER" ]; then
    printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
    echo ">> Logged in to ghcr.io as $GHCR_USER"
else
    if ! docker system info 2>/dev/null | grep -q 'ghcr.io'; then
        echo "!! No ghcr.io credentials. Either export GHCR_USER + GHCR_TOKEN or run:" >&2
        echo "   docker login ghcr.io" >&2
        exit 1
    fi
fi

BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
BUILD_HASH="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo none)"
BUILD_NUMBER="${BUILD_NUMBER:-$BUILD_HASH}"

build_push() { # image-name dockerfile context extra-build-args...
    local name="$1" dockerfile="$2" context="$3"; shift 3
    local image="${REGISTRY_PREFIX}/${name}:${TAG}"
    echo
    echo ">> Building $name -> $image"
    docker build \
        --platform "$PLATFORMS" \
        --build-arg "BUILD_NUMBER=${BUILD_NUMBER}" \
        --build-arg "BUILD_DATE=${BUILD_DATE}" \
        --build-arg "BUILD_HASH=${BUILD_HASH}" \
        "$@" \
        -f "$dockerfile" \
        -t "$image" \
        "$context"
    echo ">> Pushing $image"
    docker push "$image"
}

# Backend: context = REPO ROOT (server/go.mod replaces -> ../rtcd, so the
# context must contain both server/ and rtcd/).
build_push lms-server "$ROOT/server/Dockerfile" "$ROOT"

# Frontend: context = lms-fe/ (NEXT_PUBLIC_API_URL defaults to the
# same-origin sentinel "/" inside the Dockerfile — the image is
# domain-agnostic, no build-arg needed).
build_push lms-fe "$ROOT/lms-fe/Dockerfile" "$ROOT/lms-fe"

# rtcd: context = REPO ROOT (rtcd/go.mod has replace directives pointing at
# ../server — building from rtcd/ alone cannot resolve the modules).
build_push lms-rtcd "$ROOT/deploy/images/rtcd.Dockerfile" "$ROOT"

echo
echo ">> Done. Deploy with:"
echo "   TAG=${TAG} ${HERE}/deploy.sh"
