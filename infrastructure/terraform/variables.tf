# All deployment knobs. Copy envs/dev.tfvars.example → envs/dev.tfvars and adjust.
# Every value here is overridable via -var or a -var-file.

# ── Provider / location ──────────────────────────────────────────────
variable "kamatera_zone" {
  description = "Kamatera datacenter zone (e.g. ASIA-SOUTHEAST-1, US-EAST-1, ASIA-EAST-1)."
  type        = string
  default     = "ASIA-SOUTHEAST-1"
}

variable "server_image" {
  description = "OS image string. Verify in Kamatera Console; 64bit server template."
  type        = string
  default     = "ubuntu-22.04-server_64bit"
}

variable "billing" {
  description = "Billing model: 'hourly' or 'monthly'."
  type        = string
  default     = "monthly"
}

# ── Networking ────────────────────────────────────────────────────────
variable "private_network_cidr" {
  description = "CIDR for the inter-node private network."
  type        = string
  default     = "10.30.0.0/16"
}

# ── Access ────────────────────────────────────────────────────────────
variable "ssh_public_key" {
  description = "Path to the SSH public key injected into every server."
  type        = string
  default     = "~/.ssh/lms_swarm.pub"
}

variable "ssh_public_key_content" {
  description = "Inline SSH public key. If set, overrides ssh_public_key path."
  type        = string
  default     = null
}

# ── Server sizes (Kamatera CPU format: '<cores><type>', e.g. '2B' = 2 Type-B cores) ──
variable "manager_cpu" {
  type    = string
  default = "2B"
}

variable "manager_ram" {
  type    = string
  default = "8192"
} # MB

variable "manager_disk" {
  type    = string
  default = "50"
} # GB

variable "backend_cpu" {
  type    = string
  default = "2B"
}

variable "backend_ram" {
  type    = string
  default = "4096"
}

variable "backend_disk" {
  type    = string
  default = "50"
}

variable "db_cpu" {
  type    = string
  default = "2B"
}

variable "db_ram" {
  type    = string
  default = "8192"
}

variable "db_disk" {
  type    = string
  default = "80"
}

variable "video_cpu" {
  type    = string
  default = "4B"
}

variable "video_ram" {
  type    = string
  default = "8192"
}

variable "video_disk" {
  type    = string
  default = "50"
}
