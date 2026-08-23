# Docker Swarm deployment

Deploys the LMS system across the Kamatera Swarm cluster provisioned by
`infrastructure/terraform`. One stack file, TLS via Traefik, secrets via Docker
Swarm, images via an in-cluster private registry.

> Start with the root `README.md` — it walks the whole deployment in order.
> This file is the operator's reference for the Swarm layer.

## Prerequisites (after `terraform apply`)

- A formed Swarm (4 nodes labelled `role=manager|backend|db|video`). Verify:
  `terraform output -raw swarm_check | sh`
- DNS: A records for `app`, `api`, `minio`, `grafana`, `traefik` → manager IP
  (and, when enabling calls, the video node firewall opened for 8443 — see
  the rtcd section below).

## One-time setup

```bash
cd deploy/swarm
cp .env.example .env
# edit .env: DOMAIN, ACME_EMAIL, TRAEFIK_AUTH

# 1. Create the Swarm secrets (pulls generated values from terraform output)
./secrets-bootstrap.sh

# 2. Log the manager into the private registry and ship creds to all nodes
./registry-auth.sh
```

## Build & deploy

```bash
# 3. Build images and push to the in-cluster registry
#    (run where docker can reach 127.0.0.1:5000, e.g. on the manager,
#     or SSH-tunnel it: ssh -L 5000:127.0.0.1:5000 root@<manager-ip>)
./build-and-push.sh

# 4. Deploy the stack (run on the manager, or via DOCKER_HOST=ssh://root@<mgr>)
./deploy.sh
```

## What runs where

| Service      | Node label  | Notes                                        |
|--------------|-------------|----------------------------------------------|
| traefik      | manager     | TLS termination, 80/443 published            |
| registry     | manager     | private registry:5000 (overlay only)         |
| postgres     | db          | volume `pgdata`                              |
| minio        | backend     | volume `miniodata`; S3 for uploads           |
| lms-server   | backend     | Go API; reads secrets via entrypoint shim    |
| lms-fe       | manager     | Next.js; `/api/v4` routed to lms-server      |
| prometheus   | manager     | scrapes lms-server:8067                      |
| grafana      | manager     | datasource auto-provisioned                  |
| rtcd         | video       | calls SFU — add it, see below                |

## Routing model (why cookies and chat work)

The `MMAUTHTOKEN` login cookie is `httpOnly` + `SameSite=Lax`. For the cookie
to ride both REST calls and the chat WebSocket, everything the browser touches
must be **one origin**. Traefik therefore routes:

- `Host(app.<domain>) && PathPrefix(/api/v4)` → **lms-server** (priority 100)
- `Host(app.<domain>)` (everything else) → **lms-fe**
- `Host(api.<domain>)` → lms-server (direct API access / external clients)

Result: the browser only ever talks to `https://app.<domain>`, same-origin for
REST + WS. The WebSocket upgrade is proxied automatically by Traefik.

## Secrets handling

Mattermost has no `*_FILE` env convention, so the backend image ships a small
entrypoint shim (`server/build/docker-entrypoint.sh`) that reads Swarm secret
files and exports the matching `MM_*` vars. The mapping is set per-service via
`SECRETS_MAP`. Postgres/Grafana use their native `_FILE` support directly.

Secrets are created by `secrets-bootstrap.sh` and stored in Swarm's encrypted
raft store — never in plaintext env files. Existing secrets are never
overwritten; to rotate one: `docker secret rm <name> && ./secrets-bootstrap.sh`
then `./deploy.sh`.

## Enabling calls — the rtcd service

The native calls feature needs the rtcd SFU on the `video` node. Full
walkthrough in the root `README.md` §4; the short version:

1. **Add the service block** (from root README §4.1) to `stack.yml`: image
   `mattermost/rtcd` (or your build of `./rtcd`), config TOML mounted at
   `/etc/rtcd/config.toml`, `rtcd_data` volume for its client-key store, and
   **host-mode** published ports `8443/udp` + `8443/tcp` (Swarm ingress does
   not carry WebRTC UDP media; host mode pins correctly because the service is
   constrained to the single `video` node).
2. **rtcd config** (from `rtcd/config/config.sample.toml`): set
   `security.allow_self_registration = true` (safe on the private overlay) and
   `ice_host_override = "<video node public IP>"` so browsers receive a
   reachable media address.
3. **Tell the backend** — add to `lms-server.environment`:
   `MM_CALLSSETTINGS_ENABLE=true`,
   `MM_CALLSSETTINGS_RTCDSERVICEURL=http://rtcd:8045`.
4. **Firewall the video node**: allow UDP + TCP 8443 inbound.
5. `./deploy.sh`, then verify:
   `docker service logs lms_rtcd` and
   `docker service logs lms_lms-server | grep calls` →
   *"calls: rtcd client manager started"*.

Scaling media: add more `video`-labelled nodes with rtcd replicas behind one
DNS name and point `MM_CALLSSETTINGS_RTCDSERVICEURL` at it — the server
resolves all A records and spreads new calls across the SFU pool.

## Updating

```bash
# Rebuild a changed service and redeploy
TAG=v2 ./build-and-push.sh && ./deploy.sh
```
Swarm rolls out with `order: start-first` (new tasks start before old ones
stop) and `failure_action: rollback`. Manual rollback of one service:
`docker service rollback lms_lms-server`.

## Tear down

```bash
docker stack rm lms
# then terraform destroy from infrastructure/terraform
```
