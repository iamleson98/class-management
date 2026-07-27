## Goal
Replace the inherited Mattermost Docker tooling with a clean, minimal Docker setup for deploying the **Go backend** + **Next.js frontend** as microservices, **with production observability** (Prometheus + Grafana). Also remove Prisma from the frontend per your decision.

## Target architecture (6 containers)
```
postgres (5432)   ──┐
minio (9000/9001)  ─┤
                    ├─► backend (lms-server, :8065 api, :8067 metrics, :8074 local-mode socket)
                    │
prometheus (9090) ──► scrapes backend :8067
grafana (3001)    ──► reads from prometheus
frontend (lms-fe, :3000) ──► proxies /api/v4/* → backend
```
- **Backend** (`server/`): Go service. Postgres via `MM_SQLSETTINGS_*`. File uploads via MinIO/S3 (`MM_FILESETTINGS_DRIVERNAME=amazons3`). Metrics endpoint `:8067` enabled via `MM_METRICSSETTINGS_ENABLE=true`.
- **Frontend** (`lms-fe/`): Next.js standalone on `:3000`. No DB. Proxies `/api/v4/*` → backend.
- **Observability**: Prometheus scrapes `backend:8067`; Grafana (port 3001 to avoid clashing with frontend's 3000) provisioned with a Prometheus datasource. Skipping the stale Mattermost-specific dashboards (agents/mobile/threads) — fresh minimal provisioning only.

---

## 1. New Docker configs (CREATE)

**`server/Dockerfile`** — multi-stage production build for backend:
- Stage 1 (`golang:1.24-alpine` builder): copy `server/`, `go build -trimpath -tags enterprise` with `iamleson98/sitename/server/public/model` ldflags (from proven `build/Dockerfile:55-68`), → `/mattermost/bin/mattermost` + `mmctl`. Copy runtime assets `fonts/`, `i18n/`, `templates/`.
- Stage 2 (`alpine:3.20` runtime): non-root user, `ca-certificates`, `tzdata`, `curl`. Copy binary + assets. `HEALTHCHECK` → `:8065/api/v4/system/ping`. `EXPOSE 8065 8067 8074 8075`. `CMD ["mattermost"]`.

**`server/.dockerignore`** — exclude `bin/`, `data/`, `logs/`, `.git`, `client` symlink, `__debug_bin*`, `node_modules`.

**`lms-fe/Dockerfile`** — multi-stage production build for frontend:
- Stage 1 (`node:20-alpine`): `bun install` (project uses `bun.lock`).
- Stage 2: `next build` with `NEXT_PUBLIC_API_URL` build-arg, output `standalone`.
- Stage 3: copy `.next/standalone` + `.next/static` + `public/`. Non-root. `:3000`. `HEALTHCHECK`.
- Add `output: 'standalone'` to `lms-fe/next.config.ts`.

**`lms-fe/.dockerignore`** — exclude `.next`, `node_modules`, `.git`, `*.docx/xlsx`.

**`docker-compose.yml`** (repo root) — `postgres`, `minio`, `lms-server`, `lms-fe`, `prometheus`, `grafana`, + `minio-init` one-shot (create upload bucket). Healthchecks + `depends_on: condition: service_healthy`. Named volumes.

**`observability/prometheus.yml`** — scrape `lms-server:8067` (5s interval).

**`observability/grafana/provisioning/datasources/prometheus.yml`** — auto-provision Prometheus datasource. Minimal, fresh.

**`.env.example`** (repo root) — `POSTGRES_*`, `MM_SQLSETTINGS_DATASOURCE`, `MM_FILESETTINGS_*`, `MINIO_*`, `NEXT_PUBLIC_API_URL`, `MM_SECRET_*`, `MM_METRICSSETTINGS_ENABLE`.

---

## 2. Remove Prisma from frontend (per your decision)
Verified tiny blast radius: `src/lib/db.ts` is the **only** file referencing Prisma, nothing imports it.
- Delete `lms-fe/prisma/`, `lms-fe/src/lib/db.ts`.
- `package.json`: drop deps `@prisma/adapter-pg`, `@prisma/client`, `prisma`, `pg`; change `"build"` → `next build`; remove `db:*` scripts.
- `.env` / `.env.example`: remove `DATABASE_URL`, `JWT_SECRET`, `REFRESH_SECRET` (auth is now the backend's `MMAUTHTOKEN` cookie).

---

## 3. Remove dead Mattermost Docker tooling (CLEAN SLATE)
Delete the over-built/unused files (HA cluster, FIPS, OpenSearch/ES, test services, Keycloak, Loki/OTel, **and the stale Mattermost-specific Grafana dashboards & configs**). Observability is rebuilt fresh in `observability/`.
- `server/build/Dockerfile` (→ replaced by new `server/Dockerfile`)
- `server/build/Dockerfile.buildenv`, `Dockerfile.buildenv-fips`, `Dockerfile.fips`, `Dockerfile.opensearch`, `Dockerfile.README.md`
- `server/build/docker-compose.common.yml`, `docker-compose.yml`
- `server/docker-compose.yaml`, `docker-compose.makefile.yml`, `docker-compose.pgvector.yml`
- `server/build/docker-compose-generator/`
- `server/build/docker/` (nginx HA, postgres.conf, prometheus.yml, grafana/*, keycloak, otel-collector, elasticsearch)
- `server/build/docker-preview/`, `server/build/dotenv/`

**Keep**: `server/build/passwd`, `entrypoint.sh`, `release.mk`, `plugin-production-public-key.gpg`, `local-test-env.sh`.

## 4. Fix `make run-server` (would break otherwise)
`make run-server` → `start-docker` → the deleted `docker-compose.makefile.yml`. Minimal targeted edit: make `start-docker` a no-op that prints a note ("dev deps now via root `docker compose up postgres minio`"), so `make run-server` still builds/runs the Go server locally. No broader Makefile refactor.

## Notes / verification flags
- **Go version**: `.go-version`=1.24.11 vs `go.mod`=`go 1.26.3`. Building with 1.24.11 (matches all proven Dockerfiles). Will verify the build compiles; bump if the toolchain rejects it.
- **Build tag**: keep `-tags enterprise` (registers LMS API endpoints via `main.go`).
- **Grafana port**: 3001 (frontend uses 3000).
- I will **not** commit or push. Will list exactly what was created/deleted at the end.