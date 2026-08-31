output "manager_ip" {
  description = "Public IPv4 of the manager node — point DNS A records at it (app/api/s3/grafana/traefik) and use it as CONTABO_SSH_HOST."
  value       = contabo_instance.manager.ip_config[0].v4[0].ip
}

output "db_node_ip" {
  description = "Public IPv4 of the database node (empty when not provisioned)."
  value       = var.enable_db_node ? contabo_instance.db[0].ip_config[0].v4[0].ip : ""
}

output "video_node_ip" {
  description = "Public IPv4 of the video node (empty when not provisioned) — this is RTCD_ICE_HOST_OVERRIDE."
  value       = var.enable_video_node ? contabo_instance.video[0].ip_config[0].v4[0].ip : ""
}

output "video2_node_ip" {
  description = "Public IPv4 of the second video node (empty when not provisioned) — this is RTCD2_ICE_HOST_OVERRIDE."
  value       = var.enable_video2_node ? contabo_instance.video2[0].ip_config[0].v4[0].ip : ""
}

output "swarm_setup_instructions" {
  description = "One-time steps to run after apply."
  value       = <<-EOT
    1. Wait for cloud-init to finish on every node (2-5 min):
         ssh root@${contabo_instance.manager.ip_config[0].v4[0].ip} 'cloud-init status --wait; docker --version'
    2. On the manager:
         docker swarm init --advertise-addr ${contabo_instance.manager.ip_config[0].v4[0].ip}
    3. Join workers (run the printed command on each worker node):
         docker swarm join-token worker
    4. Tag roles on the manager:
         docker node update --label-add role=db <db-node>      # only with enable_db_node
         docker node update --label-add role=video <video>    # only with enable_video_node
         docker node update --label-add rtcd=2 <video2>       # only with enable_video2_node
    5. DNS: point app.<domain>, api.<domain>, s3.<domain>, grafana.<domain>, traefik.<domain> at ${contabo_instance.manager.ip_config[0].v4[0].ip}
    6. Deploy:
         cd deploy/swarm && cp .env.example .env && $EDITOR .env && ./secrets-bootstrap.sh && ./deploy.sh
  EOT
}
