# Deployment Guide — LMS System on Contabo Docker Swarm

This is the **complete, follow-along production deployment runbook** for
**frontend + Go backend + rtcd calls SFU + rustfs object storage**, on
Docker Swarm, on Contabo servers in the **Singapore region** (closest
Contabo location to Vietnam), with CI/CD through GitHub Actions and GHCR.

It is written to be executed top-to-bottom: every phase lists exactly what
to run, what you should see when it works, and where to look when it
doesn't. Estimated end-to-end time for a first deployment: **60–90
minutes** (plus DNS propagation).

> For local development, see `README.md`. The operator's quick reference
> for the Swarm layer is `deploy/swarm/README.md`.

## Table of Contents

1. [Architecture](#architecture)
2. [Server planning (region, sizing, price)](#server-planning)
3. [Prerequisites](#prerequisites)
4. [Phase 1 — Provision the servers](#phase-1--provision-the-servers)
5. [Phase 2 — Form the Swarm](#phase-2--form-the-swarm)
6. [Phase 3 — Create the Docker secrets](#phase-3--create-the-docker-secrets)
7. [Phase 4 — Publish the images](#phase-4--publish-the-images)
8. [Phase 5 — Configure and deploy](#phase-5--configure-and-deploy)
9. [Phase 6 — Verify the deployment](#phase-6--verify-the-deployment)
10. [CI/CD pipeline](#cicd-pipeline)
11. [Calls (rtcd) in production](#calls-rtcd-in-production)
12. [Operations](#operations)
13. [Capacity & scaling](#capacity--scaling)
14. [Separated frontend deployment](#separated-frontend-deployment)
15. [Backup & restore](#backup--restore)
16. [Security hardening checklist](#security-hardening-checklist)
17. [Troubleshooting](#troubleshooting)
18. [Appendix](#appendix)

---

## Architecture

### What you are deploying

| Component | Image | Role |
|---|---|---|
| **traefik** | `traefik:v3.7.12` | Edge reverse proxy. TLS (Let's Encrypt), HTTP→HTTPS redirect, routes by Host to the services behind it (proxies WebSocket upgrades natively). |
| **lms-fe** | `ghcr.io/iamleson98/lms-fe` | Next.js frontend (standalone build, **Node runtime**). Its server ALSO reverse-proxies `/api/v4` — REST and the WebSocket upgrade — to `LMS_BACKEND_URL` at runtime (`run-server.js` + `lib/api-proxy.js`). |
| **lms-server** | `ghcr.io/iamleson98/lms-server` | Go backend (REST + WebSocket + LMS business logic + calls control plane). |
| **lms-rtcd** | `ghcr.io/iamleson98/lms-rtcd` | WebRTC SFU for calls — owns the media plane. Horizontally scalable as a **pool** (`lms-rtcd`, `lms-rtcd2`, …). |
| **postgres** | `postgres:16-alpine` | Relational store. |
| **rustfs** | `rustfs/rustfs:1.0.0-rc.4` | S3-compatible object storage for file uploads (Apache-2.0, Rust). |
| **prometheus / grafana** | upstream images | Metrics + dashboards. |

### Topology

```
                        Internet
                           │
        ┌──────────────────┴──────────────────┐
        │  Contabo manager node (Singapore)   │
        │  traefik :80/:443 (ingress)         │
        │   ├─ app.DOMAIN → lms-fe            │
        │   │     └─ /api/v4/* (REST + WS)    │
        │   │        proxied by lms-fe to the │
        │   │        backend (LMS_BACKEND_URL) │
        │   ├─ api.DOMAIN          → lms-server
        │   ├─ s3.DOMAIN           → rustfs console
        │   ├─ grafana.DOMAIN      → grafana  │
        │   └─ traefik.DOMAIN      → dashboard│
        │                                      │
        │  lms_overlay (encrypted VXLAN)       │
        │   ├─ lms-server :8065 (API/WS) :8067 (metrics)
        │   ├─ postgres   :5432                │
        │   ├─ rustfs     :9000 (S3) :9001     │
        │   └─ rtcd(-pool):8045 (control)      │
        └──────┬───────────────┬──────────────┘
               │ 8443/udp+tcp  │ 8443/udp+tcp, HOST mode
               ▼               ▼
     Contabo video node    Contabo video node
     (lms-rtcd task)       (lms-rtcd2 task, optional)
     ICE host candidate = each node's public IP
```

Single-node setup: every service (including rtcd) runs on the manager —
that is the default configuration. The multi-node layout is Phase 5's
"production profile".

### Data flow decisions (why it looks like this)

- **Same-origin API (frontend-owned proxy)**: the browser loads the app
  from `app.DOMAIN` and talks to `/api/v4/*` — REST *and* the chat/calls
  WebSocket — on the *same* origin. The frontend's own server
  (`run-server.js`) reverse-proxies that namespace to the backend over the
  (overlay) network, relaying the WebSocket upgrade over a raw socket pair.
  This keeps the `httpOnly` `MMAUTHTOKEN` cookie first-party for REST, the
  chat WS and the calls WS — no `SameSite=None`, no cross-origin CORS, no
  token plumbing. And because the proxy target is a **runtime** env var
  (`LMS_BACKEND_URL`), the very same image also serves a frontend deployed
  on a different server/domain than the backend (see
  [Separated frontend deployment](#separated-frontend-deployment)).
- **Media bypasses the proxy**: browser ↔ rtcd media (RTP/RTCP over ICE)
  never touches Traefik. rtcd's media port is published in **host** mode and
  each node's public IP is advertised in ICE candidates
  (`RTCD_ICE_HOST_OVERRIDE`), so candidates match the socket that receives
  the packets.
- **S3 stays internal**: browsers fetch files through the backend API;
  rustfs is reachable only on the overlay network. The bucket stays fully
  private. (Presigned URLs are disabled — the default.)
- **Stateless tiers scale; media scales as a pool**: `lms-fe` runs with
  `replicas > 1` (Traefik load-balances). `lms-server` stays **one replica**
  (per-call state lives in its memory — see
  [Capacity & scaling](#capacity--scaling)) and scales vertically. rtcd
  scales **horizontally** as a DNS-discovered pool: the backend keeps one
  control connection per SFU instance and spreads new calls across them.
- **Postgres and rustfs** are single-writer services pinned to one node.

---

## Server planning

This section is the sizing decision the rest of the runbook assumes.
Read it once, pick your profile, then follow the phases.

### Region: Singapore

Contabo operates nine regions; the two relevant to Vietnam are
**Singapore (SIN)** and **Tokyo (Japan)**. Singapore is the clear pick:

| From | → Singapore | → Tokyo | → Frankfurt (EU) |
|---|---|---|---|
| Ho Chi Minh City | **~25–45 ms** | ~60–80 ms | ~180–200 ms |
| Hanoi | ~45–70 ms | ~60–90 ms | ~190–210 ms |
| Da Nang | ~35–55 ms | ~70–90 ms | ~190–210 ms |

For a chat/collaboration workload with live audio, keep total RTT under
~100 ms — Singapore does that for the whole country; Frankfurt does not.
WebRTC media RTT from Vietnam to a Singapore SFU (~30–60 ms) is well
inside the comfortable range for classroom call quality.

Rules:

- **All nodes of one Swarm must be in the same region** (overlay VXLAN +
  raft consensus latency).
- Singapore instances carry a small **per-instance location fee** (shown
  at checkout) on top of the plan price — budget a few extra €/month.
- Prices below are Contabo's 2026 lineup, **approximate and pre-VAT**;
  confirm current prices at <https://contabo.com/en/vps/> and
  <https://contabo.com/en/vds/> (product IDs:
  <https://contabo.com/en/product-list/?show_ids=true>).

### What "1000 concurrent users" costs each component

The design target: **1000 concurrent signed-in users**, of which up to
**~500 join calls** across **20–30 live classrooms** (audio on for
everyone, teacher screen-share active per class). This matches a
class-management system's real traffic shape.

| Component | Sizing reasoning (per 1000 concurrent) |
|---|---|
| **lms-server** (Go) | 1000 WebSocket connections is a light load for Go; the costs are call-state broadcasts and REST. One replica **6 vCPU / 6 GB** is comfortable. Must stay 1 replica (see below). |
| **lms-fe** (Node) | Next.js SSR + the `/api/v4` proxy. Each task comfortably handles a few hundred users: **2 tasks × 1 vCPU / 1 GB**. |
| **postgres** | Connection pool ~100 (`MM_SQLSETTINGS_MAXCONNS`), working set in RAM: **6–8 vCPU / 16–32 GB**, NVMe storage. |
| **rustfs** | Uploads stream through the backend; modest: **1–2 vCPU / 2 GB** + disk sized to your content (start 50–100 GB). |
| **rtcd (SFU)** | CPU-bound media forwarding. One 8-vCPU instance ≈ **200–300 audio participants** + ~10 concurrent screen-shares. For ~500 call participants → **2 instances**. |

**Media bandwidth is the real constraint.** The SFU egress formula for a
call of `P` participants (all audio on) is `P × (P−1) × bitrate`:

| Scenario (per 30-student class) | SFU egress |
|---|---|
| Audio only (50 kbps/participant) | 30 × 29 × 50 kbps ≈ **43 Mbps** |
| + teacher screen share (2.5 Mbps) | + 29 × 2.5 Mbps ≈ **+73 Mbps** |
| + 5 student cameras (800 kbps each) | + 29 × 4 Mbps ≈ **+116 Mbps** |

For 20 concurrent classes, audio + share ≈ **2.3 Gbps aggregate** worst
case — spread across the pool's nodes. That is why video nodes need a
**≥500 Mbit/s port** (Contabo's higher tiers and the VDS line; the entry
plans' 200 Mbit/s port is too small for a busy SFU node), and why the app
enforces **one screen share per call** and `MM_CALLSSETTINGS_MAXCALLPARTICIPANTS`
is worth setting (~40).

### Recommended clusters (Contabo Singapore)

**Production profile — ~1000 concurrent users (the target of this guide):**

| Node | Runs | Contabo plan (approx.) | ~€/mo |
|---|---|---|---|
| `manager` | traefik, lms-fe ×2, prometheus, grafana, swarm control | Cloud VPS 4 — 4 vCPU / 8 GB | ~5 |
| `app` | lms-server | Cloud VPS 8 — 8 vCPU / 24 GB | ~11 |
| `db` | postgres + rustfs | Cloud VPS 12 — 12 vCPU / 48 GB | ~20 |
| `video1` | lms-rtcd | Cloud VDS 8 dedicated cores / 32 GB, 500 Mbit/s+ | ~47 |
| `video2` | lms-rtcd2 (SFU pool) | Cloud VDS 8 dedicated cores / 32 GB | ~47 |
| | | **Total** | **~€130** (+ location fees, + VAT) |

≈ €140–155/month all-in — roughly 4 million VND — for 1000 concurrent
users with working audio/video calls. Traffic is unmetered (fair use).

**Growth profile — ~500 concurrent, ≤10 classes (start here, upgrade in-place):**

| Node | Runs | Plan | ~€/mo |
|---|---|---|---|
| `manager` | traefik, lms-fe ×2, lms-server, observability | Cloud VPS 8 — 8 vCPU / 24 GB | ~11 |
| `db` | postgres + rustfs | Cloud VPS 8 — 8 vCPU / 24 GB | ~11 |
| `video1` | lms-rtcd | Cloud VDS 8 | ~47 |
| | | **Total** | **~€69** |

**Pilot profile — ≤150 concurrent, ≤4 audio classes:**

| Node | Runs | Plan | ~€/mo |
|---|---|---|---|
| `manager` (single node) | everything | Cloud VPS 8 — 8 vCPU / 24 GB | ~11 |

Everything in this guide works identically on the pilot profile — the
stack's defaults assume single-node. You scale up by adding nodes and
flipping placement variables in `.env`, **never** by rebuilding images.

> **When to prefer another provider:** Contabo buys you the best
> price-per-spec available, with honest-but-budget network peering. If you
> later need premium network quality for media only (e.g., persistent
> congestion to Vietnamese ISPs), the rtcd pool nodes can live on any
> provider's Singapore VPS — the stack is plain Docker Swarm + Ubuntu; use
> the cloud-init in Phase 1 on any host. Premium-APAC options cost ~2–3×
> Contabo for the same spec (Vultr/DigitalOcean/Datapod Singapore; Hetzner
> has no Asia region; OVH has Singapore).

---

## Prerequisites

Before Phase 1, gather:

- [ ] A **domain** you control (able to create A records). Examples use
      `example.com` — replace with yours everywhere.
- [ ] A **Contabo account** with a payment method.
- [ ] An SSH **key pair** on your workstation
      (`ssh-keygen -t ed25519 -f ~/.ssh/lms -C "lms-deploy"` → use
      `~/.ssh/lms.pub` whenever a public key is asked for).
- [ ] The GitHub repo (`iamleson98/class-management`) with **Actions
      enabled** and permission to create repository secrets/variables.
- [ ] On your workstation: `ssh`, `git`, `curl`, `dig` (dnsutils). Docker
      is only needed if you choose to build images manually (Phase 4,
      Option B).

### DNS records (create when the manager IP is known — Phase 1)

| Record | Points to | Serves |
|---|---|---|
| `app.<domain>` | manager public IP | frontend + API (same origin) |
| `api.<domain>` | manager public IP | backend API (direct) |
| `s3.<domain>` | manager public IP | rustfs console |
| `grafana.<domain>` | manager public IP | Grafana |
| `traefik.<domain>` | manager public IP | Traefik dashboard |

### Placeholders cheat sheet

Every value you must substitute while following this guide:

| Placeholder | What it is | First needed |
|---|---|---|
| `<domain>` | your base domain, e.g. `lms.edu.vn` | DNS, `.env` |
| `<manager-ip>` | public IPv4 of the manager node | DNS, swarm init |
| `<app-ip>` | public IPv4 of the app node (multi-node) | swarm join |
| `<db-ip>` | public IPv4 of the db node (multi-node) | swarm join |
| `<video1-ip>` | public IPv4 of video node 1 | `.env` (`RTCD_ICE_HOST_OVERRIDE`) |
| `<video2-ip>` | public IPv4 of video node 2 (pool) | `.env` (`RTCD2_ICE_HOST_OVERRIDE`) |
| `<acme-email>` | email for Let's Encrypt notices | `.env` |
| `<tag>` | image tag: `sha-<short-commit>` or `master` | `.env` / deploy |


---

## Phase 1 — Provision the servers

Two supported paths. Both install Docker, tune sysctls, set up the
firewall, and create a `deploy` user. Do this **for every node**.

### Option A — the Contabo panel with cloud-init (manual)

1. Log in at <https://contabo.com> → **Cloud VPS / Cloud VDS** → configure
   the plan you chose in [Server planning](#server-planning):
   - **Region: Singapore**
   - **Image: Ubuntu 24.04** (the cloud-init targets Ubuntu; 22.04 works too)
   - **Login data: SSH key** — paste your `~/.ssh/lms.pub` (register it in
     Contabo first if the panel asks)
2. Open the **cloud-init / user data** field (during creation or later via
   *Reinstall with cloud-init*) and paste the contents of
   [`deploy/cloud-init/contabo.yaml`](deploy/cloud-init/contabo.yaml),
   replacing `${ssh_public_key}` with your public key line.
3. Create the instance. Repeat for each node of your profile.

What the cloud-init does on each node:

- Docker CE + buildx + compose from the official apt repository
- sysctls for Swarm + WebRTC: conntrack table, UDP buffer sizes, rp_filter off
- `daemon.json`: log rotation (10m × 3), live-restore, private address pools
- ufw baseline: 22, 80, 443, 8443/tcp+udp public; 2377, 7946, 4789 for swarm
- `deploy` user (sudo + docker group) with your SSH key
- unattended security upgrades

### Option B — Terraform (IaC)

```bash
export CONTABO_CLIENT_ID=... CONTABO_CLIENT_SECRET=...
export CONTABO_USER=... CONTABO_PASS=...

cd infrastructure/terraform-contabo
cp envs/contabo.tfvars.example envs/contabo.tfvars
$EDITOR envs/contabo.tfvars           # region=SIN, product IDs, your public key
terraform init && terraform apply -var-file=envs/contabo.tfvars
terraform output swarm_setup_instructions
```

Nodes: manager (always), optional `db` (postgres + rustfs), `video`
(rtcd) and `video2` (second SFU). See
`infrastructure/terraform-contabo/README.md`.

> ⚠️ Contabo API semantics: changing `user_data`, `ssh_keys` or `image_id`
> **reinstalls** the instance. Review `terraform plan` carefully.

### ✅ Checkpoint — every node answers

From your workstation, for **each** node IP:

```bash
ssh -i ~/.ssh/lms root@<node-ip> 'cloud-init status --wait; docker --version'
# expect: "status: done" and "Docker version 2x.x.x, build ..."

ssh -i ~/.ssh/lms deploy@<node-ip> 'docker ps && sudo -n true && echo sudo-ok'
# expect: empty table header + "sudo-ok" (the deploy user works)
```

If `cloud-init status --wait` hangs > 5 minutes, see
[Troubleshooting](#troubleshooting).

---

## Phase 2 — Form the Swarm

**On the manager:**

```bash
ssh -i ~/.ssh/lms deploy@<manager-ip>

docker swarm init --advertise-addr <manager-ip>

# print the worker join command:
docker swarm join-token worker
#   Output: docker swarm join --token SWMTKN-1-... <manager-ip>:2377
```

**On every other node** (app / db / video1 / video2):

```bash
ssh -i ~/.ssh/lms deploy@<app-ip>
docker swarm join --token SWMTKN-1-... <manager-ip>:2377
# expect: "This node joined a swarm as a worker."
```

**Back on the manager — label the nodes by role** (multi-node only):

```bash
docker node update --label-add role=app    <app-hostname>
docker node update --label-add role=db     <db-hostname>
docker node update --label-add role=video  <video1-hostname>
docker node update --label-add rtcd=2      <video2-hostname>   # SFU pool node
```

(Find hostnames with `docker node ls`. Single-node deployments skip all
of this — the stack defaults place everything on the manager.)

### ✅ Checkpoint

```bash
docker node ls
# expect: manager "Leader Active", every worker "Ready Active",
# with the labels you set visible under AVAILABILITY/nodes.
```

### Firewall summary (per node, already applied by cloud-init)

| Port | Protocol | Scope | Purpose |
|---|---|---|---|
| 22 | tcp | anywhere (or restricted) | SSH |
| 80, 443 | tcp | public | Traefik ingress |
| 8443 | tcp+udp | public, **video nodes only** | rtcd ICE media |
| 2377 | tcp | swarm nodes | cluster management |
| 7946 | tcp+udp | swarm nodes | gossip |
| 4789 | udp | swarm nodes | VXLAN overlay |

Note: Docker publishes container ports through its own iptables rules, so
ufw only guards host services — the stack file controls what containers
publish.

---

## Phase 3 — Create the Docker secrets

**On the manager only:**

```bash
git clone https://github.com/iamleson98/class-management /opt/lms-src
cd /opt/lms-src/deploy/swarm
./secrets-bootstrap.sh
```

The script (idempotent — existing secrets are never touched) creates:

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

### ✅ Checkpoint

```bash
docker secret ls
# expect 5 secrets. If a later deploy says "secret ... is missing",
# re-run ./secrets-bootstrap.sh.
```

---

## Phase 4 — Publish the images

The stack pulls `lms-server`, `lms-fe`, `lms-rtcd` from GHCR
(`ghcr.io/iamleson98/*`). Two ways to get them there:

### Option A — let CI do it (recommended)

If you will wire CI/CD anyway (next section), the simplest first deploy
is: set up the GitHub side now, push any commit to `master`, and the
`lms-deploy` workflow builds, pushes and deploys everything. Jump to
[CI/CD pipeline](#cicd-pipeline) and return for Phase 6 verification.

### Option B — build and push manually (one-time bootstrap)

From your workstation (needs Docker):

```bash
git clone https://github.com/iamleson98/class-management && cd class-management

# log in to GHCR with a PAT that has write:packages:
echo "<github-pat>" | docker login ghcr.io -u iamleson98 --password-stdin

deploy/swarm/build-and-push.sh          # builds + pushes all three images
# expect: three images pushed, tagged master + sha-<short>
```

---

## Phase 5 — Configure and deploy

**On the manager:**

```bash
cd /opt/lms-src/deploy/swarm      # or wherever Phase 3 cloned the repo
cp .env.example .env
$EDITOR .env
```

Minimal single-node `.env` (pilot profile):

```env
DOMAIN=example.com                       # ← your domain
ACME_EMAIL=you@example.com               # ← your email
TRAEFIK_AUTH=admin:CHANGE_ME             # ← htpasswd -nB admin output
RTCD_ICE_HOST_OVERRIDE=<manager-ip>      # ← this node's public IPv4
TAG=master
TZ=Asia/Ho_Chi_Minh
```

Generate the Traefik dashboard password on your workstation:

```bash
docker run --rm httpd:2-alpine htpasswd -nB admin
# paste the whole "admin:$2y$..." line as TRAEFIK_AUTH
```

**Production profile (multi-node) additions** — the knobs that turn the
same stack into the 5-node cluster from [Server planning](#server-planning):

```env
# placements (match the labels from Phase 2)
BACKEND_PLACEMENT=node.labels.role == app
DB_PLACEMENT=node.labels.role == db
RUSTFS_PLACEMENT=node.labels.role == db
RTCD_PLACEMENT=node.labels.role == video

# SFU pool across two video nodes
MM_CALLSSETTINGS_RTCDSERVICEURL=http://rtcd-pool:8045
RTCD_ICE_HOST_OVERRIDE=<video1-ip>
RTCD_CPUS=6.0
RTCD_MEM=8G
RTCD2_REPLICAS=1
RTCD2_ICE_HOST_OVERRIDE=<video2-ip>
RTCD2_CPUS=6.0
RTCD2_MEM=8G

# scale + sizing for 1000 concurrent users
FRONTEND_REPLICAS=2
BACKEND_CPUS=6.0
BACKEND_MEM=6G
DB_CPUS=6.0
DB_MEM=24G
MM_SQLSETTINGS_MAXCONNS=100
MM_CALLSSETTINGS_MAXCALLPARTICIPANTS=40
```

Every variable is documented inline in `.env.example`.

**DNS**: point the five records from
[Prerequisites](#prerequisites) at `<manager-ip>` now (before deploying,
so Let's Encrypt can issue certificates on first hit).

```bash
dig +short app.example.com        # on your workstation; expect <manager-ip>
```

**Deploy:**

```bash
./deploy.sh
```

`deploy.sh`:

1. validates `.env` (required vars, secrets present, config files exist)
2. logs in to GHCR when credentials are configured (private packages)
3. `docker stack deploy --with-registry-auth lms` (auth propagates to
   workers so they can pull)
4. waits for the rollout to converge (up to `ROLLOUT_TIMEOUT`, default 300 s)
5. smoke-tests `https://app.<domain>/api/v4/system/ping`, the API origin,
   Grafana, **and the WebSocket upgrade (expects `101`)**

### ✅ Checkpoint

```bash
docker stack services lms
# every service 1/1 (or 2/2 for lms-fe), lms_rustfs-init "complete"
# "lms_rustfs-init" is a one-shot job — COMPLETE/0 is its healthy state.

curl -s https://app.example.com/api/v4/system/ping | head -c 200
# expect: {"AndroidLatestVersion":"","AndroidMinVersion":"","IosLatestVersion":...}
```

The first hit to `https://app.<domain>` may take an extra ~10–30 s while
Let's Encrypt issues the certificate.

---

## Phase 6 — Verify the deployment

Run the full battery — this is what "deployed properly" means. All from
your workstation, with `<domain>` substituted:

**1. TLS + redirect:**

```bash
curl -sI http://app.<domain>/ | head -n 3
# expect: 301 + Location: https://...
curl -sI https://app.<domain>/ | head -n 5
# expect: HTTP/2 200; server: Traefik; a Let's Encrypt cert
```

**2. API through the app origin (the proxy leg):**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://app.<domain>/api/v4/system/ping
# expect: 200
```

**3. Signaling WebSocket upgrade (the calls control path):**

```bash
curl -s -i -N --max-time 8 \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  https://app.<domain>/api/v4/websocket | head -n 1
# expect: HTTP/1.1 101 Switching Protocols
```

**4. Media port (from an external machine — the WebRTC leg):**

```bash
nc -vz <video1-ip> 8443        # and <video2-ip> 8443 when the pool is on
# expect: "succeeded!" (open) for TCP; UDP is fire-and-forget — tested in 5.
```

**5. Log in and make a real call (the end-to-end proof):**

- Open `https://app.<domain>` in a browser, create the first (admin) user,
  log in. In DevTools → Network, the `/api/v4/websocket` frame should show
  status **101**; the `MMAUTHTOKEN` cookie must be **HttpOnly**.
- Join a channel, start a call from a second device/browser profile (or
  phone on mobile data). Both sides: audio both directions, screen share
  from one side.
- With the pool active, run a few test calls; check they spread:

```bash
docker service logs lms_lms-rtcd --tail 20   # on the manager
docker service logs lms_lms-rtcd2 --tail 20  # join/leave entries on both
```

**6. Task health across nodes:**

```bash
docker stack ps lms
# every task Running, placements match your labels,
# lms_rustfs-init Complete.
```

If any check fails, go straight to [Troubleshooting](#troubleshooting) —
it is ordered by symptom.


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

**Secrets** (Settings → Secrets and variables → Actions → *Secrets* tab →
"New repository secret"):

| Secret | Value |
|---|---|
| `CONTABO_SSH_KEY` | the **private** key matching `deploy`'s public key (contents of your `~/.ssh/lms`) |
| `LMS_TRAEFIK_AUTH` | `htpasswd -nB admin` output (Traefik dashboard) |
| `GHCR_PAT` | *optional* — PAT with `read:packages`, only if the GHCR packages are private |
| `CONTABO_KNOWN_HOSTS` | *optional* — `ssh-keyscan <manager-host>` output (pins the host key instead of TOFU) |

**Variables** (same settings page, *Variables* tab → "New repository
variable"):

| Variable | Value |
|---|---|
| `CONTABO_SSH_HOST` | manager public IP / hostname |
| `CONTABO_SSH_USER` | `deploy` (or `root`) |
| `CONTABO_SSH_PORT` | `22` (if nonstandard) |
| `LMS_DOMAIN` | base domain, e.g. `example.com` |
| `LMS_ACME_EMAIL` | Let's Encrypt email |
| `LMS_RTCD_PUBLIC_IP` | public IPv4 of the rtcd node |
| `LMS_RTCD2_PUBLIC_IP` | *optional* — second SFU node's IP when the pool is active |

The deploy workflow also expects a GitHub **environment** named
`production` (Settings → Environments → New environment — create it empty;
it gives you a deployment history and an optional approval gate).

> The workflow **renders `.env` on the manager from GitHub
> vars/secrets** (including your production-profile knobs — edit the
> workflow's env template when you add pool/scale settings). Values set
> this way never appear in `ps` output on the server. `.env` on the
> manager takes precedence when it defines `TAG` (manual pin).

### One-time GHCR setup

The packages (`lms-server`, `lms-fe`, `lms-rtcd`) are created on first
push and default to **private**. For simplicity make them public
(Packages → each package → Settings → Change visibility) — no login is
then needed on the servers. To keep them private: create a PAT with
`read:packages`, store it as the `GHCR_PAT` secret; the workflow drops it
on the manager as `/opt/lms/.ghcr-token` and `deploy.sh` logs in with it.

### Rollback

```bash
./rollback.sh                # revert to the previous stack spec
./rollback.sh sha-1a2b3c4    # redeploy an older immutable tag
```

Or run the `lms-rollback` workflow manually from the Actions tab.

---

## Calls (rtcd) in production

The calls stack has three legs — all must work for reliable audio/video:

```
browser ── (1) wss://app.DOMAIN/api/v4/websocket ──▶ frontend proxy ──▶ lms-server
         └─ (2) DTLS-SRTP media (UDP, TCP fallback) ──▶ rtcd :8443 (host mode)
lms-server ── (3) ws://rtcd(-pool):8045 (overlay) ──▶ rtcd control API
```

- **(1) Signaling WebSocket** — rides the app origin through the frontend's
  `/api/v4` proxy (`run-server.js`). It is exercised by the deploy smoke
  test (`app ws` → 101) and by CI
  (`lms-fe/scripts/test-integration-run-server.cjs`). The browser client
  auto-reconnects with backoff and re-joins the call on reconnect;
  Traefik's idle timeouts are tuned for long-lived sockets (15 m).
- **(2) Media (ICE/DTLS)** — browser ↔ rtcd, never proxied. **Two transport
  fallbacks are always available**: UDP 8443 first, TCP 8443 when UDP is
  blocked. `RTCD_ICE_HOST_OVERRIDE` must be the public IPv4 of the node the
  rtcd task runs on — it is baked into the ICE host candidates handed to
  browsers; on Contabo it is the VPS's public IP. With a pool, each
  instance advertises **its own** node's IP (`RTCD2_ICE_HOST_OVERRIDE`, …).
- **(3) Backend ↔ SFU control** — the backend resolves the rtcd URL via
  DNS and keeps **one control connection per SFU instance**; the vendored
  rtcd service client auto-reconnects indefinitely (2 s → 30 s capped
  backoff) and reconnect failures are logged (`rtcd host client error`).
  The URL is re-resolved every 10 s, so SFU instances added to the pool
  are discovered without a backend restart.

Registration credentials persist in the backend's database (KV) and each
rtcd instance's `rtcd_data`/`rtcd2_data` volume — do not delete both at
once, or the backend registers a new client ID (old SFU sessions are
orphaned until it restarts).

### Verifying media connectivity

```bash
# from an external machine — the TCP leg of the media port:
nc -vz <video-node-ip> 8443

# the control plane is internal-only; the backend self-registers on first
# connect (MM_CALLSSETTINGS_RTCDSERVICEURL=http://rtcd(-pool):8045).
```

### ICE / STUN / TURN

`MM_CALLSSETTINGS_ICESERVERS` (comma-separated ICE URLs) is what BROWSERS
receive in the call join ack. **Empty is the correct default**: rtcd runs
on a public IP and publishes host candidates, which browsers reach
directly with their own host candidates over UDP and TCP — no STUN/TURN
needed for the client→public-SFU path, and no third-party dependency.

Add servers only for restrictive networks, with TURN credentials embedded
as URL userinfo (the server splits them into the `username`/`credential`
fields the browser expects):

```env
MM_CALLSSETTINGS_ICESERVERS=stun:stun.example.net:3478,turn:turnuser:turnpass@turn.example.net:3478?transport=tcp,turns:turnuser:turnpass@turn.example.net:5349?transport=tcp
```

Reference coturn (run it on the video node, or any reachable host):

```
# /etc/turnserver.conf (coturn/coturn docker image: mount as config)
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
static-auth-secret=CHANGE_ME_LONG_RANDOM       # or use long-term user:pass
realm=turn.example.com
# 443 is shared with Traefik — for TURN-over-TLS-on-443 run coturn on its
# own IP, or use port 5349 with a DNS name + certificate:
cert=/etc/letsencrypt/live/turn.example.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.example.com/privkey.pem
no-cli
```

Notes:

- `turn:` is plain TURN (usually UDP), `?transport=tcp` selects TURN/TCP,
  and `turns:` is TURN over TLS — the last resort that passes networks
  which only allow HTTPS-style traffic.
- TURN credentials in `MM_CALLSSETTINGS_ICESERVERS` are visible to
  authenticated users via `GET /api/v4/calls/config` (same as the
  Mattermost calls plugin). Rotate the secret if it leaks; prefer
  network-level restrictions on who can reach coturn (`allowed-peer-ip`).
- rtcd's OWN ICE servers (`RTCD_ICE_SERVERS`) are separate: they only
  affect the SFU's own gathering and public-IP discovery.

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

### Monitoring

Grafana at `https://grafana.<domain>` (password from the
`grafana_admin_password` secret; rotate after first login). Prometheus
scrapes `lms-server:8067/metrics` and every `lms-rtcd*:8045/metrics`.
Watch: lms-server goroutines/DB pool saturation, per-node CPU, and SFU
session counts on the video nodes.

### Scaling the SFU pool (the 1000-user media lever)

Adding SFU capacity is three commands and a redeploy — no image rebuilds,
no backend restart:

```bash
# 1. Provision + swarm-join a new video node (Phases 1–2), then label it:
docker node update --label-add rtcd=2 <new-video-hostname>

# 2. In deploy/swarm/.env:
#      MM_CALLSSETTINGS_RTCDSERVICEURL=http://rtcd-pool:8045
#      RTCD2_ICE_HOST_OVERRIDE=<new-node-ip>
#      RTCD2_REPLICAS=1
#      RTCD2_CPUS=6.0
#      RTCD2_MEM=8G
#    (and uncomment the lms-rtcd2 target in configs/prometheus.yml)

# 3. Redeploy:
./deploy.sh
```

The backend resolves `rtcd-pool` (a shared DNS alias, DNS round-robin
across SFU tasks) within ~10 s and starts assigning new calls to the new
instance. Existing calls stay on their current SFU. Each instance pins
its own node's public IP in ICE candidates and keeps its own
registration volume.

A third/fourth instance: duplicate the `lms-rtcd2` block in `stack.yml`
as `lms-rtcd3` (own volume, own placement label, same `rtcd-pool` alias)
— the pattern is intentionally repetitive.

### Updates

CI deploys are rolling: `start-first` for the stateless services (zero
downtime), `stop-first` for the stateful ones (ports/volumes must be
released first). If a healthcheck fails mid-rollout, the stateless
services auto-rollback to the previous spec; stateful services pause for
inspection.

### Logs

All services log to `json-file` with rotation (10 MB × 3 files per
container) — bounded disk usage out of the box.

---

## Capacity & scaling

**Vertical-first, then the pool.** Two facts drive every scaling decision:

1. **`lms-server` must stay one replica.** Per-call state (participants,
   mute/share/hand flags, host) lives in the server's memory; the
   cross-node cluster sync that would make multiple replicas safe is
   scaffolded but not wired yet (`registerClusterHandlers` in
   `server/channels/calls/service.go`). Until it is: keep
   `BACKEND_REPLICAS=1`, scale the backend **vertically**
   (`BACKEND_CPUS/MEM`, a bigger app node), and scale **media**
   horizontally across the rtcd pool. A single 6–8 vCPU replica carries
   the 1000-user target comfortably.
2. **`lms-fe` scales by replicas** (`FRONTEND_REPLICAS`) — it is fully
   stateless; Traefik spreads requests. Give each task ~1 vCPU / 1 GB.

Stateful services (postgres/rustfs) do not scale horizontally in this
stack. To move them to a bigger node: set the placement in `.env`,
redeploy, then migrate the volume (see [Backup & restore](#backup--restore)).

**Scale triggers — act when any holds for 10+ minutes:**

| Signal | Threshold | Action |
|---|---|---|
| `lms-server` CPU (Grafana) | > 70 % | bigger `BACKEND_CPUS` / app node |
| DB pool wait / saturation | pool at 100 % | `MM_SQLSETTINGS_MAXCONNS` up, then bigger db node |
| rtcd node CPU | > 70 % during classes | add a pool instance |
| rtcd node network egress | > 70 % of port speed | add a pool instance (spread egress) |
| lms-fe 5xx / slow TTFB | any sustained | +1 replica |

Rough per-instance capacity (validate with your own media mix):

- One 8-vCPU SFU: **~200–300 audio participants** + ~10 screen shares,
  or ~60–80 participants with cameras on.
- One 6-vCPU backend: **1000+ concurrent WS users** at chat-level load.
- Postgres 12 vCPU / 48 GB: far beyond 1000 concurrent LMS users.

---

## Separated frontend deployment

The frontend image is **backend-agnostic**: its server proxies `/api/v4`
(REST *and* the WebSocket upgrade — Next.js rewrites alone cannot proxy
WS) to `LMS_BACKEND_URL` at **runtime**. So the frontend can run on any
host, any domain — the browser still sees one origin and the cookie-based
auth model is unchanged. No CORS, no token plumbing, no rebuild per
environment.

```
app.other-domain.com ──▶ lms-fe container ──┬─ pages  → Next.js
                                            └─ /api/v4 (REST + WS)
                                               → https://api.example.com (LMS_BACKEND_URL)
```

Setup:

1. **Backend**: deployed as usual (this Swarm, or any host). Ensure the
   backend origin is reachable from the frontend host, and set the CORS
   allowlist for any DIRECT cross-origin clients (not needed for the
   proxied app traffic, but good defense in depth):
   `MM_SERVICESETTINGS_ALLOWCORSFROM=https://app.other-domain.com`.
2. **Frontend**: run the same `ghcr.io/iamleson98/lms-fe` image with
   ```env
   LMS_BACKEND_URL=https://api.example.com
   ```
   and your own TLS terminator (Traefik/Caddy) in front of it. If you keep
   the Swarm's Traefik, you can instead keep lms-fe in the Swarm and
   simply point `LMS_BACKEND_URL` at a remote backend — same mechanics.
3. **Verify**: open the app, log in, then check the call path:
   ```bash
   # WS upgrade through the frontend's proxy (expect 101):
   curl -s -i -N --max-time 8 \
     -H "Connection: Upgrade" -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
     https://app.other-domain.com/api/v4/websocket | head -n 1
   ```

Caveats:

- Media (browser ↔ rtcd) never goes through the frontend; participants
  need network access to the rtcd node's public IP:8443 (UDP+TCP). Keep
  rtcd on a host with a public IP and the correct `RTCD_ICE_HOST_OVERRIDE`.
- The frontend server adds one proxy hop (~ms) for REST/WS — the same hop
  the in-Swarm deployment uses.
- `NEXT_PUBLIC_API_URL` stays at its `/` default (baked into the image);
  do NOT bake a backend URL at build time — `LMS_BACKEND_URL` is the
  runtime knob.

---

## Backup & restore

The state that matters: **postgres** (`pgdata` volume) and **rustfs**
(`rustfs_data` volume). Everything else is reproducible from images +
config. Traefik's `traefik_certs` volume (Let's Encrypt certs) is
regenerable but worth including to avoid re-issuing. The rtcd
registration volumes are cheap to re-register — include them for
convenience.

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

Restore: stop the service (`docker service scale lms_postgres=0`),
restore the volume contents, scale back up. Schedule with
cron/systemd-timers on the db node; ship archives off-node (Contabo
Object Storage, rsync, …). Example nightly cron on the db node:

```cron
0 3 * * * docker exec $(docker ps -qf name=lms_postgres) pg_dump -U mmuser mattermost | gzip > /var/backups/lms/mattermost-$(date +\%F).sql.gz && find /var/backups/lms -mtime +14 -delete
```

---

## Security hardening checklist

Work through this once the deployment is verified:

- [ ] SSH: key-only login (`PasswordAuthentication no`), no root login
      when the `deploy` user works
- [ ] `CONTABO_KNOWN_HOSTS` secret set (pins the manager host key)
- [ ] GHCR packages private + `GHCR_PAT` if the repo is private
- [ ] Traefik dashboard password is strong (`htpasswd -nB admin`)
- [ ] rustfs console (`s3.<domain>`) removed from the stack if unused
- [ ] Grafana admin password rotated after first login
- [ ] Firewall: 8443 open only on the video nodes; 2377/7946/4789
      restricted to the swarm nodes' IPs if you run multi-node
- [ ] Backups scheduled and tested (restore at least once)
- [ ] `docker node ls` reviewed after any infra change (no stray nodes)
- [ ] First user created, email verified, admin MFA on; sign-ups gated
      (invite links / approved domains) per your school policy

---

## Troubleshooting

Ordered by symptom. All `docker` commands run on the manager.

| Symptom | Likely cause | Fix |
|---|---|---|
| `cloud-init status --wait` never finishes | cloud-init error (bad key paste / apt hiccup) | `sudo cloud-init status --long`; `journalctl -u cloud-final`; worst case reinstall the node with a corrected user-data |
| Node won't join swarm | 2377/7946/4789 blocked or token expired | re-check ufw on both ends; `docker swarm join-token worker` (tokens rotate) |
| Deploy fails: `secret … is missing` | Bootstrap not run | `./secrets-bootstrap.sh` |
| Deploy fails: `set TAG in .env` | No image tag | `TAG=sha-… ./deploy.sh` |
| Rollout stuck, `docker stack ps` shows `Pending` | Placement constraint matches no node | check `docker node ls` labels vs `*_PLACEMENT` in `.env` |
| `lms-rtcd` stuck Pending on multi-node | placement/label mismatch, or 8443 already bound on that node | `docker stack ps lms_lms-rtcd --no-resolve`; fix label; only ONE rtcd task per node (host-mode port) |
| `lms-server` restarting, logs: DB connect refused | postgres still starting | self-heals via restart policy; check `docker service logs lms_postgres` |
| 500 on file upload | bucket missing / S3 creds | `docker service logs lms_rustfs-init`; re-run init task: `docker service update --force lms_rustfs-init` |
| Certificate errors on first hit | Let's Encrypt issuance lag / DNS | wait; `docker service logs lms_traefik` shows ACME activity; verify `dig +short app.<domain>` |
| Calls connect, then drop after ~5 s | ICE failure (media blocked) | verify `RTCD_ICE_HOST_OVERRIDE` = that node's public IP and 8443/udp open; add TURN |
| Calls stuck "connecting" for remote users | strict NAT / UDP blocked | they fall back to TCP automatically; if still failing, deploy coturn and set `MM_CALLSSETTINGS_ICESERVERS` with a `turn:` URL |
| Calls fine on video1, never on video2 (pool) | wrong `RTCD2_ICE_HOST_OVERRIDE` or node not labeled `rtcd=2` | `docker stack ps lms_lms-rtcd2`; fix `.env`, `docker node update --label-add rtcd=2 <node>` |
| Chat WebSocket 401 | cookie lost (cross-origin access) | always use `https://app.<domain>` — never the raw `:3000/:8065` ports |
| Worker can't pull image | no registry auth | deploy with `--with-registry-auth` (deploy.sh does) + valid `GHCR_PAT` for private packages |
| `docker stack deploy` interpolation error `$` | unescaped `$` in env values | keep `$` as `$$` in the stack file; values from `.env` need no escaping |
| Backend log: `rtcd host client error` looping | SFU down or control port unreachable | `docker service ps lms_lms-rtcd`; the client auto-reconnects once the SFU is healthy |
| Slow page loads from Vietnam | DNS/route, not the app | `dig`, then `traceroute <manager-ip>`; verify region is Singapore |

---

## Appendix

### File map

```
deploy/
  cloud-init/contabo.yaml        node bootstrap (Docker, sysctls, ufw, deploy user)
  images/
    rtcd.Dockerfile              rtcd image (build context = repo root!)
    rtcd-config.template.toml    config rendered from RTCD_* env at start
    rtcd-entrypoint.sh           renderer + exec
  swarm/
    stack.yml                    the Swarm stack (incl. lms-rtcd2 pool member)
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

### Port reference (consolidated)

| Port | Where | Protocol | Exposed to |
|---|---|---|---|
| 80/443 | manager (traefik) | tcp | public — all HTTP(S) + WSS |
| 8443 | video nodes (rtcd) | tcp+udp | public — WebRTC media (ICE/DTLS-SRTP) |
| 2377/7946/4789 | all swarm nodes | tcp/udp | swarm peers only |
| 8065/8067 | lms-server (overlay) | tcp | internal — API/WS, metrics |
| 8045 | lms-rtcd* (overlay) | tcp | internal — SFU control + metrics |
| 5432 | postgres (overlay) | tcp | internal |
| 9000/9001 | rustfs (overlay) | tcp | internal — S3 API / console |
| 3000 | lms-fe (overlay) | tcp | internal — behind traefik |

### Quick reference: what runs where (production profile)

| Node | Services | Volumes on that node |
|---|---|---|
| manager | traefik, lms-fe ×2, prometheus, grafana | traefik_certs, promdata, grafana-data |
| app | lms-server | — |
| db | postgres, rustfs, rustfs-init (one-shot) | pgdata, rustfs_data |
| video1 | lms-rtcd | rtcd_data |
| video2 | lms-rtcd2 | rtcd2_data |
