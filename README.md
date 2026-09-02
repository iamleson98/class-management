# VMG Class Management — LMS Platform

A complete Learning Management System for Việt Mỹ Global (English center):
CRM/lead management, enrollment, tuition & payments, scheduling, attendance,
homework, weekly reviews, class media, CMS/marketing site, role-based
dashboards for 8 LMS roles, real-time chat, and native voice/video/screen-share
calls (WebRTC via the `rtcd` SFU).

The backend is a fork of the Mattermost server (Go) extended with the LMS
domain; the frontend is Next.js 16. Everything deploys as Docker containers.

```
                        ┌──────────────────────────────────────────────┐
                        │  Edge: Traefik (TLS, Let's Encrypt) :443     │
                        └───────┬───────────────────────────┬──────────┘
                                │                           │
              app.domain  ┌─────▼─────┐            ┌────────▼────────┐
              (users)     │   lms-fe  │  /api/v4/* │    lms-server   │ api.domain
                         │  Next.js  │───────────▶ │  (Go, Mattermost│ (direct API +
                         │   :3000   │  (proxied)  │     fork) :8065  │  WebSocket)
                         └───────────┘             └───┬─────────┬───┘
                                                       │         │
                                          ┌────────────▼──┐   ┌──▼────────────┐
                                          │   postgres    │   │     rustfs    │
                                          │     :5432     │   │ S3 uploads    │
                                          └───────────────┘   └───────────────┘
                                                       │
                                          chat + calls signaling (WebSocket)
                                                       │
                                          ┌────────────▼────────────┐
                                          │      lms-server calls   │
                                          │  control plane (native) │
                                          └────────────┬────────────┘
                                                       │ WS control
                                          ┌────────────▼────────────┐
                                          │   rtcd (SFU, video node)│
                                          │  media :8443 udp/tcp    │
                                          └─────────────────────────┘
```

## Repository layout

| Path | What it is |
|---|---|
| `server/` | Go backend — Mattermost fork + native LMS API (`/api/v4/lms/*`), auth, chat, native Calls control plane (`server/channels/calls`) |
| `lms-fe/` | Next.js 16 frontend (dashboard for 8 roles + public marketing site + chat + calls UI) |
| `rtcd/` | WebRTC SFU (mattermost/rtcd, vendored) — runs as its own container, owns all call media |
| `docker-compose.yml` | Single-host deployment (local/dev/small prod — rustfs, same as Swarm) |
| `deploy/swarm/` | Production: Docker Swarm stack (Contabo), secrets, deploy/rollback scripts |
| `deploy/images/` | Dockerfiles for the images CI builds (rtcd image + its env-rendered config) |
| `deploy/cloud-init/` | Contabo node bootstrap (Docker, sysctls, ufw, deploy user) |
| `.github/workflows/lms-*.yml` | CI/CD: tests, GHCR image builds, SSH deploy, rollback |
| `infrastructure/terraform-contabo/` | Optional IaC for the Contabo nodes (manager/db/video) |
| `observability/` | Prometheus config + Grafana provisioning |

---

# Deployment guide

Four supported paths:

