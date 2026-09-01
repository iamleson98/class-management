# Terraform — Kamatera provisioning

Provisions 4 Kamatera servers, installs Docker over SSH, forms a Docker Swarm,
labels each node, and generates the secrets the application stack needs.

```
terraform/
├── main.tf        provider, private network, random secrets
├── variables.tf   all knobs (zone, sizes, image, ssh key…)
├── servers.tf     4 VMs + Docker install + Swarm bootstrap + node labels
├── outputs.tf     IPs, SSH command, generated secrets
├── envs/
│   └── dev.tfvars.example
└── .gitignore
```

## 1. Prerequisites

```bash
# Kamatera API keys (Console → API)
export KAMATERA_API_CLIENT_ID="..."
export KAMATERA_API_SECRET="..."

# SSH keypair Terraform injects (public) and uses to SSH (private)
ssh-keygen -t ed25519 -f ~/.ssh/lms_swarm -N ""

# Terraform ≥ 1.5
terraform --version
```

## 2. Provision

```bash
cd infrastructure/terraform
cp envs/dev.tfvars.example envs/dev.tfvars
# edit envs/dev.tfvars: zone, sizes, ssh_public_key path

terraform init
terraform plan  -var-file=envs/dev.tfvars
terraform apply -var-file=envs/dev.tfvars
```

`apply` will: create the VMs → install Docker → init the Swarm on the manager →
join the 3 workers → label every node (`role=manager|backend|db|video`).

## 3. Verify the cluster

```bash
terraform output -raw manager_ssh      # copy & run
# …then on the manager:
docker node ls
```

You should see 4 nodes, one manager + 3 workers, each with a `role` label.

## 4. Get the generated secrets

These are used by `deploy/swarm/secrets-bootstrap.sh`:

```bash
terraform output -raw generated_db_password
terraform output -raw generated_rustfs_secret_key
terraform output -raw generated_grafana_admin_password
terraform output -raw generated_registry_password
```

## Notes

- **Docker install is done over SSH** (in `servers.tf`, `null_resource.install_docker`),
  not cloud-init — the Kamatera provider's `startup_script` cloud-init support
  is undocumented, so we keep all setup in one reliable channel.
- **Private registry auth**: set `registry_htpasswd` in your tfvars to require a
  login to push/pull. If left `null`, the registry runs open (only reachable on
  the overlay network, but still — set a password in production).
- **State**: local state by default (gitignored). For team use, add a `backend`
  block (S3/Consul) to `main.tf`.

## Tear down

```bash
terraform destroy -var-file=envs/dev.tfvars
```
