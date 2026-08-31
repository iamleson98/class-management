variable "cluster_name" {
  description = "Prefix for instance display names (also tags the SSH secret)."
  type        = string
  default     = "lms"
}

variable "region" {
  description = "Contabo region: EU, US-central, US-east, US-west or SIN."
  type        = string
  default     = "EU"

  validation {
    condition     = contains(["EU", "US-central", "US-east", "US-west", "SIN"], var.region)
    error_message = "region must be one of EU, US-central, US-east, US-west, SIN."
  }
}

variable "period" {
  description = "Contract period in months (1, 3, 6 or 12)."
  type        = number
  default     = 1

  validation {
    condition     = contains([1, 3, 6, 12], var.period)
    error_message = "period must be 1, 3, 6 or 12 months."
  }
}

variable "ssh_public_key" {
  description = "Public SSH key injected into every node (used by the deploy user and for panel installs)."
  type        = string
}

variable "manager_product_id" {
  description = "Contabo product ID for the manager node (edge + stateless services)."
  type        = string
  default     = "V15" # 4 vCPU / 8 GB class — check the product list
}

variable "enable_db_node" {
  description = "Provision a dedicated database node (postgres + rustfs). false = they run on the manager."
  type        = bool
  default     = false
}

variable "db_product_id" {
  description = "Contabo product ID for the database node."
  type        = string
  default     = "V30" # 6 vCPU / 12 GB class — check the product list
}

variable "enable_video_node" {
  description = "Provision a dedicated video node for rtcd (calls SFU). false = rtcd runs on the manager."
  type        = bool
  default     = false
}

variable "video_product_id" {
  description = "Contabo product ID for the video node (CPU + network heavy)."
  type        = string
  default     = "V50" # 8 vCPU / 16 GB class — check the product list
}
