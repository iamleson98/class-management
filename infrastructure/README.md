# Infrastructure — Kamatera + Docker Swarm

Production deployment for the LMS system on Kamatera VMs orchestrated by
Docker Swarm. Terraform provisions the servers; cloud-init installs Docker and
joins them into a Swarm cluster; a single stack file deploys all services.

```
┌──────────────────────────────────────────────────────────────────┐
│  Kamatera datacenter (single zone, private network)              │
│                                                                  │
│  manager-1   ─ Traefik (TLS), private registry, observability    │
│  backend-1   ─ lms-server (Go API)          [label: backend]     │
│  db-1        ─ PostgreSQL                   [label: db]          │
│  video-1     ─ (reserved for video service) [label: video]       │
│                                                                  │
│  All on one overlay network; Swarm schedules per node labels.    │
└──────────────────────────────────────────────────────────────────┘
```

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
   - `app.example.com`  → manager public IP   (frontend)
   - `api.example.com`  → manager public IP   (backend API)
   - `minio.example.com`→ manager public IP   (MinIO console)

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
│   ├── main.tf                     provider + private network
│   ├── variables.tf                all knobs (zone, sizes, image, ssh key…)
│   ├── servers.tf                  4 VMs + node labels
│   ├── outputs.tf                  IPs, registry URL
│   ├── cloud-init/
│   │   ├── manager.yaml.tpl        Docker + swarm init + registry
│   │   └── worker.yaml.tpl         Docker + swarm join
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
