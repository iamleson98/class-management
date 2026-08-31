# Provision the LMS Docker Swarm nodes on Contabo.
#
# Auth (from the Contabo panel → API section):
#   export CONTABO_CLIENT_ID=...        # OAuth2 client id
#   export CONTABO_CLIENT_SECRET=...    # OAuth2 client secret
#   export CONTABO_USER=...             # panel username
#   export CONTABO_PASS=...             # panel password
#
# Usage:
#   cd infrastructure/terraform-contabo
#   cp envs/contabo.tfvars.example envs/contabo.tfvars
#   # pick product IDs (see https://contabo.com/en/product-list/?show_ids=true)
#   terraform init
#   terraform apply -var-file=envs/contabo.tfvars
#
# After apply: SSH to the manager (output: manager_ip) and form the swarm —
# the instances boot with Docker preinstalled (cloud-init), but swarm
# formation is a one-time manual step (deliberate: joining nodes to a cluster
# is a stateful operation you want to watch):
#   ssh deploy@<manager_ip>
#   docker swarm init
#   docker swarm join-token worker   # run the printed command on each worker
#   docker node update --label-add role=video <node>   # etc.
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    contabo = {
      source  = "contabo/contabo"
      version = "0.1.44"
    }
  }
}

provider "contabo" {}

locals {
  cloud_init = templatefile("${path.module}/../../deploy/cloud-init/contabo.yaml", {
    ssh_public_key = var.ssh_public_key
  })
}

# SSH key registered in Contabo's secrets API — injected into each instance
# at (re-)install time for the default user.
resource "contabo_secret" "ssh_key" {
  name  = "lms-swarm-ssh-${var.cluster_name}"
  type  = "ssh"
  value = var.ssh_public_key
}

# ── Nodes ─────────────────────────────────────────────────────────────────
# Sizing guidance (Contabo product IDs, check the product list for current
# IDs/prices):
#   manager : small is fine (edge + stateless) — e.g. a Cloud VPS line
#   db      : RAM-heavy (postgres + rustfs) — memory is the constraint
#   video   : CPU + network heavy (rtcd SFU) — a VDS line is recommended
# For a single-node deployment set enable_db_node/enable_video_node = false
# and size the manager node for the whole stack (8 vCPU / 16 GB+).

resource "contabo_instance" "manager" {
  display_name = "${var.cluster_name}-manager"
  product_id   = var.manager_product_id
  region       = var.region
  period       = var.period
  default_user = "root"
  ssh_keys     = [contabo_secret.ssh_key.id]
  user_data    = local.cloud_init
}

resource "contabo_instance" "db" {
  count = var.enable_db_node ? 1 : 0

  display_name = "${var.cluster_name}-db"
  product_id   = var.db_product_id
  region       = var.region
  period       = var.period
  default_user = "root"
  ssh_keys     = [contabo_secret.ssh_key.id]
  user_data    = local.cloud_init
}

resource "contabo_instance" "video" {
  count = var.enable_video_node ? 1 : 0

  display_name = "${var.cluster_name}-video"
  product_id   = var.video_product_id
  region       = var.region
  period       = var.period
  default_user = "root"
  ssh_keys     = [contabo_secret.ssh_key.id]
  user_data    = local.cloud_init
}

# Second video node for the rtcd SFU pool (lms-rtcd2 in the stack).
# Only needed when call volume outgrows one SFU node — see DEPLOY.md
# "Scaling the SFU pool".
resource "contabo_instance" "video2" {
  count = var.enable_video2_node ? 1 : 0

  display_name = "${var.cluster_name}-video2"
  product_id   = var.video2_product_id
  region       = var.region
  period       = var.period
  default_user = "root"
  ssh_keys     = [contabo_secret.ssh_key.id]
  user_data    = local.cloud_init
}
