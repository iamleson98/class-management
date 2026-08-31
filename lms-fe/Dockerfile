# Multi-stage production Dockerfile for the LMS frontend (Next.js).
# Produces a minimal standalone runtime image (no Prisma / no DB).

# ----------------------------------------------------------------------------
# Stage 1: install dependencies
# ----------------------------------------------------------------------------
FROM oven/bun:canary-alpine AS deps

RUN apk add --no-cache libc6-compat

# bun is used to install (the project ships a bun.lock).

WORKDIR /app

COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile || bun install

# ----------------------------------------------------------------------------
# Stage 2: build the Next.js standalone output
# ----------------------------------------------------------------------------
FROM oven/bun:canary-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are baked into the client bundle at build time.
#
# The production default is "/" — a sentinel meaning "same-origin": the
# reverse proxy routes /api/v4/* to the backend on whatever domain the stack
# is deployed to, and the WebSocket client resolves
# window.location.origin at runtime (src/lib/chat/client.ts). This makes the
# image DOMAIN-AGNOSTIC: one image serves any deployment domain, and no
# rebuild is needed when the domain changes.
# Override with a full URL only for a deliberate cross-origin setup.
ARG NEXT_PUBLIC_API_URL=/
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN bun run build

# ----------------------------------------------------------------------------
# Stage 3: minimal runtime
# ----------------------------------------------------------------------------
# The runtime is NODE (not bun): bun installs and builds the app, but Bun's
# node:http compatibility does not support hijacked WebSocket-upgrade sockets,
# which run-server.js needs to relay the /api/v4/websocket upgrade to the
# backend (see lib/api-proxy.js). Node is also Next.js standalone's native
# runtime, and the standalone node_modules are runtime-agnostic.
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Re-declare the build arg (ARGs do not cross stage boundaries) and surface it
# in the runtime environment for observability. NEXT_PUBLIC_* values are
# inlined into the client bundle at BUILD time; the standalone server does not
# read this at runtime, but `docker inspect` showing the sentinel documents
# what the bundle expects.
ARG NEXT_PUBLIC_API_URL=/
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN addgroup -g 1001 -S nodejs \
    && adduser -S nextjs -u 1001 -G nodejs

# Next.js standalone output. run-server.js is the production entry: it boots
# the Next standalone server AND reverse-proxies /api/v4 (REST + WebSocket)
# to LMS_BACKEND_URL at RUNTIME, so the browser only ever sees ONE origin and
# the httpOnly cookie works for REST and the calls WebSocket alike — even
# when the frontend is deployed separately from the backend.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/required-server-files.json ./.next/required-server-files.json
COPY --chown=nextjs:nodejs run-server.js ./run-server.js
COPY --chown=nextjs:nodejs lib/api-proxy.js ./lib/api-proxy.js

USER nextjs

EXPOSE 3000

# Healthcheck hits the frontend's own root page, NOT the backend proxy:
# container health must not depend on the backend (rollout races) and the
# root page proves the Next server booted. The /api/v4 proxy is exercised by
# the deploy smoke tests.
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/',{redirect:'follow'}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# LMS_BACKEND_URL (e.g. http://lms-server:8065) is provided per deployment —
# see deploy/swarm/stack.yml and DEPLOY.md ("Separated frontend deployment").
CMD ["node", "run-server.js"]
