# Complete Deployment Guide - LMS System

This guide provides comprehensive instructions for deploying the LMS (Learning Management System) across different environments. The system consists of a Go backend (Mattermost-based), Next.js frontend, PostgreSQL database, MinIO object storage, and observability stack.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Deployment Options](#deployment-options)
3. [Prerequisites](#prerequisites)
4. [Option A: Docker Swarm on Kamatera (Production)](#option-a-docker-swarm-on-kamatera-production)
5. [Option B: Single-Host Docker Compose (Development/Staging)](#option-b-single-host-docker-compose-developmentstaging)
6. [Container Images](#container-images)
7. [Configuration Management](#configuration-management)
8. [Secrets Management](#secrets-management)
9. [Observability & Monitoring](#observability--monitoring)
10. [Troubleshooting](#troubleshooting)
11. [Maintenance & Updates](#maintenance--updates)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     LMS System Architecture                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Frontend   │    │   Backend    │    │   Database   │      │
│  │  (Next.js)   │───▶│  (Go API)    │───▶│ (PostgreSQL) │      │
│  │   :3000      │    │   :8065      │    │   :5432      │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                              │                   │              │
│                              ▼                   │              │
│                     ┌──────────────┐            │              │
│                     │  MinIO (S3)  │            │              │
│                     │  :9000/:9001 │◀───────────┘              │
│                     └──────────────┘                           │
│                              │                                  │
│                              ▼                                  │
│                     ┌──────────────┐                           │
│                     │  Observability                          │
│                     │  Prometheus :9090                       │
│                     │  Grafana    :3001                       │
│                     └──────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

### Component Details

| Component | Technology | Purpose | Ports |
|-----------|-----------|---------|-------|
| **Frontend** | Next.js | User interface, API proxy | 3000 |
| **Backend** | Go (Mattermost) | REST API, business logic | 8065 (API), 8067 (metrics) |
| **Database** | PostgreSQL 14 | Persistent data storage | 5432 |
| **Object Storage** | MinIO | File uploads, S3-compatible | 9000 (API), 9001 (console) |
| **Monitoring** | Prometheus | Metrics collection | 9090 |
| **Visualization** | Grafana | Metrics dashboards | 3001 |
| **Reverse Proxy** | Traefik (Swarm only) | TLS termination, routing | 80, 443 |
| **Registry** | Docker Registry (Swarm only) | Private image registry | 5000 |

---

## Deployment Options

### Option A: Docker Swarm on Kamatera (Production)

**Use when:** You need a production-grade, scalable, multi-server deployment with automatic TLS, high availability, and proper separation of concerns.

**Infrastructure:** 4 Kamatera VMs orchestrated by Docker Swarm
- **Manager node**: Traefik (TLS), private registry, frontend, observability
- **Backend node**: Go API (lms-server) + MinIO (uploads)
- **Database node**: PostgreSQL
- **Video node**: Reserved for future video-call service

**Features:**
- Automatic HTTPS via Let's Encrypt
- Private Docker registry for image distribution
- Node-based service placement
- Rolling updates with zero-downtime deployments
- Centralized secrets management
- Built-in observability stack

### Option B: Single-Host Docker Compose (Development/Staging)

**Use when:** You need a simple deployment for development, testing, or a single small server.

**Infrastructure:** All services on a single machine
- No clustering or high availability
- No built-in TLS (add your own reverse proxy if needed)
- Simplified operations
- Quick startup and teardown

**Features:**
- Quick setup with minimal configuration
- Ideal for development and testing
- Easy to run on local hardware or single VM
- Full observability stack included

---

## Prerequisites

### Common Requirements

- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 2.0 or higher
- **Git**: For cloning the repository
- **Domain name**: For production deployment (with DNS configured)

### Additional Requirements for Swarm Deployment

- **Terraform**: Version 1.5 or higher
- **Kamatera API credentials**: Client ID and secret
- **SSH key pair**: For VM access
- **Kamatera account**: With sufficient quota for 4 VMs

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 2 cores | 4+ cores |
| **RAM** | 4 GB | 8+ GB |
| **Storage** | 20 GB | 50+ GB SSD |
| **Network** | 100 Mbps | 1 Gbps |

---

## Option A: Docker Swarm on Kamatera (Production)

### A.1 Initial Setup

#### 1. Obtain Kamatera API Credentials

```bash
# From Kamatera Console → API → create credentials
export KAMATERA_API_CLIENT_ID="your-client-id"
export KAMATERA_API_SECRET="your-secret"
```

#### 2. Generate SSH Key Pair

```bash
ssh-keygen -t ed25519 -f ~/.ssh/lms_swarm -N ""
```

#### 3. Configure Terraform Variables

```bash
cd infrastructure/terraform
cp envs/dev.tfvars.example envs/dev.tfvars
```

Edit `envs/dev.tfvars` with your configuration:

```hcl
# Kamatera configuration
zone = "NJ-US-WEST-1"
server_size = "1ACPU.2048RAM.20GBDISK"

# SSH configuration
ssh_public_key_path = "~/.ssh/lms_swarm.pub"

# Optional: Set registry password (null = open registry)
registry_htpasswd = null
```

### A.2 Provision Infrastructure

```bash
cd infrastructure/terraform
terraform init
terraform plan -var-file=envs/dev.tfvars
terraform apply -var-file=envs/dev.tfvars
```

This process:
- Creates 4 Kamatera VMs in a private network
- Installs Docker on each server
- Forms a Docker Swarm cluster
- Labels each node with its role (manager, backend, db, video)
- Generates secure passwords for all services

#### Verify Cluster Formation

```bash
terraform output -raw swarm_check | sh
```

Expected output: 4 nodes with their roles labeled

```bash
ssh -i ~/.ssh/lms_swarm root@<manager-ip> "docker node ls"
```

### A.3 Configure DNS

Create A records pointing to your manager's public IP:

| Subdomain | Purpose |
|-----------|---------|
| `app.example.com` | Frontend application |
| `api.example.com` | Backend API |
| `minio.example.com` | MinIO console |
| `grafana.example.com` | Grafana dashboards |
| `traefik.example.com` | Traefik dashboard |

### A.4 Deploy Application Stack

#### 1. Configure Swarm Environment

```bash
cd deploy/swarm
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Domain configuration
DOMAIN=example.com
ACME_EMAIL=you@example.com

# Traefik dashboard authentication
TRAEFIK_AUTH=admin:$$apr1$$xyz$$REPLACE_ME

# Registry configuration
REGISTRY=127.0.0.1:5000
REGISTRY_USERNAME=lms
REGISTRY_PASSWORD=  # Set by secrets-bootstrap.sh

# Image tag
TAG=latest

# Timezone
TZ=UTC
```

Generate Traefik authentication:

```bash
htpasswd -nb admin 'yourpassword' | sed 's/\$/\$\$/g'
```

#### 2. Bootstrap Secrets

```bash
./secrets-bootstrap.sh
```

This script:
- Retrieves generated passwords from Terraform outputs
- Creates Docker Swarm secrets for:
  - Database password
  - MinIO root password
  - Grafana admin password
  - Registry credentials
  - Database connection string (DSN)

#### 3. Configure Registry Authentication

```bash
./registry-auth.sh
```

This distributes registry credentials to all Swarm nodes.

#### 4. Build and Push Images

```bash
./build-and-push.sh
```

This script:
- Builds the backend and frontend images
- Tags them for the private registry
- Pushes them to the in-cluster registry

**Note:** Run this where Docker can reach `127.0.0.1:5000`, either:
- On the manager node directly
- Via SSH tunnel: `ssh -L 5000:127.0.0.1:5000 root@<manager-ip>`

#### 5. Deploy Stack

```bash
./deploy.sh
```

This executes `docker stack deploy` with the stack configuration.

### A.5 Verify Deployment

```bash
# Check services
docker service ls

# Check service logs
docker service logs lms_lms-server -f
docker service logs lms_lms-fe -f

# Check node placement
docker node ls
```

### A.6 Access Your Applications

After DNS propagation, access your applications:

- **Frontend**: https://app.example.com
- **Backend API**: https://api.example.com
- **MinIO Console**: https://minio.example.com
- **Grafana**: https://grafana.example.com (admin/generated-password)
- **Traefik Dashboard**: https://traefik.example.com (admin/your-password)

### A.7 Service Placement

| Service | Node Label | Replicas | Purpose |
|---------|------------|----------|---------|
| traefik | manager | 1 | TLS termination, routing |
| registry | manager | 1 | Private image registry |
| postgres | db | 1 | Database |
| minio | backend | 1 | Object storage |
| lms-server | backend | 1 | Backend API |
| lms-fe | manager | 1 | Frontend |
| prometheus | manager | 1 | Metrics collection |
| grafana | manager | 1 | Metrics visualization |

---

## Option B: Single-Host Docker Compose (Development/Staging)

### B.1 Initial Setup

#### 1. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Host ports
BACKEND_PORT=8065
FRONTEND_PORT=3000
MINIO_CONSOLE_PORT=9001
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
TZ=UTC

# PostgreSQL
POSTGRES_USER=mmuser
POSTGRES_PASSWORD=change-me-to-a-strong-password
POSTGRES_DB=mattermost
MM_SQLSETTINGS_DATASOURCE=postgres://mmuser:change-me-to-a-strong-password@postgres:5432/mattermost?sslmode=disable&connect_timeout=10

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=change-me-minio-secret
MM_FILESETTINGS_AMAZONS3_BUCKET=lms-uploads

# Backend
MM_SERVICESETTINGS_SITEURL=http://localhost:8065

# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=change-me-grafana-admin
```

### B.2 Deploy Services

```bash
docker compose up -d
```

This starts all services in detached mode.

### B.3 Verify Deployment

```bash
# Check service status
docker compose ps

# Check logs
docker compose logs -f lms-server
docker compose logs -f lms-fe
```

### B.4 Access Your Applications

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8065
- **MinIO Console**: http://localhost:9001 (minioadmin/your-password)
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/your-password)

### B.5 Service Management

```bash
# View logs
docker compose logs -f [service-name]

# Stop services
docker compose down

# Stop and remove volumes
docker compose down -v

# Restart a specific service
docker compose restart lms-server

# Rebuild and restart
docker compose up -d --build lms-server
```

---

## Container Images

### Backend Image (`server/Dockerfile`)

Multi-stage build producing a minimal Alpine runtime:

**Build Stage:**
- Base: `golang:1.26-alpine`
- Installs: git, gcc, musl-dev
- Builds: Mattermost server binary + mmctl CLI
- Tags: `enterprise` for LMS API endpoints
- Output: Optimized Go binaries

**Runtime Stage:**
- Base: `alpine:3.20`
- Installs: ca-certificates, tzdata, curl
- Creates: mattermost user (UID 2000)
- Copies: Binaries, i18n, fonts, templates
- Includes: Secret-mapping entrypoint script
- Exposes: 8065 (API), 8067 (metrics), 8074 (local-mode), 8075 (profiling)
- Healthcheck: HTTP ping to `/api/v4/system/ping`

**Secret Mapping:**
The entrypoint script (`server/build/docker-entrypoint.sh`) handles Docker secrets since Mattermost doesn't support the `*_FILE` convention:

```bash
SECRETS_MAP="MM_SQLSETTINGS_DATASOURCE=db_dsn MM_FILESETTINGS_AMAZONS3SECRETACCESSKEY=minio_root_password"
```

### Frontend Image (`lms-fe/Dockerfile`)

Multi-stage build producing a standalone Next.js runtime:

**Dependencies Stage:**
- Base: `node:20-alpine`
- Package manager: bun 1.2.0
- Installs: Dependencies from bun.lock

**Build Stage:**
- Base: `node:20-alpine`
- Builds: Next.js standalone output
- Environment variables: `NEXT_PUBLIC_API_URL` baked in
- Output: Optimized `.next/standalone` directory

**Runtime Stage:**
- Base: `node:20-alpine`
- User: nextjs (UID 1001)
- Copies: Standalone output, static files, public assets
- Exposes: 3000
- Healthcheck: HTTP ping to `/api/v4/system/ping`
- Command: `node server.js`

**Build Arguments:**
- `NEXT_PUBLIC_API_URL`: Backend API URL (default: `http://lms-server:8065`)

---

## Configuration Management

### Environment Variables

#### Backend Configuration

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `MM_SQLSETTINGS_DRIVERNAME` | Database driver | postgres | Yes |
| `MM_SQLSETTINGS_DATASOURCE` | Database connection string | - | Yes |
| `MM_FILESETTINGS_DRIVERNAME` | File storage driver | amazons3 | Yes |
| `MM_FILESETTINGS_AMAZONS3ACCESSKEYID` | S3 access key | minioadmin | Yes |
| `MM_FILESETTINGS_AMAZONS3SECRETACCESSKEY` | S3 secret key | - | Yes |
| `MM_FILESETTINGS_AMAZONS3BUCKET` | S3 bucket name | lms-uploads | Yes |
| `MM_FILESETTINGS_AMAZONS3ENDPOINT` | S3 endpoint | http://minio:9000 | Yes |
| `MM_FILESETTINGS_AMAZONS3SSL` | Use SSL for S3 | false | Yes |
| `MM_FILESETTINGS_AMAZONS3REGION` | S3 region | us-east-1 | Yes |
| `MM_METRICSSETTINGS_ENABLE` | Enable metrics | true | Yes |
| `MM_METRICSSETTINGS_LISTENADDRESS` | Metrics port | :8067 | Yes |
| `MM_SERVICESETTINGS_SITEURL` | Public URL | http://localhost:8065 | Yes |
| `MM_SERVICESETTINGS_ENABLELOCALMODE` | Enable local mode | true | Yes |
| `MM_SERVICESETTINGS_ALLOWEDUNTRUSTEDINTERNALCONNECTIONS` | Allowed internal connections | minio,postgres | Yes |
| `MM_NO_DOCKER` | Disable Docker detection | true | Yes |
| `MM_INSTALL_TYPE` | Installation type | docker | Yes |
| `TZ` | Timezone | UTC | No |

#### Frontend Configuration

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | http://lms-server:8065 | Yes |
| `NODE_ENV` | Node environment | production | Yes |
| `TZ` | Timezone | UTC | No |

#### Database Configuration

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `POSTGRES_USER` | Database user | mmuser | Yes |
| `POSTGRES_PASSWORD` | Database password | - | Yes |
| `POSTGRES_DB` | Database name | mattermost | Yes |

#### MinIO Configuration

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `MINIO_ROOT_USER` | MinIO admin user | minioadmin | Yes |
| `MINIO_ROOT_PASSWORD` | MinIO admin password | - | Yes |

#### Grafana Configuration

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `GF_SECURITY_ADMIN_USER` | Grafana admin user | admin | Yes |
| `GF_SECURITY_ADMIN_PASSWORD` | Grafana admin password | - | Yes |
| `GF_USERS_ALLOW_SIGN_UP` | Allow user sign-up | false | Yes |

### Configuration Files

#### Prometheus Configuration (`observability/prometheus.yml`)

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 60s

scrape_configs:
  - job_name: "lms-server"
    metrics_path: "/metrics"
    static_configs:
      - targets: ["lms-server:8067"]
        labels:
          service: "lms-server"

  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]
```

#### Grafana Provisioning

Grafana is auto-provisioned with:
- Prometheus datasource
- Dashboard provider for loading dashboards

Configuration location: `observability/grafana/provisioning/`

---

## Secrets Management

### Docker Compose Secrets

For development/staging, secrets are managed via environment variables in `.env`:

```bash
# Generate secure passwords
POSTGRES_PASSWORD=$(openssl rand -base64 32)
MINIO_ROOT_PASSWORD=$(openssl rand -base64 32)
GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 32)
```

### Docker Swarm Secrets

For production, secrets are managed via Docker Swarm's encrypted raft store:

#### Secret Creation

```bash
./secrets-bootstrap.sh
```

This creates the following secrets:

| Secret Name | Purpose | Source |
|-------------|---------|--------|
| `db_password` | PostgreSQL password | Terraform output |
| `db_dsn` | Database connection string | Generated from db_password |
| `minio_root_password` | MinIO admin password | Terraform output |
| `grafana_admin_password` | Grafana admin password | Terraform output |
| `registry_htpasswd` | Registry authentication | Terraform output |

#### Secret Usage

Services reference secrets in `stack.yml`:

```yaml
postgres:
  secrets:
    - source: db_password
      target: /run/secrets/db_password
  environment:
    POSTGRES_PASSWORD_FILE: /run/secrets/db_password
```

#### Secret Mapping for Backend

Since Mattermost doesn't support `*_FILE` environment variables, the backend entrypoint script maps secrets to environment variables:

```yaml
lms-server:
  environment:
    SECRETS_MAP: "MM_SQLSETTINGS_DATASOURCE=db_dsn MM_FILESETTINGS_AMAZONS3SECRETACCESSKEY=minio_root_password"
  secrets:
    - db_dsn
    - minio_root_password
```

#### Secret Management Commands

```bash
# List secrets
docker secret ls

# Inspect a secret
docker secret inspect <secret-name>

# Remove a secret
docker secret rm <secret-name>

# Update a secret (remove and recreate)
docker secret rm <secret-name>
echo "new-value" | docker secret create <secret-name> -
```

---

## Observability & Monitoring

### Metrics Collection

The backend exposes Prometheus metrics on port 8067:

- HTTP request metrics
- Database connection metrics
- Business logic metrics
- Custom LMS-specific metrics

### Prometheus

**Access:** http://localhost:9090 (compose) or https://grafana.example.com (swarm)

**Features:**
- 15-second scrape interval
- 15-day data retention
- Auto-discovery of services
- Query language for custom metrics

**Configuration:** `observability/prometheus.yml`

### Grafana

**Access:** http://localhost:3001 (compose) or https://grafana.example.com (swarm)

**Default credentials:** admin/generated-password

**Features:**
- Pre-configured Prometheus datasource
- Dashboard auto-provisioning
- Custom dashboard support
- Alert management

**Adding Dashboards:**

1. Export dashboard JSON from Grafana
2. Place in `observability/grafana/dashboards/`
3. Restart Grafana service

### Health Checks

All services include health checks:

| Service | Check | Interval | Timeout |
|---------|-------|----------|---------|
| postgres | `pg_isready` | 10s | 5s |
| minio | HTTP `/minio/health/live` | 15s | 5s |
| lms-server | HTTP `/api/v4/system/ping` | 30s | 10s |
| lms-fe | HTTP `/api/v4/system/ping` | 30s | 10s |
| traefik | `traefik healthcheck` | 30s | 5s |

### Monitoring Commands

```bash
# Docker Compose
docker compose ps
docker compose logs -f [service]

# Docker Swarm
docker service ls
docker service ps lms_lms-server
docker service logs lms_lms-server -f

# Check resource usage
docker stats
```

---

## Troubleshooting

### Common Issues

#### 1. Services Won't Start

**Symptoms:** Services show as "starting" or fail health checks

**Solutions:**
```bash
# Check service logs
docker compose logs -f [service-name]
docker service logs lms_[service-name] -f

# Verify configuration
docker compose config
docker stack config --resolve-image-digests -c stack.yml

# Check resource availability
docker system df
docker stats
```

#### 2. Database Connection Failures

**Symptoms:** Backend can't connect to PostgreSQL

**Solutions:**
```bash
# Verify database is healthy
docker compose exec postgres pg_isready -U mmuser
docker service logs lms_postgres -f

# Check connection string
echo $MM_SQLSETTINGS_DATASOURCE

# Verify network connectivity
docker compose exec lms-server ping postgres
```

#### 3. MinIO Connection Issues

**Symptoms:** File uploads fail, can't access MinIO console

**Solutions:**
```bash
# Check MinIO health
docker compose exec minio curl -f http://localhost:9000/minio/health/live

# Verify bucket exists
docker compose exec minio-init mc ls local/

# Check credentials
echo $MINIO_ROOT_USER
echo $MINIO_ROOT_PASSWORD
```

#### 4. TLS Certificate Issues (Swarm)

**Symptoms:** HTTPS not working, certificate errors

**Solutions:**
```bash
# Check Traefik logs
docker service logs lms_traefik -f

# Verify DNS configuration
dig app.example.com
dig api.example.com

# Check ACME configuration
docker service inspect lms_traefik

# Force certificate renewal
docker service update --force lms_traefik
```

#### 5. Image Build Failures

**Symptoms:** Can't build Docker images

**Solutions:**
```bash
# Clean build cache
docker builder prune

# Check build logs
docker compose build --no-cache lms-server

# Verify dependencies
cd server
go mod download
go mod verify
```

#### 6. Registry Authentication Issues (Swarm)

**Symptoms:** Can't push/pull images from private registry

**Solutions:**
```bash
# Re-run registry authentication
./registry-auth.sh

# Verify registry is accessible
curl http://127.0.0.1:5000/v2/

# Check registry logs
docker service logs lms_registry -f

# Verify secrets
docker secret ls | grep registry
```

### Debug Mode

Enable debug logging by setting environment variables:

```bash
# Backend
MM_LOGSETTINGS_ENABLEFILE=true
MM_LOGSETTINGS_FILELEVEL=DEBUG

# Traefik (Swarm)
# Add to stack.yml command:
- --log.level=DEBUG
```

### Log Management

```bash
# View logs with limits
docker compose logs --tail=100 lms-server
docker service logs --tail=100 lms_lms-server

# Export logs
docker compose logs > deployment.log
docker service logs lms_lms-server > backend.log

# Configure log rotation (Swarm)
# Already configured in stack.yml:
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
```

---

## Maintenance & Updates

### Updating Applications

#### Docker Compose

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose up -d --build

# Or update specific service
docker compose up -d --build lms-server
```

#### Docker Swarm

```bash
# Pull latest code
git pull

# Build and push new images
TAG=v2 ./build-and-push.sh

# Deploy with new tag
TAG=v2 ./deploy.sh

# Or rolling update
docker service update --image ${REGISTRY}/lms-server:v2 lms_lms-server
```

### Database Maintenance

#### Backups

```bash
# Docker Compose
docker compose exec postgres pg_dump -U mmuser mattermost > backup.sql

# Docker Swarm
docker exec $(docker ps -q -f name=lms_postgres) pg_dump -U mmuser mattermost > backup.sql
```

#### Restore

```bash
# Docker Compose
cat backup.sql | docker compose exec -T postgres psql -U mmuser mattermost

# Docker Swarm
cat backup.sql | docker exec -i $(docker ps -q -f name=lms_postgres) psql -U mmuser mattermost
```

### Volume Management

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect lms_pgdata

# Backup volume
docker run --rm -v lms_pgdata:/data -v $(pwd):/backup alpine tar czf /backup/pgdata.tar.gz /data

# Restore volume
docker run --rm -v lms_pgdata:/data -v $(pwd):/backup alpine tar xzf /backup/pgdata.tar.gz -C /
```

### System Cleanup

```bash
# Remove unused containers
docker container prune

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune

# Complete cleanup
docker system prune -a --volumes
```

### Scaling Services

#### Docker Compose

```bash
# Scale a service
docker compose up -d --scale lms-server=3
```

#### Docker Swarm

```bash
# Scale a service
docker service scale lms_lms-server=3

# Update replicas in stack.yml and redeploy
./deploy.sh
```

### Adding the Video Service (Swarm)

The `video` node is already provisioned and labeled. To add the video service:

1. Add service block to `deploy/swarm/stack.yml`:

```yaml
video-service:
  image: your-video-image:latest
  deploy:
    replicas: 1
    placement:
      constraints: ["node.labels.role == video"]
  networks: [lms_overlay]
```

2. Deploy the updated stack:

```bash
./deploy.sh
```

### Disaster Recovery

#### Backup Procedure

```bash
# 1. Backup database
docker exec $(docker ps -q -f name=lms_postgres) pg_dump -U mmuser mattermost > db_backup.sql

# 2. Backup volumes
docker run --rm -v lms_pgdata:/data -v $(pwd):/backup alpine tar czf /backup/pgdata.tar.gz /data
docker run --rm -v lms_miniodata:/data -v $(pwd):/backup alpine tar czf /backup/miniodata.tar.gz /data

# 3. Backup configuration
cp .env .env.backup
cp deploy/swarm/.env deploy/swarm/.env.backup
```

#### Restore Procedure

```bash
# 1. Restore database
cat db_backup.sql | docker exec -i $(docker ps -q -f name=lms_postgres) psql -U mmuser mattermost

# 2. Restore volumes
docker run --rm -v lms_pgdata:/data -v $(pwd):/backup alpine tar xzf /backup/pgdata.tar.gz -C /
docker run --rm -v lms_miniodata:/data -v $(pwd):/backup alpine tar xzf /backup/miniodata.tar.gz -C /

# 3. Restore configuration
cp .env.backup .env
cp deploy/swarm/.env.backup deploy/swarm/.env

# 4. Restart services
docker compose down && docker compose up -d
# or
./deploy.sh
```

---

## Security Considerations

### Production Security Checklist

- [ ] Change all default passwords
- [ ] Enable TLS/HTTPS everywhere
- [ ] Restrict MinIO console access
- [ ] Use strong secret values
- [ ] Enable firewall rules
- [ ] Regular security updates
- [ ] Monitor logs for suspicious activity
- [ ] Implement backup strategy
- [ ] Use private networks where possible
- [ ] Enable audit logging

### Network Security

```bash
# Docker Compose: Services on isolated network
networks:
  lms-net:
    driver: bridge

# Docker Swarm: Encrypted overlay network
networks:
  lms_overlay:
    driver: overlay
    encrypted: true
```

### Access Control

- Traefik dashboard protected by basic auth
- Grafana admin password set via secret
- MinIO console accessible via domain only
- Database not exposed to internet
- Internal service communication via overlay network

---

## Performance Tuning

### Database Optimization

```bash
# Connect to database
docker compose exec postgres psql -U mmuser mattermost

# Check configuration
SHOW ALL;

# Adjust shared_buffers (typically 25% of RAM)
ALTER SYSTEM SET shared_buffers = '2GB';

# Adjust effective_cache_size (typically 50-75% of RAM)
ALTER SYSTEM SET effective_cache_size = '4GB';

# Reload configuration
SELECT pg_reload_conf();
```

### Backend Performance

```bash
# Increase worker connections
MM_SERVICESETTINGS_MAXWEBHOOKCONNECTORSPERSECOND=100

# Enable caching
MM_CACHESETTINGS_ENABLE=true
MM_CACHESETTINGS_MAXCACHESIZE=1000

# Tune database pool
MM_SQLSETTINGS_MAXOPENCONNS=100
MM_SQLSETTINGS_MAXIDLECONNS=10
```

### Resource Limits

Add to service configuration:

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 4G
    reservations:
      cpus: '1.0'
      memory: 2G
```

---

## Support and Documentation

### Additional Resources

- **Terraform Documentation**: https://terraform.io/docs
- **Docker Documentation**: https://docs.docker.com
- **Docker Swarm Documentation**: https://docs.docker.com/engine/swarm
- **Traefik Documentation**: https://doc.traefik.io
- **Prometheus Documentation**: https://prometheus.io/docs
- **Grafana Documentation**: https://grafana.com/docs
- **Mattermost Documentation**: https://docs.mattermost.com

### Getting Help

For issues specific to this deployment:

1. Check this documentation
2. Review logs for error messages
3. Verify configuration in `.env` files
4. Check service health status
5. Review troubleshooting section

---

## Appendix

### Quick Reference Commands

```bash
# Docker Compose
docker compose up -d                    # Start services
docker compose down                     # Stop services
docker compose logs -f [service]        # View logs
docker compose ps                       # Service status
docker compose exec [service] sh        # Shell access

# Docker Swarm
docker stack deploy -c stack.yml lms    # Deploy stack
docker stack rm lms                     # Remove stack
docker service ls                       # List services
docker service logs lms_[service] -f    # View logs
docker service ps lms_[service]         # Service tasks
docker node ls                          # List nodes

# Terraform
terraform init                          # Initialize
terraform plan                          # Preview changes
terraform apply                         # Apply changes
terraform destroy                       # Destroy infrastructure
terraform output                        # View outputs
```

### File Structure

```
trip-booking/
├── docker-compose.yml                 # Single-host deployment
├── .env.example                       # Environment variables template
├── DEPLOY.md                          # This file
├── infrastructure/
│   ├── README.md                      # Infrastructure overview
│   └── terraform/
│       ├── main.tf                    # Terraform configuration
│       ├── variables.tf               # Variable definitions
│       ├── servers.tf                 # Server provisioning
│       ├── outputs.tf                 # Output definitions
│       └── envs/
│           └── dev.tfvars.example    # Environment variables
├── deploy/
│   ├── swarm/
│   │   ├── stack.yml                  # Swarm stack definition
│   │   ├── .env.example               # Swarm environment
│   │   ├── secrets-bootstrap.sh       # Secret creation
│   │   ├── build-and-push.sh          # Image build
│   │   ├── deploy.sh                  # Stack deployment
│   │   ├── registry-auth.sh           # Registry auth
│   │   └── README.md                  # Swarm deployment guide
├── server/
│   ├── Dockerfile                     # Backend image
│   └── build/
│       └── docker-entrypoint.sh       # Secret mapping
├── lms-fe/
│   └── Dockerfile                     # Frontend image
└── observability/
    ├── prometheus.yml                 # Prometheus config
    └── grafana/
        └── provisioning/              # Grafana auto-provisioning
```

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-07-26 | Initial comprehensive deployment guide |

---

**Note:** This deployment guide assumes you have the necessary permissions and access to the required services. Always test deployment procedures in a non-production environment before applying them to production systems.
