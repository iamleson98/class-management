# Multi-stage production Dockerfile for the LMS frontend (Next.js).
# Produces a minimal standalone runtime image (no Prisma / no DB).

# ----------------------------------------------------------------------------
# Stage 1: install dependencies
# ----------------------------------------------------------------------------
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat

# bun is used to install (the project ships a bun.lock). Enable corepack-managed
# bun so the lockfile is honoured exactly.
ENV BUN_VERSION=1.2.0
RUN npm install -g bun

WORKDIR /app

COPY package.json bun.lock* ./
COPY .npmrc ./.npmrc 2>/dev/null || true

RUN bun install --frozen-lockfile

# ----------------------------------------------------------------------------
# Stage 2: build the Next.js standalone output
# ----------------------------------------------------------------------------
FROM node:20-alpine AS builder

RUN npm install -g bun

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are baked into the client bundle at build time.
# Default points at the backend service name on the compose network.
ARG NEXT_PUBLIC_API_URL=http://lms-server:8065
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN bun run build

# ----------------------------------------------------------------------------
# Stage 3: minimal runtime
# ----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs \
    && adduser -S nextjs -u 1001 -G nodejs

# Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/api/v4/system/ping').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
