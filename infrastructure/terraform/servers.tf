# Four servers, one role each, on the private network. Docker is installed and
# the Swarm formed entirely over SSH from Terraform (the Kamatera provider's
# startup_script cloud-init support is undocumented, so we keep everything in
# one reliable channel).

locals {
  # Path to the matching PRIVATE key, derived from the public key path.
  ssh_private_key = replace(pathexpand(var.ssh_public_key), ".pub", "")
  ssh_user        = "root"

  worker_ips = [
    kamatera_server.backend.public_ips[0],
    kamatera_server.db.public_ips[0],
    kamatera_server.video.public_ips[0],
  ]

  # All four nodes share the same Docker install + firewall hardening.
  all_nodes = concat(
    [kamatera_server.manager.public_ips[0]],
    local.worker_ips,
  )
}

# ── Install Docker + open Swarm ports on every node ───────────────────
# Runs once per node right after the VM is up. Idempotent.
resource "null_resource" "install_docker" {
  count = length(local.all_nodes)

  connection {
    type        = "ssh"
    host        = local.all_nodes[count.index]
    user        = local.ssh_user
    private_key = file(local.ssh_private_key)
  }

  provisioner "remote-exec" {
    when = create
    inline = [
      # Skip if Docker is already present (idempotent across re-applies).
      "command -v docker >/dev/null 2>&1 && exit 0",
      "install -m 0755 -d /etc/apt/keyrings",
      "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg",
      "chmod a+r /etc/apt/keyrings/docker.gpg",
      ". /etc/os-release && echo \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable\" > /etc/apt/sources.list.d/docker.list",
      "apt-get update",
      "apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin",
      "systemctl enable --now docker",
      # Swarm inter-node ports
      "ufw allow 2377/tcp || true",
      "ufw allow 7946/tcp || true",
      "ufw allow 7946/udp || true",
      "ufw allow 4789/udp || true",
    ]
  }

  triggers = {
    node = local.all_nodes[count.index]
  }
}

# ── Manager: Traefik (TLS), private registry, observability ───────────
resource "kamatera_server" "manager" {
  name               = "lms-manager-1"
  zone               = var.kamatera_zone
  image              = var.server_image
  cpu                = var.manager_cpu
  ram                = var.manager_ram
  billing            = var.billing
  ssh_key            = local.ssh_key
  wait_for_resources = true
  power_on           = true

  disk { name = "main", size = var.manager_disk }
  network { name = "wan" }
  network { name = kamatera_network.swarm_net.name }

  password = random_password.manager_root_password.result
}

resource "random_password" "manager_root_password" {
  length = 24
  special = true
}

# ── Backend node: Go API ──────────────────────────────────────────────
resource "kamatera_server" "backend" {
  name               = "lms-backend-1"
  zone               = var.kamatera_zone
  image              = var.server_image
  cpu                = var.backend_cpu
  ram                = var.backend_ram
  billing            = var.billing
  ssh_key            = local.ssh_key
  wait_for_resources = true
  power_on           = true

  disk { name = "main", size = var.backend_disk }
  network { name = "wan" }
  network { name = kamatera_network.swarm_net.name }
}

# ── Database node: PostgreSQL ─────────────────────────────────────────
resource "kamatera_server" "db" {
  name               = "lms-db-1"
  zone               = var.kamatera_zone
  image              = var.server_image
  cpu                = var.db_cpu
  ram                = var.db_ram
  billing            = var.billing
  ssh_key            = local.ssh_key
  wait_for_resources = true
  power_on           = true

  disk { name = "main", size = var.db_disk }
  network { name = "wan" }
  network { name = kamatera_network.swarm_net.name }
}

# ── Video node: reserved for the future video-call service ────────────
resource "kamatera_server" "video" {
  name               = "lms-video-1"
  zone               = var.kamatera_zone
  image              = var.server_image
  cpu                = var.video_cpu
  ram                = var.video_ram
  billing            = var.billing
  ssh_key            = local.ssh_key
  wait_for_resources = true
  power_on           = true

  disk { name = "main", size = var.video_disk }
  network { name = "wan" }
  network { name = kamatera_network.swarm_net.name }
}

# ── Form the Swarm: init, join workers, label nodes ───────────────────
# Terraform SSHes to each node directly (it has the deploy key), so there is no
# manager→worker SSH dependency. Three steps:
#   1. manager inits the Swarm
#   2. the worker token is captured to a local file
#   3. each worker joins, then the manager labels all nodes
resource "null_resource" "swarm_init" {
  depends_on = [
    null_resource.install_docker,
    kamatera_server.manager,
    kamatera_server.backend,
    kamatera_server.db,
    kamatera_server.video,
  ]

  connection {
    type        = "ssh"
    host        = kamatera_server.manager.public_ips[0]
    user        = local.ssh_user
    private_key = file(local.ssh_private_key)
  }

  provisioner "remote-exec" {
    when = create
    inline = [
      # Idempotent: init only if not already a manager. Advertise on the
      # private network so inter-node traffic stays off the public internet.
      "if ! docker node ls >/dev/null 2>&1; then docker swarm init --advertise-addr ${kamatera_server.manager.name}; fi",
    ]
  }
}

# Capture the worker join token from the manager to the workstation.
resource "null_resource" "fetch_token" {
  depends_on = [null_resource.swarm_init]

  provisioner "local-exec" {
    command = <<-EOT
      ssh -o StrictHostKeyChecking=no -i ${local.ssh_private_key} ${local.ssh_user}@${kamatera_server.manager.public_ips[0]} \
        "docker swarm join-token -q worker" > ${path.module}/.swarm-worker-token
    EOT
  }
}

# Join each worker to the Swarm. Each is a self-contained local-exec that reads
# the token file (captured above) and SSHes the worker to join — no manager→
# worker SSH dependency, no token in Terraform state variables.
resource "null_resource" "join_worker" {
  depends_on = [null_resource.fetch_token]
  count      = 3 # backend, db, video

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      TOKEN=$(tr -d '[:space:]' < ${path.module}/.swarm-worker-token)
      ssh -o StrictHostKeyChecking=no -i ${local.ssh_private_key} ${local.ssh_user}@${local.worker_ips[count.index]} \
        "docker swarm join --token $${TOKEN} ${kamatera_server.manager.name}:2377" || true
    EOT
  }

  triggers = {
    token  = null_resource.fetch_token.id
    worker = local.worker_ips[count.index]
  }
}

# Label every node on the manager so the stack can pin services
# (constraints: node.labels.role == <role>).
resource "null_resource" "swarm_labels" {
  depends_on = [null_resource.join_worker]

  connection {
    type        = "ssh"
    host        = kamatera_server.manager.public_ips[0]
    user        = local.ssh_user
    private_key = file(local.ssh_private_key)
  }

  provisioner "remote-exec" {
    when = create
    inline = [
      "docker node update --label-add role=manager ${kamatera_server.manager.name}",
      "docker node update --label-add role=backend ${kamatera_server.backend.name}",
      "docker node update --label-add role=db      ${kamatera_server.db.name}",
      "docker node update --label-add role=video   ${kamatera_server.video.name}",
    ]
  }

  triggers = {
    manager = kamatera_server.manager.id
    backend = kamatera_server.backend.id
    db      = kamatera_server.db.id
    video   = kamatera_server.video.id
  }
}
