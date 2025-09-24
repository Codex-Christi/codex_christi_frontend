#!/usr/bin/env bash
set -euo pipefail

# production.sh — fast build on VPS with buildx cache, keeping your original behavior.
# - ONE compose file
# - app_build writes .next to the named volume
# - app mounts that volume
# - we only speed it up (no behavior changes)

# >>>> CHANGE THIS if your repo path differs
APP_DIR="/root/apps/codexchristi"

COMPOSE_FILE="$APP_DIR/docker-compose.yml"
BUILDER_NAME="codex-builder-codexchristi"
CACHE_DIR="/var/lib/buildx-cache/codexchristi"

# Ensure Docker uses BuildKit + buildx through docker CLI (so compose benefits)
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo "== deploy start $(date -u +%FT%TZ) =="
cd "$APP_DIR"

# Make a persistent cache location (owned by root, sticky bit so any user can write subfiles)
if [ ! -d "$CACHE_DIR" ]; then
  sudo mkdir -p "$CACHE_DIR"
  sudo chown root:root "$CACHE_DIR"
  sudo chmod 1777 "$CACHE_DIR" || true
fi

# Create/Select a buildx builder and bootstrap it (so compose uses the same builder & cache)
if ! docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
  echo "Creating buildx builder: $BUILDER_NAME"
  docker buildx create --name "$BUILDER_NAME" --driver docker-container --use
else
  docker buildx use "$BUILDER_NAME"
fi

echo "Bootstrapping buildx..."
docker buildx inspect --bootstrap "$BUILDER_NAME"

# Pre-warm cache once with a direct build of the builder stage (optional but helps a lot)
# This build writes layers into the builder's cache so compose won't start from zero.
echo "Pre-warming cache for builder stage..."
docker buildx build \
  --builder "$BUILDER_NAME" \
  --file Dockerfile \
  --target builder \
  --cache-from "type=local,src=$CACHE_DIR" \
  --cache-to   "type=local,dest=$CACHE_DIR" \
  --progress=plain \
  --load \
  .

# Build both services in parallel using the same builder/cache
# Compose will now reuse the warmed cache from the same buildx instance.
echo "Building services via docker compose (parallel)..."
docker compose -f "$COMPOSE_FILE" build --progress=plain --parallel app_build app

# Start / recreate containers (app_build runs once, writes fresh .next into the volume)
echo "Starting services..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# Light cleanup (keeps yesterday's images for safety)
docker image prune --force --filter "until=24h" || true

echo "== deploy finished $(date -u +%FT%TZ) =="