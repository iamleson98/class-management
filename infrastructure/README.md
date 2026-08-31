# Infrastructure — Contabo + Docker Swarm

Production deployment for the LMS system on **Contabo** servers (Cloud
VPS/VDS), orchestrated by Docker Swarm. Nodes are provisioned with
cloud-init (Docker preinstalled) or the Contabo Terraform provider; the
application is deployed by CI/CD (GitHub Actions → GHCR → SSH) or by the
scripts in `deploy/swarm/`.

```
┌────────────────────────────────────────────────────────────────────┐
│  Contabo (manager + optional db/video nodes)                        │
│                                                                     │
│  manager-1   ─ Traefik (TLS :443), lms-server, lms-fe,             │
│                postgres, rustfs, rtcd, Prometheus, Grafana          │
│  db-1*        ─ PostgreSQL + rustfs            [label: db]         │
│  video-1*     ─ rtcd (calls SFU, :8443 udp/tcp) [label: video]     │
│                                                                     │
│  All on one encrypted overlay network; Swarm schedules per labels.  │
│  * optional — single-node is the default and works out of the box.  │
└────────────────────────────────────────────────────────────────────┘
```

> The `video` node hosts **rtcd**, the WebRTC SFU for native calls. When you
> use one, open **UDP+TCP 8443 inbound** on it — media flows browser↔rtcd
> directly, not through Traefik.

## Directories

```
infrastructure/
├── terraform-contabo/               ← SUPPORTED (Contabo API provisioning)
│   ├── main.tf                      manager + optional db/video instances
│   ├── variables.tf                 region, product IDs, SSH key, toggles
│   ├── outputs.tf                   node IPs + swarm setup instructions
│   └── envs/contabo.tfvars.example
└── terraform/                       legacy Kamatera setup (reference only)
```

Node bootstrap itself lives in `deploy/cloud-init/contabo.yaml` (Docker,
sysctls, ufw, deploy user) — Terraform templates that file with your SSH key.

## Quick start

See `terraform-contabo/README.md` and the root `DEPLOY.md` (full production
guide). Summary:

```bash
cd infrastructure/terraform-contabo
cp envs/contabo.tfvars.example envs/contabo.tfvars   # + your key
terraform init && terraform apply -var-file=envs/contabo.tfvars
terraform output swarm_setup_instructions
```

Then on the manager: form the swarm, run `deploy/swarm/secrets-bootstrap.sh`,
and deploy via CI (push to `master`) or `deploy/swarm/deploy.sh`.
