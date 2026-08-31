#!/bin/sh
# Docker entrypoint for the LMS backend (Alpine runtime).
#
# The server reads its config directly from MM_* environment variables and does
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
SECRETS_MAP="${SECRETS_MAP:-MM_SQLSETTINGS_DATASOURCE=db_dsn MM_FILESETTINGS_AMAZONS3SECRETACCESSKEY=rustfs_secret_key}"

for pair in $SECRETS_MAP; do
    var=${pair%%=*}
    secret=${pair#*=}
    file="/run/secrets/$secret"
    if [ -r "$file" ]; then
        # trim trailing newline/whitespace
        val=$(tr -d '\r\n' < "$file")
        export "$var=$val"
    else
        echo "docker-entrypoint: warning: secret '${secret}' (for ${var}) is not readable at ${file}" >&2
    fi
done

# Hand off to the server, passing through any args.
# The binary is 'sitename' (see server/Dockerfile: ./cmd/sitename).
exec sitename "$@"
