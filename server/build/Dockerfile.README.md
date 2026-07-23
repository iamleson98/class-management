# Dockerfile for Building Mattermost Server from Source

This Dockerfile builds the Mattermost golang server from source code instead of downloading a prebuilt binary.

## Overview

The Dockerfile uses a multi-stage build approach:

### Stage 1: Builder
- Base: Ubuntu 20.04 (noble)
- Installs Go 1.24.11 (matching the project's `.go-version`)
- Installs build dependencies (git, build-essential, etc.)
- Installs document processing utilities (pdftotext, wv, unrtf, tidy)
- Builds the Mattermost server binary from source
- Builds the mmctl command-line tool
- Copies necessary runtime files (fonts, i18n, templates)

### Stage 2: Runtime
- Base: Distroless Debian 12 (minimal attack surface)
- Copies only the necessary binaries and runtime files from builder
- Runs as non-privileged user (mattermost)
- Includes document processing utilities and libraries
- Exposes ports: 8065, 8067, 8074, 8075

## Building the Docker Image

### Basic Build

From the server directory:

```bash
docker build -f build/Dockerfile -t mattermost-server:latest .
```

### Build with Custom Build Number

```bash
docker build -f build/Dockerfile \
  --build-arg BUILD_NUMBER=1.0.0 \
  -t mattermost-server:1.0.0 .
```

### Build with Custom User/Group IDs

```bash
docker build -f build/Dockerfile \
  --build-arg PUID=1000 \
  --build-arg PGID=1000 \
  -t mattermost-server:latest .
```

### Build with Custom Go Version

```bash
docker build -f build/Dockerfile \
  --build-arg GO_VERSION=1.24.11 \
  -t mattermost-server:latest .
```

## Running the Container

### Basic Run

```bash
docker run -d \
  --name mattermost \
  -p 8065:8065 \
  -v mattermost-data:/mattermost/data \
  -v mattermost-logs:/mattermost/logs \
  -v mattermost-config:/mattermost/config \
  mattermost-server:latest
```

### Run with Environment Variables

```bash
docker run -d \
  --name mattermost \
  -p 8065:8065 \
  -e MM_SQLSETTINGS_DRIVERNAME=postgres \
  -e MM_SQLSETTINGS_DATASOURCE="postgres://mmuser:password@postgres:5432/mattermost?sslmode=disable" \
  -v mattermost-data:/mattermost/data \
  -v mattermost-logs:/mattermost/logs \
  -v mattermost-config:/mattermost/config \
  mattermost-server:latest
```

## Build Arguments

- `PUID`: User ID for the mattermost user (default: 2000)
- `PGID`: Group ID for the mattermost group (default: 2000)
- `GO_VERSION`: Go version to install (default: 1.24.11)
- `BUILD_NUMBER`: Build number to embed in the binary (default: dev)

## Volumes

- `/mattermost/data`: Application data
- `/mattermost/logs`: Application logs
- `/mattermost/config`: Configuration files
- `/mattermost/plugins`: Plugin files
- `/mattermost/client/plugins`: Client plugin files

## Exposed Ports

- `8065`: Main HTTP port
- `8067`: Metrics port
- `8074`: Gossip protocol port
- `8075`: Performance monitoring port

## Features

- **Multi-stage build**: Separates build dependencies from runtime image
- **Minimal runtime image**: Uses distroless base for security
- **Document processing**: Includes utilities for PDF, Word, RTF processing
- **Non-root user**: Runs as unprivileged mattermost user
- **Health check**: Uses mmctl for container health monitoring
- **Build from source**: Compiles the server binary from the repository code

## Differences from Original Dockerfile

The original Dockerfile:
- Downloads a prebuilt Mattermost binary from releases.mattermost.com
- Uses a fixed MM_PACKAGE URL

This new Dockerfile:
- Builds the Mattermost server from source code
- Installs Go and build tools
- Compiles both mattermost and mmctl binaries
- Allows customization of build parameters

## Notes

- The build process requires the entire server source code as context
- Build time will be longer than the prebuilt version (due to compilation)
- The final image size may be larger due to the built binary
- All document processing utilities from the reference Dockerfile are included
- The runtime environment matches the original Dockerfile's configuration
