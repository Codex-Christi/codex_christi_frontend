#!/usr/bin/env bash
set -euo pipefail

# ----------------------------
# production.sh - server-side, single-file solution
# - clears the named volume 'app_build' (so no stale .next persists)
# - auto-creates/uses a buildx builder and bootstraps it
# - builds with local persistent cache (faster subsequent builds)
# - loads the image locally (--load) and runs docker compose up -d --remove-orphans
# ----------------------------

# CONFIG - change only if your deploy path differs
APP_DIR="/root/apps/codexchristi"   # <- REPLACE with your actual path if different
COMPOSE_FILE="$APP_DIR/docker-compose.yml"
CACHE_DIR="/var/lib/buildx-cache/codexchristi"   # persistent local cache path
BUILDER_NAME="codex-builder-codexchristi"
IMAGE_TAG="codexchristi:latest"
VOLUME_NAME="app_build"   # the named volume that holds /app/.next in your compose
# End CONFIG

export DOCKER_BUILDKIT=1

echo "=== Deploy start: $(date -u +%FT%TZ) ==="
echo "Working directory: $APP_DIR"

# ensure we are in the application directory
cd "$APP_DIR"

# Ensure local cache dir exists and has permissive but safe perms
if [ ! -d "$CACHE_DIR" ]; then
  sudo mkdir -p "$CACHE_DIR"
  sudo chown root:root "$CACHE_DIR"
  sudo chmod 1777 "$CACHE_DIR" || true
fi

# -----------------------------
# Step 1: Clear the named volume (no backup; destructive per your request)
# This removes any previously-built .next that would otherwise shadow the new build.
# -----------------------------
if docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
  echo "Clearing named volume '$VOLUME_NAME' (removing old /app/.next content)..."
  # Use an ephemeral container to remove files inside the mounted volume
  docker run --rm -v "${VOLUME_NAME}:/app/.next" alpine:3.18 sh -c "rm -rf /app/.next/* /app/.next/.[!.]* || true"
  echo "Cleared content of volume: $VOLUME_NAME"
else
  echo "Named volume '$VOLUME_NAME' does not exist; nothing to clear."
fi

# -----------------------------
# Step 2: Ensure buildx builder exists and bootstrap it
# -----------------------------
if ! docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
  echo "Creating buildx builder: $BUILDER_NAME"
  docker buildx create --name "$BUILDER_NAME" --driver docker-container --use
else
  echo "Using existing buildx builder: $BUILDER_NAME"
  docker buildx use "$BUILDER_NAME"
fi

echo "Bootstrapping the buildx builder..."
docker buildx inspect --bootstrap "$BUILDER_NAME"

# -----------------------------
# Step 3: Build with cache exported to local dir and loaded into local docker
#  - --cache-to / --cache-from use a local dir so cache persists between runs
#  - --load writes the image into local docker so compose can use it (no push)
# -----------------------------
echo "Starting buildx build (first run may take longer; cache will speed later runs)..."
docker buildx build \
  --builder "$BUILDER_NAME" \
  --platform linux/amd64 \
  --tag "$IMAGE_TAG" \
  --cache-to "type=local,dest=$CACHE_DIR" \
  --cache-from "type=local,src=$CACHE_DIR" \
  --progress=auto \
  --load .

# -----------------------------
# Step 4: Start containers using docker compose
# -----------------------------
echo "Starting containers with docker compose..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# -----------------------------
# Optional: lightweight cleanup
# -----------------------------
echo "Pruning old images (light) to keep disk tidy..."
docker image prune --force --filter "until=24h" || true

echo "=== Deploy finished: $(date -u +%FT%TZ) ==="