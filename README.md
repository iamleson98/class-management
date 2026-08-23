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
                                          │   postgres    │   │     minio     │
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
| `plugin-calls/` | Reference only — the upstream Calls plugin we ported the protocol from (not deployed) |
| `docker-compose.yml` | Single-host deployment (local/dev/small prod) |
| `deploy/swarm/` | Production: Docker Swarm stack, secrets, build & deploy scripts |
| `deploy/caddy/` | Dev reverse-proxy config used by docker-compose (single-origin cookies) |
| `infrastructure/terraform/` | Kamatera VM provisioning (manager/backend/db/video nodes) |
| `observability/` | Prometheus config + Grafana provisioning |

---

# Deployment guide

Four supported paths:

1. **[Local full stack](#1-local-full-stack-docker-compose)** — one host, one command. Use for dev/demo.
2. **[Local frontend development](#2-local-frontend-development)** — run only `lms-fe` with bun against an existing backend.
3. **[Production on Kamatera](#3-production-deployment-kamatera--docker-swarm)** — Terraform + Docker Swarm + Traefik TLS.
4. **[Enabling Calls (voice/video)](#4-enabling-calls-voicevideo-screen-sharing)** — the rtcd SFU on the video node. Optional but recommended.

---

## 1. Local full stack (docker compose)

Runs: postgres, minio (S3), lms-server, lms-fe, caddy (single-origin proxy),
prometheus, grafana.

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
| `MINIO_ROOT_PASSWORD` | 8–40 chars |
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
| http://localhost:3000 | Frontend directly (login flows still work; chat WS goes to :8065) |
| http://localhost:9001 | MinIO console (uploads bucket) |
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

## 3. Production deployment (Kamatera + Docker Swarm)

Four VMs on Kamatera, formed into a Docker Swarm by Terraform:

| Node | Label | Runs | Suggested size |
|---|---|---|---|
| manager-1 | `manager` | Traefik (TLS), private registry, lms-fe, prometheus, grafana | 2B / 8 GB / 50 GB |
| backend-1 | `backend` | lms-server (Go API), minio | 2B / 4 GB / 50 GB |
| db-1 | `db` | postgres | 2B / 8 GB / 80 GB |
| video-1 | `video` | rtcd (calls SFU) — see §4 | 4B / 8 GB / 50 GB |

All inter-service traffic runs on an encrypted Swarm overlay network. Only the
manager publishes 80/443 (plus 8443 on the video node for calls media).

### 3.1 Prerequisites (one-time, on your workstation)

```bash
# Kamatera API credentials (Console → API)
export KAMATERA_API_CLIENT_ID="..."
export KAMATERA_API_SECRET="..."

# SSH keypair Terraform injects into the VMs
ssh-keygen -t ed25519 -f ~/.ssh/lms_swarm -N ""

# Tools: terraform >= 1.5, docker, ssh
```

A domain you control (for TLS). You will point five subdomains at the manager
IP: `app.`, `api.`, `minio.`, `grafana.`, `traefik.`

### 3.2 Provision the cluster

```bash
cd infrastructure/terraform
cp envs/dev.tfvars.example envs/dev.tfvars
#   edit: kamatera_zone, server_image, ssh_public_key, node sizes

terraform init
terraform apply -var-file=envs/dev.tfvars
```

What `apply` does: creates the 4 VMs on a private network → installs Docker
over SSH → `docker swarm init` on the manager → joins the workers → labels each
node `role=manager|backend|db|video` → generates random secrets (DB password,
MinIO key, registry password, Grafana password) exposed as Terraform outputs.

Verify:

```bash
terraform output -raw manager_ssh    # copy & run, then:
docker node ls                       # 4 nodes, correct labels
terraform output -raw generated_db_password   # secrets used next
```

### 3.3 DNS

Point A records at the **manager's public IP** (from `terraform output`):

```
app.example.com     →  <manager-ip>   (the application)
api.example.com     →  <manager-ip>   (direct REST/WS access)
minio.example.com   →  <manager-ip>   (MinIO console)
grafana.example.com →  <manager-ip>   (dashboards)
traefik.example.com →  <manager-ip>   (Traefik dashboard)
```

> Do this **before** deploying — Let's Encrypt certificates are issued on
> first request, and issuance fails if DNS does not resolve yet.

### 3.4 Configure the stack

```bash
cd deploy/swarm
cp .env.example .env
```

Fill in:

| Variable | Notes |
|---|---|
| `DOMAIN` | your apex domain, e.g. `example.com` |
| `ACME_EMAIL` | Let's Encrypt account email |
| `TRAEFIK_AUTH` | basic-auth for the Traefik dashboard: `htpasswd -nb admin 'pw' \| sed 's/\$/\$\$/g'` |

Passwords are **not** in `.env` — they become Docker secrets next.

### 3.5 Create the secrets

Run on a machine that can reach the manager socket
(`export DOCKER_HOST=ssh://root@<manager-ip>` or run on the manager):

```bash
./secrets-bootstrap.sh
```

Creates the Swarm secrets (from Terraform outputs, else generated):
`db_password`, `db_dsn`, `minio_root_password`, `grafana_admin_password`,
`registry_htpasswd`. Idempotent — existing secrets are never overwritten.

The backend image reads them via a small entrypoint shim (`SECRETS_MAP`
maps secret files to `MM_*` env vars), because Mattermost has no
`*_FILE` convention.

### 3.6 Let every node pull from the private registry

```bash
./registry-auth.sh    # once after bootstrap, and after adding nodes
```

### 3.7 Build & push the images

```bash
# If you're not on the manager, tunnel the registry port first:
ssh -L 5000:127.0.0.1:5000 root@<manager-ip>

./build-and-push.sh           # builds lms-server + lms-fe, pushes to :5000
```

### 3.8 Deploy

```bash
./deploy.sh                   # = docker stack deploy -c stack.yml --with-registry-auth lms
```

Watch the rollout:

```bash
docker stack services lms
docker service logs -f lms_lms-server
```

### 3.9 Verify

| Check | Command / URL |
|---|---|
| Backend up | `curl https://api.example.com/api/v4/system/ping` → `OK` |
| Frontend up | open `https://app.example.com` → login page |
| TLS cert | padlock on `app.`/`api.`/`grafana.` |
| Chat WebSocket | log in, open Trò chuyện — messages + presence work |
| Metrics | `https://api.example.com` backend :8067 scraped by Prometheus |
| Dashboards | `https://grafana.example.com` (admin + secret password) |

### 3.10 First login on production

Same as local: the **first credentials submitted on the login page become the
super-admin account** (and bootstrap the internal `team-employee` team). Do
this immediately after deploy so nobody else can claim it. Then create staff
accounts and assign LMS roles from the settings screen.

---

## 4. Enabling Calls (voice/video/screen sharing)

Calls are **native** in this fork: `lms-server` owns the signaling/presence
control plane, and the vendored **rtcd** SFU handles all media. Three things
are needed:

1. rtcd running (typically on the `video` node)
2. `MM_CALLSSETTINGS_*` env on `lms-server`
3. Firewall + public-IP config for media (UDP/TCP 8443)

### 4.1 Add rtcd to the stack

Append to `deploy/swarm/stack.yml`:

```yaml
  # ───────────────────────── Calls SFU (rtcd) ────────────────────────
  rtcd:
    image: mattermost/rtcd:latest          # or your own build of ./rtcd
    command: ["--config", "/etc/rtcd/config.toml"]
    volumes:
      - ./rtcd/config.toml:/etc/rtcd/config.toml:ro
      - rtcd_data:/tmp/rtcd_db             # persists registered-client keys
    networks: [lms_overlay]
    deploy:
      replicas: 1
      placement:
        constraints: ["node.labels.role == video"]
    ports:
      # Media MUST be host-mode: WebRTC UDP does not flow through Swarm
      # ingress routing. Host mode pins to the video node — that's why the
      # service is label-constrained to exactly one node.
      - target: 8443
        published: 8443
        protocol: udp
        mode: host
      - target: 8443
        published: 8443
        protocol: tcp
        mode: host

volumes:
  rtcd_data:
```

And create `deploy/swarm/rtcd/config.toml` (start from
`rtcd/config/config.sample.toml`). The important lines:

```toml
[api]
http.listen_address = ":8045"
# The server self-registers with rtcd on first connect. Safe on the private
# overlay network; set explicit credentials instead if rtcd is ever exposed.
security.allow_self_registration = true

[rtc]
ice_port_udp = 8443
ice_port_tcp = 8443
# ADVERTISE the video node's PUBLIC IP to browsers:
ice_host_override = "<VIDEO_NODE_PUBLIC_IP>"
```

Also add `rtcd_data:` to the stack's top-level `volumes:` list.

### 4.2 Point lms-server at rtcd

Add to the `lms-server.environment` block in `stack.yml`:

```yaml
      # ── Native calls ──
      MM_CALLSSETTINGS_ENABLE: "true"
      # Overlay service name; the server DNS-discovers the SFU pool here.
      # (To pin credentials instead of self-registration, embed them:
      #  http://clientID:authKey@rtcd:8045)
      MM_CALLSSETTINGS_RTCDSERVICEURL: "http://rtcd:8045"
      # ICE servers handed to browsers for their RTCPeerConnection.
      # Defaults to stun:<rtcd host> when unset; add TURN for strict networks:
      # MM_CALLSSETTINGS_ICESERVERS: "stun:stun.l.google.com:19302,turn:turn.example.com:3478"
      MM_CALLSSETTINGS_MAXCALLPARTICIPANTS: "0"      # 0 = unlimited
      MM_CALLSSETTINGS_ALLOWSCREENSHARING: "true"    # screen sharing
```

Redeploy: `./deploy.sh`.

### 4.3 Firewall (video node)

Open on the video node's Kamatera firewall / security group:

| Port | Protocol | Purpose |
|---|---|---|
| 8443 | UDP | call media (RTP/ICE) |
| 8443 | TCP | call media fallback (ICE-TCP) |

8045 must stay **overlay-only** (never expose the rtcd control API publicly).

### 4.4 How the wiring works (for troubleshooting)

- Browsers signal `custom_calls_*` actions over the **existing chat
  WebSocket** (`/api/v4/websocket` via `app.<domain>`); the server relays
  SDP/ICE to rtcd over its own control WebSocket and fans out presence
  (mute/speaking/hands/host) to call participants.
- Media flows **browser ↔ rtcd :8443** directly — never through Traefik.
- The join ack delivers ICE servers to the browser; rtcd labels each forwarded
  track with the origin session id so every participant's tile renders the
  right stream. Speaking detection (VAD) runs **on the SFU**.
- Scale media by adding video nodes and more rtcd replicas behind one DNS
  name — the server discovers all IPs of `MM_CALLSSETTINGS_RTCDSERVICEURL`
  and load-balances new calls across the pool.

### 4.5 Verify calls

```bash
docker service logs lms_rtcd --tail 50        # rtcd up, config parsed
docker service logs lms_lms-server | grep calls
# → "calls: rtcd client manager started url=http://rtcd:8045"
curl -H "Authorization: Bearer <token>" \
  https://api.example.com/api/v4/calls/channels/<channel_id>
```

Then two browsers (or a second profile), open the same class channel → Trò
chuyện → phone icon: join, mute, camera, screen share, raise hand, host
controls.

### 4.6 Calls on the local compose stack (optional)

Add the same `rtcd` service to `docker-compose.yml` (no label constraints;
publish `8443/udp`+`8443/tcp`), and give `lms-server`:

```yaml
      MM_CALLSSETTINGS_ENABLE: "true"
      MM_CALLSSETTINGS_RTCDSERVICEURL: "http://rtcd:8045"
```

Calls work on `localhost` without `ice_host_override` (host candidates are
local IPs).

---

## 5. Operations

### Logs & status

```bash
docker stack services lms                       # desired/running per service
docker service logs -f lms_lms-server           # backend
docker service logs -f lms_lms-fe               # frontend
docker service logs -f lms_rtcd                 # calls SFU
ssh -i ~/.ssh/lms_swarm root@<db-ip>            # node-level access
```

### Updating a release

```bash
cd deploy/swarm
TAG=v2 ./build-and-push.sh && ./deploy.sh       # build, push, rolling deploy
```

Swarm updates with `order: start-first` + automatic rollback on failure.
Manual rollback: `docker service rollback lms_lms-server`.

### Backups (do these on a schedule)

```bash
# Database (on the db node)
docker exec $(docker ps -qf name=lms_postgres) pg_dump -U mmuser mattermost \
  > backup-$(date +%F).sql

# Uploads (on the backend node — stop minio or snapshot the volume)
docker run --rm -v lms_miniodata:/data -v $PWD:/backup alpine \
  tar czf /backup/minio-$(date +%F).tgz -C /data .

# rtcd client keys (video node) — volume rtcd_data
```

Secrets live in Swarm's encrypted raft store; re-record them somewhere safe
(password manager) — `secrets-bootstrap.sh` deliberately never overwrites.

### Monitoring

Prometheus scrapes `lms-server:8067/metrics` (API latencies, websocket counts,
DB health, calls metrics). Grafana at `https://grafana.<domain>` ships with
the Prometheus datasource auto-provisioned — drop dashboards into the
`grafana-dashboards` volume to have them auto-loaded.

### Tear down

```bash
docker stack rm lms
cd infrastructure/terraform && terraform destroy -var-file=envs/dev.tfvars
```

---

## 6. Troubleshooting

| Symptom | Likely cause → fix |
|---|---|
| Login page loops / API 401 on `app.<domain>` | You're hitting `api.<domain>` directly from the app, or cookies blocked. Always use `https://app.<domain>`; check the Traefik `lms-server-chat` router (PathPrefix `/api/v4`, priority 100) exists. |
| Chat loads but no messages arrive | WebSocket not upgraded — confirm `wss://api.<domain>/api/v4/websocket` in the browser network tab, and that Traefik is not buffering (it upgrades automatically; check service logs). |
| Certificate invalid / TLS errors | DNS for the subdomain doesn't point at the manager yet, or Let's Encrypt rate-limited (wait 1 h, check `docker service logs lms_traefik`). |
| `docker stack deploy` can't pull images | Registry auth not distributed → re-run `./registry-auth.sh`, deploy with `--with-registry-auth` (deploy.sh does). |
| lms-server crash-loops | `docker service logs` → usually DB unreachable (DSN secret wrong) or MinIO creds mismatch. Recreate secret: `docker secret rm db_dsn && ./secrets-bootstrap.sh` then redeploy. |
| Calls button does nothing / "rtcd not configured" | `MM_CALLSSETTINGS_ENABLE` / `RTCDSERVICEURL` missing on lms-server, or rtcd down (`docker service ps lms_rtcd`). |
| Call connects, no audio/video between remote peers | Media blocked: video-node firewall must allow **UDP 8443 in+out** (and TCP 8443 fallback); set `ice_host_override` to the video node's **public** IP; test in two different networks. |
| Call works on same Wi-Fi only | Classic symptom of missing `ice_host_override` / firewall — browsers fall back to host candidates which only work locally. |
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
| `MM_FILESETTINGS_AMAZONS3*` | MinIO/S3 uploads (endpoint, bucket, keys) |
| `MM_SERVICESETTINGS_SITEURL` | `https://<domain>` in production |
| `MM_CALLSSETTINGS_ENABLE` | turn the native calls feature on |
| `MM_CALLSSETTINGS_RTCDSERVICEURL` | rtcd control endpoint (service name on the overlay) |
| `MM_CALLSSETTINGS_ICESERVERS` | comma-separated `stun:`/`turn:` URLs for browsers |
| `MM_CALLSSETTINGS_MAXCALLPARTICIPANTS` | per-call limit (0 = unlimited) |
| `MM_METRICSSETTINGS_*` | Prometheus metrics on :8067 |

See `deploy/swarm/stack.yml` and the root `docker-compose.yml` for the full,
commented set used in each deployment mode.
