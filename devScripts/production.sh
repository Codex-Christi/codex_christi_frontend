#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/root/apps/codexchristi"     # <- adjust if needed
COMPOSE_FILE="$APP_DIR/docker-compose.yml"
BUILDER_NAME="codex-builder-codexchristi"

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo "== deploy start $(date -u +%FT%TZ) =="
cd "$APP_DIR"

# ensure builder exists on docker driver (fast loads)
if ! docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
  docker buildx create --name "$BUILDER_NAME" --driver docker --use
else
  docker buildx use "$BUILDER_NAME"
fi
docker buildx inspect --bootstrap "$BUILDER_NAME"

# Build in parallel (layer cache will be reused automatically)
docker compose -f "$COMPOSE_FILE" build --progress=plain --parallel

# Start (app_build copies .next -> volume; app serves it)
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# Light cleanup
docker image prune --force --filter "until=24h" || true
echo "== deploy finished $(date -u +%FT%TZ) =="