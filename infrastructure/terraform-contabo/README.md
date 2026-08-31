# Contabo infrastructure (Terraform)

Provisions the Docker Swarm nodes on Contabo Cloud VPSes / VDSes and boots
them with Docker preinstalled via cloud-init (`deploy/cloud-init/contabo.yaml`
— the single source of truth, templated with your SSH key).

The older `../terraform/` directory targets Kamatera and is kept for
reference only; Contabo is the supported target.

## What you get

- `contabo_secret` — your SSH public key registered in Contabo's secrets API
- `contabo_instance.manager` — always created (edge/Traefik + stateless
  services; everything, on a single-node setup)
- `contabo_instance.db` — optional (postgres + rustfs)
- `contabo_instance.video` — optional (rtcd SFU, host-mode media ports)
- `contabo_instance.video2` — optional (second SFU node for the `rtcd-pool`)

**Region**: set `region = "SIN"` (Singapore) for users in Vietnam —
~25–70 ms RTT from VN cities. All nodes must be in the same region.
DEPLOY.md → "Server planning" has the sizing profiles.

## Quick start

```bash
# Credentials from the Contabo panel → API section:
export CONTABO_CLIENT_ID=... CONTABO_CLIENT_SECRET=...
export CONTABO_USER=... CONTABO_PASS=...

cd infrastructure/terraform-contabo
cp envs/contabo.tfvars.example envs/contabo.tfvars
$EDITOR envs/contabo.tfvars          # product IDs + your public key

terraform init
terraform apply -var-file=envs/contabo.tfvars
```

`terraform output swarm_setup_instructions` then prints the one-time swarm
formation and DNS steps. Node IPs: `manager_ip`, `db_node_ip`,
`video_node_ip`, `video2_node_ip`.

## Notes

- Product IDs in the example (`V15`/`V30`/`V50`) are indicative — check the
  [product list](https://contabo.com/en/product-list/?show_ids=true) for the
  current IDs and sizes.
- `user_data` / `ssh_keys` / `image_id` changes **reinstall the server**
  (Contabo API semantics). Changing the cloud-init file is a destructive
  action — review `terraform plan` carefully.
- State is local (`terraform.tfstate`) — store it remotely (S3/rustfs
  backend, gitlab, etc.) for anything beyond experiments.
