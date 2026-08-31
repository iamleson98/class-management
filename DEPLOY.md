# Deployment Guide — LMS System on Contabo with Docker Swarm

This guide covers the full production deployment: **frontend + Go backend +
rtcd calls SFU + rustfs object storage**, on Docker Swarm, on Contabo
servers, with CI/CD through GitHub Actions and GitHub Container Registry.

> For local development, see `README.md`. The operator's quick reference for
> the Swarm layer is `deploy/swarm/README.md`.

## Table of Contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Quick start (single node)](#quick-start-single-node)
4. [Provisioning Contabo servers](#provisioning-contabo-servers)
5. [Forming the Swarm](#forming-the-swarm)
6. [Secrets](#secrets)
7. [Deploying](#deploying)
8. [CI/CD pipeline](#cicd-pipeline)
9. [Calls (rtcd) in production](#calls-rtcd-in-production)
10. [Operations](#operations)
11. [Backup & restore](#backup--restore)
12. [Security hardening checklist](#security-hardening-checklist)
13. [Troubleshooting](#troubleshooting)

---

## Architecture

### Components

| Component | Image | Role |
|---|---|---|
| **traefik** | `traefik:v3.7.12` | Edge reverse proxy. TLS (Let's Encrypt), HTTP→HTTPS redirect, routes by Host/Path to the services behind it. |
| **lms-fe** | `ghcr.io/iamleson98/lms-fe` | Next.js frontend (standalone build, bun runtime). |
| **lms-server** | `ghcr.io/iamleson98/lms-server` | Go backend (REST + WebSocket + LMS business logic + calls control plane). |
| **lms-rtcd** | `ghcr.io/iamleson98/lms-rtcd` | WebRTC SFU for calls — owns the media plane. |
| **postgres** | `postgres:16-alpine` | Relational store. |
| **rustfs** | `rustfs/rustfs:1.0.0-rc.4` | S3-compatible object storage for file uploads (Apache-2.0, Rust). |
| **prometheus / grafana** | upstream images | Metrics + dashboards. |

### Topology

```
                        Internet
                           │
        ┌──────────────────┴──────────────────┐
        │  Contabo manager node               │
        │  traefik :80/:443 (ingress)         │
        │   ├─ app.DOMAIN          → lms-fe   │
        │   ├─ app.DOMAIN/api/v4/* → lms-server (priority 100)
        │   ├─ api.DOMAIN          → lms-server
        │   ├─ s3.DOMAIN           → rustfs console
        │   ├─ grafana.DOMAIN      → grafana  │
        │   └─ traefik.DOMAIN      → dashboard│
        │                                      │
        │  lms_overlay (encrypted VXLAN)       │
        │   ├─ lms-server :8065 (API/WS) :8067 (metrics)
        │   ├─ postgres   :5432                │
        │   ├─ rustfs     :9000 (S3) :9001     │
        │   └─ lms-rtcd   :8045 (control)      │
        └──────────┬───────────────────────────┘
                   │ 8443/udp + 8443/tcp, HOST mode
                   ▼
        Contabo video node (lms-rtcd task)
        ICE host candidate = node public IP
```

Single-node setup: every service (including rtcd) runs on the manager —
that is the default configuration.

### Data flow decisions (why it looks like this)

- **Same-origin API**: the browser loads the app from `app.DOMAIN` and calls
  `/api/v4/*` on the *same* origin. Traefik routes that path prefix straight
  to `lms-server` (priority 100). This keeps the `httpOnly` `MMAUTHTOKEN`
  cookie first-party for both REST and the WebSocket — no `SameSite=None`,
  no cross-origin CORS, and cookie auth "just works".
- **Media bypasses the proxy**: browser ↔ rtcd media (RTP/RTCP over ICE)
  never touches Traefik. rtcd's media port is published in **host** mode and
  the node's public IP is advertised in ICE candidates
  (`RTCD_ICE_HOST_OVERRIDE`), so candidates match the socket that receives
  the packets.
- **S3 stays internal**: browsers fetch files through the backend API; rustfs
  is reachable only on the overlay network. The bucket stays fully private.
  (Presigned URLs are disabled — the default.)
- **Stateless tiers scale**: `lms-server` and `lms-fe` can run with
  `replicas > 1` (Traefik load-balances). postgres, rustfs and rtcd are
  single-writer services pinned to one node each.

---

## Prerequisites

- A **domain** you control (DNS A records) — e.g. `example.com`.
- A **Contabo account** (Cloud VPS or VDS). Minimum recommended for the
  whole stack on one node: 4 vCPU / 8 GB (8 vCPU / 16 GB comfortable —
  postgres + Go server + rustfs + rtcd + Next.js + observability).
- OS: Ubuntu 22.04/24.04 (the cloud-init targets Ubuntu).
- **GitHub** (this repo): Actions enabled, and permission to create
  repository secrets/variables.

### DNS records

| Record | Points to | Serves |
|---|---|---|
| `app.<domain>` | manager public IP | frontend + API (same origin) |
| `api.<domain>` | manager public IP | backend API (direct) |
| `s3.<domain>` | manager public IP | rustfs console |
| `grafana.<domain>` | manager public IP | Grafana |
| `traefik.<domain>` | manager public IP | Traefik dashboard |

---

## Quick start (single node)

The fastest path to a working production deployment:

```bash
# 1. Create one Contabo VPS (Ubuntu 24.04), paste
#    deploy/cloud-init/contabo.yaml into the cloud-init field
#    (replace ${ssh_public_key} with your public key first!)
#
#    ── after it boots ──
ssh root@<server-ip> 'cloud-init status --wait'    # wait for "done"

# 2. Form a single-node swarm
ssh deploy@<server-ip>
docker swarm init --advertise-addr <server-ip>

# 3. Get the code onto the server and configure it
git clone https://github.com/iamleson98/class-management /opt/lms-src
cd /opt/lms-src/deploy/swarm
cp .env.example .env
# EDIT .env: DOMAIN, ACME_EMAIL, TRAEFIK_AUTH (htpasswd -nB admin),
#            RTCD_ICE_HOST_OVERRIDE=<server public IP>, TAG
./secrets-bootstrap.sh

# 4. Build & push the images (from your workstation, one-time manual setup):
#    cd class-management && deploy/swarm/build-and-push.sh
#    (or set up CI/CD — recommended, see below — and let GitHub do it)

# 5. Deploy
./deploy.sh
```

After the rollout, `https://app.<domain>` is live (the first hit may take a
few extra seconds while Let's Encrypt issues the certificate).

---

## Provisioning Contabo servers

Two supported paths. Both install Docker, tune sysctls, set up the firewall,
and create a `deploy` user.

### Option A — cloud-init (manual, any number of nodes)

When creating each server in the Contabo panel, paste
[`deploy/cloud-init/contabo.yaml`](deploy/cloud-init/contabo.yaml) into the
cloud-init field, replacing `${ssh_public_key}` with your public key.

What it does:

- Docker CE + buildx + compose from the official apt repository
- sysctls: conntrack table size, UDP buffer sizes (rtcd), rp_filter off
- `daemon.json`: log rotation (10m × 3), live-restore, private address pools
- ufw baseline: 22, 80, 443, 8443/tcp+udp public; 2377, 7946, 4789 for swarm
- `deploy` user (sudo + docker group) with your SSH key
- unattended security upgrades

### Option B — Terraform

```bash
export CONTABO_CLIENT_ID=... CONTABO_CLIENT_SECRET=...
export CONTABO_USER=... CONTABO_PASS=...

cd infrastructure/terraform-contabo
cp envs/contabo.tfvars.example envs/contabo.tfvars
$EDITOR envs/contabo.tfvars           # product IDs + your public key
terraform init && terraform apply -var-file=envs/contabo.tfvars
terraform output swarm_setup_instructions
```

Nodes: manager (always), optional `db` (postgres + rustfs) and `video`
(rtcd) nodes. See `infrastructure/terraform-contabo/README.md`.

> ⚠️ Contabo API semantics: changing `user_data`, `ssh_keys` or `image_id`
> **reinstalls** the instance. Review `terraform plan` carefully.

### Firewall summary (per node)

| Port | Protocol | Scope | Purpose |
|---|---|---|---|
| 22 | tcp | anywhere (or restricted) | SSH |
| 80, 443 | tcp | public | Traefik ingress |
| 8443 | tcp+udp | public, **video node only** | rtcd ICE media |
| 2377 | tcp | swarm nodes | cluster management |
| 7946 | tcp+udp | swarm nodes | gossip |
| 4789 | udp | swarm nodes | VXLAN overlay |

Note: Docker publishes container ports through its own iptables rules, so
ufw only guards host services — the stack file controls what containers
publish.

---

## Forming the Swarm

```bash
# On the manager:
docker swarm init --advertise-addr <manager-ip>

# Join workers (run on each worker):
docker swarm join --token <token> <manager-ip>:2377

# Tag roles on the manager (multi-node only):
docker node update --label-add role=db <db-node>
docker node update --label-add role=video <video-node>
docker node update --label-add role=backend <backend-node>
```

Then set the matching placement overrides in `deploy/swarm/.env`:

```env
DB_PLACEMENT=node.labels.role == db
RUSTFS_PLACEMENT=node.labels.role == db
RTCD_PLACEMENT=node.labels.role == video
BACKEND_PLACEMENT=node.labels.role == backend
```

Defaults keep everything on the manager — single-node swarms need no
placement configuration at all.

---

## Secrets

`deploy/swarm/secrets-bootstrap.sh` creates five Docker secrets on the
manager (idempotent — existing secrets are never touched):

| Secret | Used by | Notes |
|---|---|---|
| `db_password` | postgres | `POSTGRES_PASSWORD_FILE` (native) |
| `db_dsn` | lms-server | assembled `postgres://…` (entrypoint shim) |
| `rustfs_access_key` | rustfs, lms-server, rustfs-init | `RUSTFS_ACCESS_KEY_FILE` (native in rustfs) |
| `rustfs_secret_key` | rustfs, lms-server | `RUSTFS_SECRET_KEY_FILE` / shim |
| `grafana_admin_password` | grafana | `GF_SECURITY_ADMIN_PASSWORD_FILE` (native) |

Docker secrets cannot be read back after creation, so rotation is always a
deliberate remove-and-recreate (the script prints the exact procedure).
The CI/CD pipeline deliberately does **not** manage these — creating swarm
secrets remotely would require shipping the values through SSH; run the
bootstrap once on the manager instead.

---

## Deploying

### Automated (recommended): push to `master`

See [CI/CD pipeline](#cicd-pipeline) — on every push to `master`, GitHub
Actions builds the images, pushes them to GHCR and deploys to your manager
over SSH.

### Manual

```bash
# On the manager:
cd deploy/swarm
TAG=sha-<commit> ./deploy.sh     # or TAG=latest

# From a workstation, against a remote manager:
DOCKER_HOST=ssh://deploy@<manager-ip> ./deploy.sh
```

`deploy.sh`:

1. validates `.env` (required vars, secrets present, config files exist)
2. logs in to GHCR when credentials are configured (private packages)
3. `docker stack deploy --with-registry-auth lms` (auth propagates to
   workers so they can pull)
4. waits for the rollout to converge (up to `ROLLOUT_TIMEOUT`, default 300s)
5. smoke-tests `https://app.<domain>/api/v4/system/ping` and friends

### Rollback

```bash
./rollback.sh                # revert to the previous stack spec
./rollback.sh sha-1a2b3c4    # redeploy an older immutable tag
```

---

## CI/CD pipeline

Three workflows (`.github/workflows/`):

| Workflow | Trigger | What it does |
|---|---|---|
| `lms-ci.yml` | PR + push to master | Go build/vet/tests (calls suite with `-race`, model suite), rtcd build/tests, frontend lint/tests/build, docker build of all 3 images (no push) |
| `lms-deploy.yml` | push to master + manual | Builds & pushes `lms-server`, `lms-fe`, `lms-rtcd` to GHCR (`sha-<short>` immutable + `master` rolling tags), then deploys over SSH |
| `lms-rollback.yml` | manual | Quick stack rollback or redeploy of a pinned tag |

### Pipeline flow

```
push to master
  → LMS CI (tests + image build validation)
  → LMS Deploy
      ├─ build-push (matrix: 3 images) → ghcr.io/iamleson98/*
      │    tags: sha-abc1234 (immutable, what gets deployed) + master
      └─ deploy (needs: build-push)
           ├─ tar deploy/swarm + deploy/images + observability → scp to manager
           ├─ render .env from GitHub vars/secrets → scp (secrets never in ps)
           └─ ssh: TAG=sha-abc1234 deploy.sh
                 → stack deploy → rollout wait → smoke tests
```

### Required repository configuration

**Secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `CONTABO_SSH_KEY` | private SSH key for the manager (the `deploy` user's key) |
| `LMS_TRAEFIK_AUTH` | `htpasswd -nB admin` output (Traefik dashboard) |
| `GHCR_PAT` | *optional* — PAT with `read:packages`, only if the GHCR packages are private |
| `CONTABO_KNOWN_HOSTS` | *optional* — `ssh-keyscan <manager-host>` output (pins the host key instead of TOFU) |

**Variables** (same settings page, "Variables" tab):

| Variable | Value |
|---|---|
| `CONTABO_SSH_HOST` | manager public IP / hostname |
| `CONTABO_SSH_USER` | `deploy` (or `root`) |
| `CONTABO_SSH_PORT` | `22` (if nonstandard) |
| `LMS_DOMAIN` | base domain, e.g. `example.com` |
| `LMS_ACME_EMAIL` | Let's Encrypt email |
| `LMS_RTCD_PUBLIC_IP` | public IPv4 of the rtcd node |

The deploy workflow also expects a GitHub **environment** named
`production` (create it empty — it gives you a deployment history and an
optional approval gate).

### One-time GHCR setup

The packages (`lms-server`, `lms-fe`, `lms-rtcd`) are created on first push
and default to **private**. For simplicity make them public (Packages →
each package → Settings → Change visibility) — no login is then needed on
the servers. To keep them private: create a PAT with `read:packages`, store
it as the `GHCR_PAT` secret; the workflow drops it on the manager as
`/opt/lms/.ghcr-token` and `deploy.sh` logs in with it.

---

## Calls (rtcd) in production

- **`RTCD_ICE_HOST_OVERRIDE` must be the public IPv4 of the node the rtcd
  task runs on.** It is baked into the ICE host candidates handed to
  browsers. On Contabo this is simply the VPS's public IP.
- Media ports (`8443/udp` + `8443/tcp` by default, `RTCD_MEDIA_PORT`) are
  published in **host mode** — verify the port is open end-to-end:
  ```bash
  # from an external machine:
  nc -vz <video-node-ip> 8443          # tcp leg
  ```
- The control API (`:8045`) is reachable only inside the overlay; the
  backend self-registers as a client on first connect
  (`MM_CALLSSETTINGS_RTCDSERVICEURL=http://rtcd:8045`).
- Client registration credentials persist in the `rtcd_data` volume — do not
  delete it between deploys, or the backend will register a new client ID
  (old sessions on the SFU are orphaned until it restarts).
- **TURN**: add a TURN server when participants sit behind corporate
  NATs/firewalls that block direct UDP:
  ```env
  MM_CALLSSETTINGS_ICESERVERS=stun:stun.l.google.com:19302,turn:turn.example.com:3478
  ```
  (Deploy coturn separately — e.g. `coturn/coturn` on the video node — and
  set the shared secret in the server's `TURNStaticAuthSecret` config.)
- Capacity: one rtcd task comfortably serves ~30–50 call participants on a
  4-vCPU/8GB node (video is CPU-bound; scale by adding rtcd instances behind
  separate host ports/nodes and letting calls spread — each call pins to one
  SFU via the backend's client connection).

---

## Operations

### Daily commands

```bash
docker stack services lms                     # overview + replicas
docker stack ps lms                           # task placement/state
docker service logs lms_lms-server --tail 200 -f
docker service logs lms_lms-rtcd --tail 200 -f
docker node ls                                # nodes, labels, availability
```

### Scaling

```bash
docker service scale lms_lms-server=2 lms_lms-fe=2
```

Stateful services (postgres/rustfs/rtcd) do not scale horizontally in this
stack. To move them to a bigger node: set the placement in `.env`, redeploy,
then migrate the volume (see [Backup & restore](#backup--restore)).

### Updates

CI deploys are rolling: `start-first` for the stateless services (zero
downtime), `stop-first` for the stateful ones (ports/volumes must be
released first). If a healthcheck fails mid-rollout, the stateless services
auto-rollback to the previous spec; stateful services pause for inspection.

### Logs

All services log to `json-file` with rotation (10 MB × 3 files per
container) — bounded disk usage out of the box.

---

## Backup & restore

The state that matters: **postgres** (`pgdata` volume) and **rustfs**
(`rustfs_data` volume). Everything else is reproducible from images +
config. Traefik's `traefik_certs` volume (Let's Encrypt certs) is
regenerable but worth including to avoid re-issuing.

```bash
# On the node running the service (find it: docker stack ps lms | grep postgres):
docker run --rm -v lms_pgdata:/data -v $(pwd):/backup alpine \
    tar czf /backup/pgdata-$(date +%F).tgz -C /data .

docker run --rm -v lms_rustfs_data:/data -v $(pwd):/backup alpine \
    tar czf /backup/rustfs-$(date +%F).tgz -C /data .

# Postgres-consistent dump alternative (preferred for the DB):
docker exec $(docker ps -qf name=lms_postgres) \
    pg_dump -U mmuser mattermost | gzip > mattermost-$(date +%F).sql.gz
```

Restore: stop the service (`docker service scale lms_postgres=0`), restore
the volume contents, scale back up. Schedule with cron/systemd-timers on the
db node; ship archives off-node (Contabo Object Storage, rsync, …).

---

## Security hardening checklist

- [ ] SSH: key-only login (`PasswordAuthentication no`), no root login when
      the `deploy` user works
- [ ] `CONTABO_KNOWN_HOSTS` secret set (pins the manager host key)
- [ ] GHCR packages private + `GHCR_PAT` if the repo is private
- [ ] Traefik dashboard password is strong (`htpasswd -nB admin`)
- [ ] rustfs console (`s3.<domain>`) removed from the stack if unused
- [ ] Grafana admin password rotated after first login
- [ ] Firewall: 8443 open only on the video node; 2377/7946/4789 restricted
      to the swarm nodes' IPs if you run multi-node
- [ ] Backups scheduled and tested (restore at least once)
- [ ] `docker node ls` reviewed after any infra change (no stray nodes)

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Deploy fails: `secret … is missing` | Bootstrap not run | `./secrets-bootstrap.sh` |
| Deploy fails: `set TAG in .env` | No image tag | `TAG=sha-… ./deploy.sh` |
| Rollout stuck, `docker stack ps` shows `Pending` | Placement constraint matches no node | check `docker node ls` labels vs `*_PLACEMENT` in `.env` |
| `lms-server` restarting, logs: DB connect refused | postgres still starting | self-heals via restart policy; check `docker service logs lms_postgres` |
| 500 on file upload | bucket missing / S3 creds | `docker service logs lms_rustfs-init`; re-run init task: `docker service update --force lms_rustfs-init` |
| Certificate errors on first hit | Let's Encrypt issuance lag / DNS | wait; `docker service logs lms_traefik` shows ACME activity |
| Calls connect, then drop after ~5s | ICE failure (media blocked) | verify `RTCD_ICE_HOST_OVERRIDE` = node public IP and 8443/udp is open; add TURN |
| Calls stuck "connecting" for remote users | strict NAT | deploy coturn and set `MM_CALLSSETTINGS_ICESERVERS` with a `turn:` URL |
| Chat WebSocket 401 | cookie lost (cross-origin access) | always use `https://app.<domain>` — never the raw `:3000/:8065` ports |
| Worker can't pull image | no registry auth | deploy with `--with-registry-auth` (deploy.sh does) + valid `GHCR_PAT` for private packages |
| `docker stack deploy` interpolation error `$` | unescaped `$` in env values | keep `$` as `$$` in the stack file; values from `.env` need no escaping |

---

## Appendix: file map

```
deploy/
  cloud-init/contabo.yaml        node bootstrap (Docker, sysctls, ufw, deploy user)
  images/
    rtcd.Dockerfile              rtcd image (build context = repo root!)
    rtcd-config.template.toml    config rendered from RTCD_* env at start
    rtcd-entrypoint.sh           renderer + exec
  swarm/
    stack.yml                    the Swarm stack
    .env.example                 every tunable, documented
    secrets-bootstrap.sh         one-time Docker secrets
    deploy.sh                    deploy + rollout wait + smoke tests
    rollback.sh                  rollback helpers
    build-and-push.sh            manual image build/push to GHCR
    configs/prometheus.yml       scrape config (Docker config)
    rtcd/config.toml.example     reference config
infrastructure/terraform-contabo/  optional IaC for the Contabo nodes
.github/workflows/lms-ci.yml    tests + image validation
.github/workflows/lms-deploy.yml  build → GHCR → SSH deploy
.github/workflows/lms-rollback.yml manual rollback
```
