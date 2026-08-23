# Infrastructure — Kamatera + Docker Swarm

Production deployment for the LMS system on Kamatera VMs orchestrated by
Docker Swarm. Terraform provisions the servers; Docker is installed over SSH,
the nodes form a Swarm, and a single stack file deploys all services.

```
┌────────────────────────────────────────────────────────────────────┐
│  Kamatera datacenter (single zone, private network)                 │
│                                                                     │
│  manager-1   ─ Traefik (TLS :443), registry, lms-fe, Grafana        │
│  backend-1   ─ lms-server (Go API), MinIO      [label: backend]     │
│  db-1        ─ PostgreSQL                       [label: db]        │
│  video-1     ─ rtcd (calls SFU, :8443 udp/tcp)  [label: video]      │
│                                                                     │
│  All on one overlay network; Swarm schedules per node labels.       │
└────────────────────────────────────────────────────────────────────┘
```

> The `video` node hosts **rtcd**, the WebRTC SFU for native calls. It is
> optional at first — the stack runs fine without it (calls are simply
> disabled until you add the rtcd service; see root `README.md` §4). When you
> do enable it, remember to open **UDP+TCP 8443 inbound** on that node in the
> Kamatera firewall — media flows browser↔rtcd directly, not through Traefik.

## One-time prerequisites

1. **Kamatera API keys** — Console → API → create credentials. Export them:
   ```bash
   export KAMATERA_API_CLIENT_ID="..."
   export KAMATERA_API_SECRET="..."
   ```
2. **An SSH key pair** for VM access (Terraform injects the public key):
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/lms_swarm -N ""
   ```
3. **Install** `terraform` (≥ 1.5) and `docker` on your workstation.
4. **A domain** pointing at the manager's public IP (for Let's Encrypt).
   Create A records, e.g.:
   - `app.example.com`  → manager public IP   (frontend + API/WS via same origin)
   - `api.example.com`  → manager public IP   (backend API)
   - `minio.example.com`→ manager public IP   (MinIO console)
   - `grafana.example.com` / `traefik.example.com` → manager public IP

   When enabling calls, also note the **video node's public IP** — it is
   advertised to browsers as the media address (`ice_host_override`) and
   needs 8443 udp+tcp open in the Kamatera firewall.

## Provision

```bash
cd infrastructure/terraform
terraform init
terraform plan  -var-file=envs/dev.tfvars
terraform apply -var-file=envs/dev.tfvars
```

`terraform apply` outputs the public IPs and the swarm join details. Cloud-init
fully forms the cluster — no manual `docker swarm join` needed. Verify:

```bash
ssh -i ~/.ssh/lms_swarm root@<manager-ip> "docker node ls"
```

## Deploy the application

```bash
# 1. Bootstrap Swarm secrets (DB password, MinIO keys, etc.) — once
../../deploy/swarm/secrets-bootstrap.sh

# 2. Build images and push to the in-cluster private registry
../../deploy/swarm/build-and-push.sh

# 3. Deploy the stack
../../deploy/swarm/deploy.sh
```

See `deploy/swarm/README.md` and `terraform/README.md` for details.

## Files

```
infrastructure/
├── README.md                       this file
├── terraform/
│   ├── main.tf                     provider + private network + random secrets
│   ├── variables.tf                all knobs (zone, sizes, image, ssh key…)
│   ├── servers.tf                  4 VMs + Docker install (SSH) + Swarm + labels
│   ├── outputs.tf                  IPs, SSH command, generated secrets
│   └── envs/
│       └── dev.tfvars.example      copy → dev.tfvars, fill in
deploy/
├── swarm/
│   ├── stack.yml                   the Swarm stack (all services)
│   ├── .env.example                non-secret env for the stack
│   ├── secrets-bootstrap.sh        creates Docker secrets
│   ├── build-and-push.sh           builds + pushes images to registry
│   ├── deploy.sh                   docker stack deploy
│   ├── registry-auth.sh            distributes registry creds to nodes
│   └── README.md
└── docker-compose.yml              single-host (non-Swarm) variant, kept for local/dev
```
