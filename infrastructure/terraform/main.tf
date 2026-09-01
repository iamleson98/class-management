terraform {
  required_version = ">= 1.5.0"

  required_providers {
    kamatera = {
      source  = "Kamatera/kamatera"
      version = "~> 1.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}

# Authenticates via env vars: KAMATERA_API_CLIENT_ID, KAMATERA_API_SECRET
provider "kamatera" {}

# Resolve the datacenter id for the chosen zone (used by the private network).
data "kamatera_datacenter" "selected" {
  # zone == datacenter id in Kamatera's API
  id = var.kamatera_zone
}

# ── Private inter-node network ────────────────────────────────────────
# Swarm overlay traffic is encrypted and CAN run over public IPs, but a
# private VLAN keeps node-to-node traffic off the public internet and is
# usually free/cheap on Kamatera.
resource "kamatera_network" "swarm_net" {
  datacenter_id = data.kamatera_datacenter.selected.id
  name          = "lms-swarm-net"

  subnet {
    ip   = cidrhost(var.private_network_cidr, 0)
    bit  = split("/", var.private_network_cidr)[1]
  }
}

# Resolve the SSH public key (inline content takes precedence over file path).
locals {
  ssh_key = coalesce(var.ssh_public_key_content, file(pathexpand(var.ssh_public_key)))
}

# Random secrets generated once and reused by the app stack via outputs.
resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "random_password" "rustfs_secret_key" {
  length  = 24
  special = false # object-storage secret key charset constraints
}

resource "random_password" "grafana_admin_password" {
  length  = 24
  special = false
}

resource "random_password" "registry_password" {
  length  = 24
  special = false
}
