# Docker Swarm deployment (Contabo)

Deploys the LMS system on a Docker Swarm cluster running on Contabo servers:
frontend (`lms-fe`), Go backend (`lms-server`), calls SFU (`lms-rtcd`), and
rustfs object storage, plus PostgreSQL, Traefik (TLS), Prometheus and Grafana.
Images come from GitHub Container Registry; CI/CD is GitHub Actions
(`.github/workflows/lms-deploy.yml`).

> Start with the root `DEPLOY.md` — it walks the whole deployment in order.
> This file is the operator's reference for the Swarm layer.

## Layout

```
deploy/swarm/
  stack.yml             the Swarm stack (services, networks, volumes, secrets, configs)
  .env.example          every tunable (domain, placements, tags, calls settings)
  secrets-bootstrap.sh  one-time: create the 5 Docker secrets
  deploy.sh             deploy/update + rollout wait + smoke tests
  rollback.sh           stack rollback / redeploy an older tag
  build-and-push.sh     manual image build & push to GHCR
  configs/prometheus.yml  scrape config (mounted as a Docker config)
  rtcd/config.toml.example  reference config (the image renders from env)
```

## Prerequisites

- Contabo VPSes with Docker installed (see `deploy/cloud-init/contabo.yaml` —
  paste it into Contabo's cloud-init field when creating the server(s)).
- A formed Swarm. Single node: `docker swarm init`. Multi-node: init on the
  manager, `docker swarm join` on the workers, then tag roles:
  ```bash
  docker node update --label-add role=db <node>
  docker node update --label-add role=video <node>
  docker node update --label-add role=backend <node>
  ```
- Firewall (on every node): allow `2377/tcp` (manager), `7946/tcp+udp`,
  `4789/udp` (VXLAN) between nodes; `80/tcp`, `443/tcp` (public, manager);
  `8443/tcp+udp` (public, video node only).
- DNS: A records for `app`, `api`, `s3`, `grafana`, `traefik` → manager IP.

## One-time setup (on the manager)

```bash
git clone https://github.com/iamleson98/class-management   # or upload deploy/
cd class-management/deploy/swarm
cp .env.example .env
# edit .env: DOMAIN, ACME_EMAIL, TRAEFIK_AUTH, RTCD_ICE_HOST_OVERRIDE, TAG

./secrets-bootstrap.sh    # creates db_password, db_dsn, rustfs_*, grafana_*
```

If the GHCR packages are private, also store a read:packages PAT:

```bash
echo "github_pat_..." > /opt/lms/.ghcr-token   # chmod 600; path via GHCR_TOKEN_FILE in .env
```

## Deploy

```bash
TAG=sha-<commit> ./deploy.sh     # CI does exactly this over SSH
```

`deploy.sh` validates the environment, logs in to GHCR (when configured),
runs `docker stack deploy --with-registry-auth lms`, waits for the rollout,
and smoke-tests the public endpoints — including the **calls WebSocket
upgrade** through the app origin (`https://app.<domain>/api/v4/websocket`
must answer `101`; it is proxied by the lms-fe server to
`LMS_BACKEND_URL`).

## Rolling back

```bash
./rollback.sh                 # revert to the previous stack spec
./rollback.sh sha-1a2b3c4     # redeploy an older immutable tag
```

## Operations cheat-sheet

```bash
docker stack services lms                       # service overview
docker stack ps lms                             # task placement/state
docker service logs lms_lms-server --tail 100 -f
docker service inspect lms_lms-rtcd --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}'
docker secret ls
docker node ls                                  # role labels, availability
docker service update --env-add ... lms_lms-server   # ad-hoc env change
```

## Placement & scaling

Defaults keep everything on the manager (single-node swarm works untouched).
Override the `*_PLACEMENT` vars in `.env` for multi-node clusters — see the
comments in `.env.example`. Scale `FRONTEND_REPLICAS` freely; keep
`BACKEND_REPLICAS=1` (per-call state lives in the backend's memory — cross-node
call sync is not wired yet). postgres and rustfs are single-writer services;
**rtcd scales horizontally as a pool**: `lms-rtcd2` (and further copies) share
the `rtcd-pool` DNS alias, and the backend discovers every instance and
spreads new calls across the pool — see DEPLOY.md "Scaling the SFU pool".

## rtcd (calls) notes

- `RTCD_ICE_HOST_OVERRIDE` MUST be the public IPv4 of the node rtcd runs on:
  it is advertised to browsers in ICE candidates. Behind Contabo NATless
  public IPs this is simply the VPS address. Each pool instance advertises
  ITS node's IP (`RTCD2_ICE_HOST_OVERRIDE`, …).
- Media ports (`8443/udp+tcp` by default) are published in **host** mode on
  that node — ingress/VIP publishing would break ICE host-candidate matching.
  Only ONE rtcd task can run per node (host-mode port conflict).
- The control API (`:8045`) stays on the overlay; the backend self-registers
  per instance (`MM_CALLSSETTINGS_RTCDSERVICEURL=http://rtcd:8045`, or
  `http://rtcd-pool:8045` for the pool; the URL is re-resolved every 10s so
  new instances are picked up without a backend restart).
- The image renders its config from env vars at start
  (`deploy/images/rtcd-entrypoint.sh`); no config file to maintain.
- Registered client credentials persist in the `rtcd_data` / `rtcd2_data`
  volumes (`/data/rtcd_db`) — do not delete them between deploys.

## Registry notes

Images live at `ghcr.io/iamleson98/lms-{server,fe,rtcd}`. CI pushes
`sha-<short>` (immutable) and `master` (rolling) tags; deploys pin the SHA
tag. Public packages need no login; private ones need a PAT with
`read:packages` on every node that pulls (the deploy uses
`--with-registry-auth` so only the manager needs the login).
