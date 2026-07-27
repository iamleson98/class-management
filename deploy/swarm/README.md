# Docker Swarm deployment

Deploys the LMS system across the Kamatera Swarm cluster provisioned by
`infrastructure/terraform`. One stack file, TLS via Traefik, secrets via Docker
Swarm, images via an in-cluster private registry.

## Prerequisites (after `terraform apply`)

- A formed Swarm (4 nodes labelled `role=manager|backend|db|video`). Verify:
  `terraform output -raw swarm_check | sh`
- DNS: A records for `app`, `api`, `minio`, `grafana`, `traefik` → manager IP.

## One-time setup

```bash
cd deploy/swarm
cp .env.example .env
# edit .env: DOMAIN, ACME_EMAIL, TRAEFIK_AUTH

# 1. Create the Swarm secrets (pulls generated values from terraform output)
./secrets-bootstrap.sh

# 2. Log the manager into the private registry
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

| Service      | Node label  | Notes                                   |
|--------------|-------------|-----------------------------------------|
| traefik      | manager     | TLS termination, 80/443 published       |
| registry     | manager     | private registry:5000 (overlay only)    |
| postgres     | db          | volume `pgdata`                         |
| minio        | backend     | volume `miniodata`; S3 for uploads      |
| lms-server   | backend     | Go API; reads secrets via entrypoint    |
| lms-fe       | manager     | Next.js; proxies /api/v4 to lms-server  |
| prometheus   | manager     | scrapes lms-server:8067                 |
| grafana      | manager     | datasource auto-provisioned             |

## Secrets handling

Mattermost has no `*_FILE` env convention, so the backend image ships a small
entrypoint shim (`server/build/docker-entrypoint.sh`) that reads Swarm secret
files and exports the matching `MM_*` vars. The mapping is set per-service via
`SECRETS_MAP`. Postgres/Grafana use their native `_FILE` support directly.

Secrets are created by `secrets-bootstrap.sh` and stored in Swarm's encrypted
raft store — never in plaintext env files.

## Updating

```bash
# Rebuild a changed service and redeploy
TAG=v2 ./build-and-push.sh && ./deploy.sh
```
Swarm rolls out with `order: start-first` (new tasks start before old ones stop).

## Adding the future video service

1. `terraform apply` already provisioned the `video` node (`role=video`).
2. Add a service block to `stack.yml` with `constraints: ["node.labels.role == video"]`.
3. `./deploy.sh` — Swarm schedules it on the video node. Nothing else changes.

## Tear down

```bash
docker stack rm lms
# then terraform destroy from infrastructure/terraform
```
