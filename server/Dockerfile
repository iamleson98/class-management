# Multi-stage production Dockerfile for the LMS backend (Go server).
# Builds the sitename server binary from source and ships a minimal
# Alpine runtime image.

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

WORKDIR /build

# Copy the root module manifests plus the local replacement module (./public).
# go.mod has `replace ... => ./public`, so go mod download needs public/go.mod
# available — copying just go.mod/go.sum first would fail to resolve it.
COPY go.mod go.sum ./
COPY public/go.mod public/go.sum ./public/

RUN go mod download

# Copy the rest of the server source (respect .dockerignore)
COPY . .

# Build the sitename server binary.
# -trimpath strips local paths; -tags enterprise registers LMS API endpoints
# (see cmd/sitename/main.go which imports the enterprise package).
RUN BUILD_NUMBER="${BUILD_NUMBER}" \
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
RUN go build -trimpath -o /out/mmctl ./cmd/mmctl

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
COPY build/docker-entrypoint.sh /sitename/bin/docker-entrypoint.sh

# Runtime assets (i18n strings, fonts for image rendering, email/page templates)
COPY --from=builder /build/i18n      /sitename/i18n
COPY --from=builder /build/fonts     /sitename/fonts
COPY --from=builder /build/templates /sitename/templates

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
