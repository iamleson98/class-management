#!/bin/sh
# Docker entrypoint for the LMS backend (Alpine runtime).
#
# Mattermost reads its config directly from MM_* environment variables and does
# NOT support the *_FILE convention that some apps use with Docker secrets. This
# shim reads secret files (injected by Docker Swarm / Compose secrets at
# /run/secrets/<name>) and exports the corresponding MM_* env vars before
# exec-ing the server binary.
#
# Map: <ENV_VAR>=<secret_file_path> pairs, set via the SECRETS_MAP env var
# (space-separated). e.g. SECRETS_MAP="MM_SQLSETTINGS_DATASOURCE=db_dsn"
set -eu

# Default mapping (overridable via SECRETS_MAP env in the service definition).
# Each token is NAME=secret; we read /run/secrets/<secret> into $NAME.
SECRETS_MAP="${SECRETS_MAP:-MM_SQLSETTINGS_DATASOURCE=db_dsn MM_FILESETTINGS_AMAZONS3SECRETACCESSKEY=minio_root_password}"

for pair in $SECRETS_MAP; do
    var=${pair%%=*}
    secret=${pair#*=}
    file="/run/secrets/$secret"
    if [ -r "$file" ]; then
        # trim trailing newline/whitespace
        val=$(tr -d '\r\n' < "$file")
        export "$var=$val"
    fi
done

# Hand off to the server, passing through any args.
exec mattermost "$@"