1. **[Local full stack](#1-local-full-stack-docker-compose)** — one host, one command. Use for dev/demo.
2. **[Local frontend development](#2-local-frontend-development)** — run only `lms-fe` with bun against an existing backend.
3. **[Production on Contabo](#3-production-deployment-contabo--docker-swarm)** — Docker Swarm + Traefik TLS + rustfs + CI/CD (GitHub Actions → GHCR → SSH deploy).
4. **[Calls in production](#4-calls-in-production-voicevideo-screen-sharing)** — rtcd SFU wiring, firewall and TURN notes.

---

## 1. Local full stack (docker compose)

Runs: postgres, rustfs (S3), lms-server, lms-fe, caddy (single-origin proxy),
prometheus, grafana — the same engines as the production Swarm stack.

### 1.1 Prerequisites

- Docker Engine 24+ with the compose plugin
- 4 GB RAM free

### 1.2 Configure

```bash
cp .env.example .env
```

Edit `.env` and change every `CHANGE ME` value:

| Variable | Notes |
|---|---|
| `POSTGRES_PASSWORD` | strong password (also appears inside `MM_SQLSETTINGS_DATASOURCE`) |
| `MM_SQLSETTINGS_DATASOURCE` | keep in sync with user/password/db above |
| `RUSTFS_SECRET_KEY` | 8–40 chars (object-storage secret; console login is `RUSTFS_ACCESS_KEY` + this) |
| `GRAFANA_ADMIN_PASSWORD` | Grafana login |
| `MM_SERVICESETTINGS_SITEURL` | `http://localhost` for local |

### 1.3 Start

```bash
docker compose up -d
docker compose ps          # wait until all services are "healthy"
docker compose logs -f lms-server   # watch boot; ready when it stops printing
```

First boot runs DB migrations (≈1–2 min).

### 1.4 Access

| URL | What |
|---|---|
| **http://localhost** | The app (Caddy serves frontend + proxies `/api/v4` to the backend on one origin — required for the auth cookie and the chat WebSocket) |
| http://localhost:3000 | Frontend directly (login flows work; chat WS needs the :80 proxy) |
| http://localhost:9001 | rustfs console (uploads bucket) |
| http://localhost:3001 | Grafana |

> Always prefer **http://localhost** (port 80): the login cookie and the chat
> WebSocket are same-origin there.

### 1.5 First login (creates the super admin)

1. Open **http://localhost** → you land on the login page.
2. Type the **email + password you want for your admin account** and submit.
   The **first login ever** auto-creates that account as system admin and
   creates the internal `team-employee` team. (The frontend maps `system_admin`
   to the `lms_super_admin` dashboard.)
3. You are in the Super Admin dashboard. Create staff accounts
   (Admin → Cấu hình → Quản lý nhân viên) and assign roles:
   `lms_admin`, `lms_counselor`, `lms_teacher`, `lms_accountant`,
   `lms_marketing`. Students/parents are created through CRM lead conversion
   or public registration — converted students get the default password
   `Student@123`.

### 1.6 Day-2 commands

```bash
docker compose logs -f lms-fe        # frontend logs
docker compose restart lms-server    # restart one service
docker compose pull && docker compose up -d   # refresh images
docker compose down                  # stop (data persists in named volumes)
docker compose down -v               # stop AND wipe data (dangerous)
```

---

## 2. Local frontend development

Run the backend via compose (above), then the frontend with hot reload:

```bash
cd lms-fe
bun install                # requires bun ≥ 1.4 (lockfileVersion 2)
cp .env.example .env       # NEXT_PUBLIC_API_URL=http://localhost:8065
bun run dev                # http://localhost:3001
```

Useful scripts:

```bash
bun run test      # vitest suite (stores, calls protocol, view router)
bun run lint      # eslint
bun run build     # production build (standalone output)
```

Type-check: `bunx tsc --noEmit`.

---

## 3. Production deployment (Contabo + Docker Swarm)

Runs on Contabo Cloud VPSes / VDSes. Images come from GitHub Container
Registry and are built by GitHub Actions — pushing to `master` tests, builds
and deploys automatically.

| Node | Label | Runs | Suggested size |
|---|---|---|---|
| manager-1 | `manager` | Traefik (TLS), lms-server, lms-fe, postgres, rustfs, rtcd, prometheus, grafana | 4 vCPU / 8 GB (single node) |
| db-1 *(optional)* | `db` | postgres, rustfs | RAM-heavy |
| video-1 *(optional)* | `video` | rtcd (calls SFU) — see §4 | 8 vCPU / 16 GB (VDS) |

**Single node works out of the box** (that's the default); the optional nodes
are for larger deployments — set `*_PLACEMENT` in `deploy/swarm/.env`.

All inter-service traffic runs on an encrypted Swarm overlay network. Only
the manager publishes 80/443 (plus 8443 on the video node for calls media).

> This section is the short path. The full guide — sizing, hardening,
> backups, troubleshooting — is [`DEPLOY.md`](DEPLOY.md).

### 3.1 Create the server(s)

When creating the VPS in the Contabo panel, paste
[`deploy/cloud-init/contabo.yaml`](deploy/cloud-init/contabo.yaml) into the
cloud-init field (replace `${ssh_public_key}` with your public key). It
installs Docker, tunes sysctls, sets up ufw and creates a `deploy` user.
For multi-node with API provisioning, see
`infrastructure/terraform-contabo/`.

### 3.2 Form the swarm

```bash
ssh deploy@<manager-ip>
docker swarm init --advertise-addr <manager-ip>
# multi-node: docker swarm join ... on each worker (see join-token),
#            then docker node update --label-add role=db|video|backend <node>
```

### 3.3 DNS

Point A records at the **manager's public IP**:

```
app.example.com     →  <manager-ip>   (the application)
api.example.com     →  <manager-ip>   (direct REST/WS access)
s3.example.com      →  <manager-ip>   (rustfs console)
grafana.example.com →  <manager-ip>   (dashboards)
traefik.example.com →  <manager-ip>   (Traefik dashboard)
```

> Do this **before** deploying — Let's Encrypt certificates are issued on
> first request, and issuance fails if DNS does not resolve yet.

### 3.4 Create the secrets (one-time, on the manager)

```bash
git clone https://github.com/iamleson98/class-management /opt/lms-src
cd /opt/lms-src/deploy/swarm
cp .env.example .env       # edit: DOMAIN, ACME_EMAIL, TRAEFIK_AUTH,
                           #       RTCD_ICE_HOST_OVERRIDE=<manager public IP>, TAG
./secrets-bootstrap.sh
```

Creates the Docker secrets: `db_password`, `db_dsn`, `rustfs_access_key`,
`rustfs_secret_key`, `grafana_admin_password`. Idempotent — existing secrets
are never overwritten. postgres, rustfs and grafana read them via the native
`*_FILE` convention; the backend reads them via a small entrypoint shim
(`SECRETS_MAP` maps secret files to `MM_*` env vars).

### 3.5 CI/CD (recommended): wire GitHub → GHCR → your manager

Add to the repository (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `CONTABO_SSH_KEY` | private key the manager accepts (the `deploy` user) |
| `LMS_TRAEFIK_AUTH` | `htpasswd -nB admin` (Traefik dashboard login) |
| `GHCR_PAT` | *optional*: PAT with `read:packages` if the GHCR packages stay private |

| Variable | Value |
|---|---|
| `CONTABO_SSH_HOST` / `CONTABO_SSH_USER` / `CONTABO_SSH_PORT` | manager address |
| `LMS_DOMAIN` / `LMS_ACME_EMAIL` | domain + Let's Encrypt email |
| `LMS_RTCD_PUBLIC_IP` | public IPv4 of the rtcd node |

Also create an (empty) `production` environment — it gives you deployment
history and an optional approval gate.

Then every push to `master` runs: tests → build `lms-server`, `lms-fe`,
`lms-rtcd` → push to `ghcr.io/iamleson98/*` (immutable `sha-` tags) →
SSH deploy (`docker stack deploy --with-registry-auth`) → rollout wait →
smoke tests. Manual rollback: the **LMS Rollback** workflow or
`deploy/swarm/rollback.sh`.

The GHCR packages are created private on first push; make them public for
password-less pulls, or keep them private with `GHCR_PAT`.

### 3.6 Manual path (no CI)

```bash
# workstation with docker + GHCR login (GHCR_USER/GHCR_TOKEN or docker login):
./build-and-push.sh          # builds the 3 images, pushes to ghcr.io

# manager:
TAG=latest ./deploy.sh       # or TAG=sha-<commit> for immutable pinning
```

Watch the rollout:

```bash
docker stack services lms
docker service logs -f lms_lms-server
```

### 3.7 Verify

| Check | Command / URL |
|---|---|
| Backend up | `curl https://api.example.com/api/v4/system/ping` → `OK` |
| Frontend up | open `https://app.example.com` → login page |
| TLS cert | padlock on `app.`/`api.`/`grafana.` |
| Chat WebSocket | log in, open Trò chuyện — messages + presence work |
| Metrics | backend :8067 scraped by Prometheus (rtcd :8045 too) |
| Dashboards | `https://grafana.example.com` (admin + secret password) |

### 3.8 First login on production

Same as local: the **first credentials submitted on the login page become the
super-admin account** (and bootstrap the internal `team-employee` team). Do
this immediately after deploy so nobody else can claim it. Then create staff
accounts and assign LMS roles from the settings screen.

---

## 4. Calls in production (voice/video/screen sharing)

Calls are **native** in this fork: `lms-server` owns the signaling/presence
control plane, and the vendored **rtcd** SFU handles all media. The Swarm
stack ships with rtcd already wired (`lms-rtcd` service); the compose file
does not (add it if you want calls locally — §4.4).

The three things that must be right:

1. **`RTCD_ICE_HOST_OVERRIDE`** (in `deploy/swarm/.env`) — the **public
   IPv4 of the node the rtcd task runs on**. It is advertised to browsers in
   ICE candidates and must match the socket that actually receives media.
   Wrong value = calls work only on the same LAN.
2. **Firewall**: 8443 **UDP + TCP** open on that node (media); 8045 stays
   overlay-only (control API — never expose it).
3. **`MM_CALLSSETTINGS_*`** on `lms-server` — already set by the stack:
   `ENABLE=true`, `RTCDSERVICEURL=http://rtcd:8045` (overlay service name),
   `ICESERVERS` (add a `turn:` URL for strict client NATs — deploy coturn
   yourself and set it in `.env`).

The rtcd image renders its config from `RTCD_*` env vars at container start
(`deploy/images/rtcd-entrypoint.sh`) — no config file to maintain, and the
registered-client credentials persist in the `rtcd_data` volume.

### 4.1 How the wiring works (for troubleshooting)

- Browsers signal `custom_calls_*` actions over the **existing chat
  WebSocket** (`/api/v4/websocket` via `app.<domain>`); the server relays
  SDP/ICE to rtcd over its own control WebSocket and fans out presence
  (mute/speaking/hands/host) to call participants.
- Media flows **browser ↔ rtcd :8443** directly — never through Traefik.
  That is why the media ports are published in **host mode** (Swarm ingress
  VIPs would break ICE host-candidate matching).
- The join ack delivers ICE servers to the browser; rtcd labels each forwarded
  track with the origin session id so every participant's tile renders the
  right stream. Speaking detection (VAD) runs **on the SFU**.
- Scale media by adding video nodes and more rtcd services (separate host
  ports/nodes) — the server discovers all IPs of
  `MM_CALLSSETTINGS_RTCDSERVICEURL` and load-balances new calls across the
  pool.

### 4.2 Verify calls

```bash
docker service logs lms_lms-rtcd --tail 50     # rtcd up, config rendered
docker service logs lms_lms-server | grep calls
# → "calls: rtcd client manager started url=http://rtcd:8045"
curl -H "Authorization: Bearer <token>" \
  https://api.example.com/api/v4/calls/channels/<channel_id>
```

Then two browsers (or a second profile), open the same class channel → Trò
chuyện → phone icon: join, mute, camera, screen share, raise hand, host
controls.

### 4.3 TURN for strict networks (optional)

When participants sit behind corporate NATs that block direct UDP, add a
TURN server (e.g. `coturn/coturn` on the video node) and set in
`deploy/swarm/.env`:

```env
MM_CALLSSETTINGS_ICESERVERS=stun:stun.l.google.com:19302,turn:turn.example.com:3478
```

### 4.4 Calls on the local compose stack (optional)

Add an `rtcd` service to `docker-compose.yml` (build
`deploy/images/rtcd.Dockerfile` from the repo root, publish `8443/udp`+`8443/tcp`),
and give `lms-server`:

```yaml
      MM_CALLSSETTINGS_ENABLE: "true"
      MM_CALLSSETTINGS_RTCDSERVICEURL: "http://rtcd:8045"
```

Calls work on `localhost` without `RTCD_ICE_HOST_OVERRIDE` (host candidates
are local IPs).

---

## 5. Operations

### Logs & status

```bash
docker stack services lms                       # desired/running per service
docker service logs -f lms_lms-server           # backend
docker service logs -f lms_lms-fe               # frontend
docker service logs -f lms_lms-rtcd             # calls SFU
ssh deploy@<node-ip>                            # node-level access
```

### Updating a release

CI path (recommended): merge to `master` — tests, images, deploy and smoke
tests run automatically, pinned to the immutable `sha-<commit>` tag.

```bash
# manual path:
cd deploy/swarm
TAG=sha-<commit> ./deploy.sh         # or: ./build-and-push.sh && ./deploy.sh
```

Stateless services roll with `order: start-first` (zero downtime) and
auto-rollback on failure; stateful services use `stop-first` and pause for
inspection. Manual rollback: `./rollback.sh` (or the LMS Rollback workflow)
— either revert to the previous stack spec or redeploy an older `sha-` tag.

### Backups (do these on a schedule)

```bash
# Database (on the node running postgres)
docker exec $(docker ps -qf name=lms_postgres) pg_dump -U mmuser mattermost \
  | gzip > backup-$(date +%F).sql.gz

# Uploads (rustfs volume)
docker run --rm -v lms_rustfs_data:/data -v $PWD:/backup alpine \
  tar czf /backup/rustfs-$(date +%F).tgz -C /data .

# rtcd client keys — volume rtcd_data
```

Secrets live in Swarm's encrypted raft store; re-record them somewhere safe
(password manager) — `secrets-bootstrap.sh` deliberately never overwrites.

### Monitoring

Prometheus scrapes `lms-server:8067/metrics` (API latencies, websocket
counts, DB health, calls metrics) and `lms-rtcd:8045/metrics`. Grafana at
`https://grafana.<domain>` ships with the Prometheus datasource
auto-provisioned — drop dashboards into the `grafana-dashboards` volume to
have them auto-loaded.

### Tear down

```bash
docker stack rm lms
# if provisioned with terraform:
cd infrastructure/terraform-contabo && terraform destroy -var-file=envs/contabo.tfvars
```

---

## 6. Troubleshooting

| Symptom | Likely cause → fix |
|---|---|
| Login page loops / API 401 on `app.<domain>` | You're hitting `api.<domain>` directly from the app, or cookies blocked. Always use `https://app.<domain>`; the frontend's own server proxies `/api/v4` (REST + WS) to `LMS_BACKEND_URL` — check that env on the `lms-fe` service. |
| Chat loads but no messages arrive | WebSocket not upgraded — confirm `wss://app.<domain>/api/v4/websocket` in the browser network tab (101 response); the frontend relays the upgrade to the backend (check `LMS_BACKEND_URL` + lms-fe logs), and Traefik upgrades WS automatically. |
| Certificate invalid / TLS errors | DNS for the subdomain doesn't point at the manager yet, or Let's Encrypt rate-limited (wait 1 h, check `docker service logs lms_traefik`). |
| `docker stack deploy` can't pull images | GHCR auth missing on the manager → set `GHCR_PAT` (+ `GHCR_USER`) or make the packages public; deploy.sh always passes `--with-registry-auth` (private packages need a `read:packages` PAT). |
| lms-server crash-loops | `docker service logs` → usually DB unreachable (DSN secret wrong) or S3 creds mismatch. Recreate secret: `docker secret rm db_dsn && ./secrets-bootstrap.sh` then redeploy. |
| Calls button does nothing / "rtcd not configured" | `MM_CALLSSETTINGS_ENABLE` / `RTCDSERVICEURL` missing on lms-server, or rtcd down (`docker service ps lms_lms-rtcd`). |
| Call connects, no audio/video between remote peers | Media blocked: video-node firewall must allow **UDP 8443 in+out** (and TCP 8443 fallback); set `RTCD_ICE_HOST_OVERRIDE` to the video node's **public** IP; test in two different networks. |
| Call works on same Wi-Fi only | Classic symptom of a wrong `RTCD_ICE_HOST_OVERRIDE` / firewall — browsers fall back to host candidates which only work locally. |
| Audio one-way | TURN needed on strict client networks — deploy coturn and set `MM_CALLSSETTINGS_ICESERVERS` to include `turn:`. |
| Someone forgot their password | Use Quên mật khẩu on the login page (needs SMTP env on lms-server), or an admin resets it. Converted students' default password is `Student@123`. |
| Frontend shows old build | Image tag unchanged — deploy with `TAG=<new>` so Swarm pulls the new digest. |

---

## Appendix: key environment variables (backend)

All `MM_*` variables follow the Mattermost convention
(`MM_<SECTION>_<FIELD>`). The ones you're most likely to touch:

| Variable | Purpose |
|---|---|
| `MM_SQLSETTINGS_DATASOURCE` | Postgres DSN (secret-provided in Swarm) |
| `MM_FILESETTINGS_AMAZONS3*` | rustfs/S3 uploads (endpoint, bucket, keys) |
| `MM_SERVICESETTINGS_SITEURL` | `https://app.<domain>` in production (the user-facing origin) |
| `MM_CALLSSETTINGS_ENABLE` | turn the native calls feature on |
| `MM_CALLSSETTINGS_RTCDSERVICEURL` | rtcd control endpoint (service name on the overlay) |
| `MM_CALLSSETTINGS_ICESERVERS` | comma-separated `stun:`/`turn:` URLs for browsers |
| `MM_CALLSSETTINGS_MAXCALLPARTICIPANTS` | per-call limit (0 = unlimited) |
| `MM_METRICSSETTINGS_*` | Prometheus metrics on :8067 |

See `deploy/swarm/stack.yml` and the root `docker-compose.yml` for the full,
commented set used in each deployment mode.
