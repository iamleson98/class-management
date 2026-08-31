# Multi-stage production Dockerfile for the LMS rtcd (WebRTC SFU).
#
# IMPORTANT: build from the REPOSITORY ROOT, not from rtcd/:
#   docker build -f deploy/images/rtcd.Dockerfile -t lms-rtcd .
#
# rtcd/go.mod resolves two local modules that live OUTSIDE rtcd/:
#   replace github.com/iamleson98/sitename/server/public => ../server/public
#   replace github.com/iamleson98/sitename/server/v8    => ../server
# so the build context must contain both server/ and rtcd/.
#
# The runtime image ships a config template that the entrypoint renders from
# RTCD_* environment variables into /tmp/rtcd/config.toml. This keeps the
# Swarm/Compose service definition env-driven (no config file baking, no
# image rebuilds to change the advertised ICE IP).

# ────────────────────────────── Builder ──────────────────────────────
FROM golang:1.27-alpine AS builder

RUN apk add --no-cache git

WORKDIR /src

# Layer-cache the module downloads. Both modules must be visible to the
# go command because of the cross-module replace directives.
COPY server/public/go.mod server/public/go.sum ./server/public/
COPY server/go.mod server/go.sum ./server/
RUN cd server && go mod download

COPY server/ ./server/
COPY rtcd/go.mod rtcd/go.sum ./rtcd/
RUN cd rtcd && go mod download

COPY rtcd/ ./rtcd/

ARG BUILD_NUMBER=dev
ARG BUILD_DATE
ARG BUILD_HASH=none

RUN cd rtcd && \
    BUILD_DATE="${BUILD_DATE:-$(date -u +'%Y-%m-%dT%H:%M:%SZ')}" && \
    CGO_ENABLED=0 go build \
        -trimpath \
        -ldflags "-s -w" \
        -o /out/rtcd \
        ./cmd/rtcd

# ────────────────────────────── Runtime ──────────────────────────────
FROM alpine:3.20

# ca-certificates: TLS for STUN/TURN over TLS and outbound HTTPS
# tzdata: correct log timestamps
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S -g 2001 rtcd \
    && adduser -S -D -H -u 2001 -G rtcd rtcd \
    && mkdir -p /data /tmp/rtcd \
    && chown -R rtcd:rtcd /data /tmp/rtcd

COPY --from=builder /out/rtcd /usr/local/bin/rtcd
COPY deploy/images/rtcd-config.template.toml /etc/rtcd/config.template.toml
COPY deploy/images/rtcd-entrypoint.sh /usr/local/bin/rtcd-entrypoint.sh

RUN chmod 0755 /usr/local/bin/rtcd /usr/local/bin/rtcd-entrypoint.sh

USER rtcd
WORKDIR /data

# 8045 = control API (HTTP + WebSocket, internal networks only)
# 8443 = ICE media (UDP + TCP, must be published in host mode)
EXPOSE 8045 8443/tcp 8443/udp

VOLUME ["/data"]

# rtcd's /version endpoint is an unauthenticated GET — see service/service.go.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:8045/version || exit 1

ENTRYPOINT ["/usr/local/bin/rtcd-entrypoint.sh"]
