#!/usr/bin/env bash
set -euo pipefail
# production.sh - Build & deploy on VPS with buildx + local persistent cache
# Auto-creates and bootstraps a buildx builder; no manual pre-setup needed.
#
# IMPORTANT: Set APP_DIR to your application path on the VPS below if different.

APP_DIR="/root/apps/codexchristi"   # <--- REPLACE if your actual path is different
COMPOSE_FILE="$APP_DIR/docker-compose.yml"
CACHE_DIR="/var/lib/buildx-cache/codexchristi"
BUILDER_NAME="codex-builder-codexchristi"
IMAGE_TAG="codexchristi:latest"

export DOCKER_BUILDKIT=1

# Ensure cache dir exists
if [ ! -d "$CACHE_DIR" ]; then
  sudo mkdir -p "$CACHE_DIR"
  sudo chown root:root "$CACHE_DIR"
  sudo chmod 1777 "$CACHE_DIR" || true
fi

# Move into app dir
cd "$APP_DIR"

# Create or reuse a buildx builder automatically
# If it exists, use it; if not, create it and switch to it.
if ! docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
  echo ">>> Creating buildx builder: $BUILDER_NAME"
  docker buildx create --name "$BUILDER_NAME" --driver docker-container --use
else
  echo ">>> Using existing buildx builder: $BUILDER_NAME"
  docker buildx use "$BUILDER_NAME"
fi

# Bootstrap the builder (ensures the BuildKit container is running)
docker buildx inspect --bootstrap "$BUILDER_NAME"

# Build with cache exported to local dir and import from it for faster subsequent builds.
# --load places built image in local docker engine so docker compose can use it.
docker buildx build \
  --builder "$BUILDER_NAME" \
  --platform linux/amd64 \
  --tag "$IMAGE_TAG" \
  --cache-to "type=local,dest=$CACHE_DIR" \
  --cache-from "type=local,src=$CACHE_DIR" \
  --progress=auto \
  --load .

# Start / recreate containers from the newly built image
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# Optional cleanup (keep cache, prune only old images)
docker image prune --force --filter "until=24h" || true

echo "deploy complete: $(date -u +%FT%TZ)"