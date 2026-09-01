# Multi-stage production Dockerfile for the LMS backend (Go server).
# Builds the sitename server binary from source and ships a minimal
# Alpine runtime image.
#
# IMPORTANT: build from the REPOSITORY ROOT, not from server/:
#   docker build -f server/Dockerfile -t lms-server .
#
# server/go.mod resolves two local modules that live OUTSIDE server/:
#   replace github.com/iamleson98/sitename/server/public => ./public
#   replace github.com/mattermost/rtcd                  => ../rtcd
# so the build context must contain both server/ and rtcd/.

# ----------------------------------------------------------------------------
# Stage 1: build the Go server and mmctl
# ----------------------------------------------------------------------------
FROM golang:1.27-alpine AS builder

# Required for git-based ldflags and module fetching
RUN apk add --no-cache git gcc musl-dev

# Build arguments (overridable via --build-arg)
ARG TARGETOS=linux
ARG TARGETARCH=amd64
ARG BUILD_NUMBER=dev
ARG BUILD_DATE
ARG BUILD_HASH=none

WORKDIR /src

# Layer-cache the module downloads. All modules with local replace
# directives must be visible to the go command at download time.
# Layout: server at /src/server, public at /src/server/public (./public),
# rtcd at /src/rtcd (../rtcd) — matching the repo-root directory structure
# so every replace directive resolves exactly as it does on a dev machine.
COPY server/go.mod server/go.sum ./server/
COPY server/public/go.mod server/public/go.sum ./server/public/
COPY rtcd/go.mod rtcd/go.sum ./rtcd/
RUN cd server && go mod download

# Copy the rest of the source (respect .dockerignore)
COPY server/ ./server/
COPY rtcd/ ./rtcd/

# Build the sitename server binary.
# -trimpath strips local paths; -tags enterprise registers LMS API endpoints
# (see cmd/sitename/main.go which imports the enterprise package).
RUN cd server && \
    BUILD_NUMBER="${BUILD_NUMBER}" \
    BUILD_DATE="${BUILD_DATE:-$(date -u +'%Y-%m-%dT%H:%M:%SZ')}" \
    BUILD_HASH="${BUILD_HASH}" \
    && go build \
        -trimpath \
        -ldflags "\
          -X 'github.com/iamleson98/sitename/server/public/model.BuildNumber=${BUILD_NUMBER}' \
          -X 'github.com/iamleson98/sitename/server/public/model.BuildDate=${BUILD_DATE}' \
          -X 'github.com/iamleson98/sitename/server/public/model.BuildHash=${BUILD_HASH}' \
          -X 'github.com/iamleson98/sitename/server/public/model.BuildEnterpriseReady=true' \
          -X 'github.com/iamleson98/sitename/server/public/model.BuildHashEnterprise=none'" \
        -tags 'enterprise' \
        -o /out/sitename \
        ./cmd/sitename

# Build mmctl (Mattermost command-line tool)
RUN cd server && go build -trimpath -o /out/mmctl ./cmd/mmctl

# ----------------------------------------------------------------------------
# Stage 2: minimal Alpine runtime
# ----------------------------------------------------------------------------
FROM alpine:3.20

# ca-certificates: TLS validation for DB/S3/LDAP connections
# tzdata: correct timestamps in logs
# curl: healthcheck
RUN apk add --no-cache ca-certificates tzdata curl \
    && addgroup -S -g 2000 sitename \
    && adduser -S -D -H -u 2000 -G sitename sitename

# Runtime directory layout
RUN mkdir -p /sitename/bin \
    /sitename/config \
    /sitename/data \
    /sitename/logs \
    /sitename/plugins \
    /sitename/client/plugins \
    /sitename/prepackaged_plugins

# Binaries
COPY --from=builder /out/sitename /sitename/bin/sitename
COPY --from=builder /out/mmctl     /sitename/bin/mmctl

# Entrypoint shim that maps Docker secret files -> MM_* env vars (Mattermost
# does not support the *_FILE convention natively).
COPY server/build/docker-entrypoint.sh /sitename/bin/docker-entrypoint.sh

# Runtime assets (i18n strings, fonts for image rendering, email/page templates)
COPY --from=builder /src/server/i18n      /sitename/i18n
COPY --from=builder /src/server/fonts     /sitename/fonts
COPY --from=builder /src/server/templates /sitename/templates

RUN chown -R sitename:sitename /sitename

ENV PATH="/sitename/bin:${PATH}" \
    MM_SERVICESETTINGS_ENABLELOCALMODE=true \
    MM_INSTALL_TYPE=docker

USER sitename
WORKDIR /sitename

# 8065 = HTTP API, 8067 = Prometheus metrics, 8074 = local-mode socket,
# 8075 = performance/ profiling (optional)
EXPOSE 8065 8067 8074 8075

VOLUME ["/sitename/data", "/sitename/logs", "/sitename/config", "/sitename/plugins"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -fsS http://localhost:8065/api/v4/system/ping || exit 1

ENTRYPOINT ["/sitename/bin/docker-entrypoint.sh"]
CMD ["sitename"]
