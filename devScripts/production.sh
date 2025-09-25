#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/deploy/apps/codexchristi"    # <-- adjust if needed
COMPOSE_FILE="$APP_DIR/docker-compose.yml"

# Use BuildKit-backed builds (faster, better caching)
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo "== deploy start $(date -u +%FT%TZ) =="
cd "$APP_DIR"

# Build images for both services in parallel (uses normal Docker layer cache)
docker compose -f "$COMPOSE_FILE" build --progress=plain --parallel

# Bring the stack up: app_build runs, copies .next into the volume, exits healthy
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# Optional light cleanup of dangling images older than 24h
docker image prune --force 
# --filter "until=24h" || true

echo "== deploy finished $(date -u +%FT%TZ) =="