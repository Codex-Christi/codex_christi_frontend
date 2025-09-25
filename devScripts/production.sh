#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/deploy/apps/codexchristi"   # change if path differs
COMPOSE_FILE="$APP_DIR/docker-compose.yml"
BUILDER_NAME="codex-builder-codexchristi"
CACHE_DIR="/var/lib/buildx-cache/codexchristi"

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo "== deploy start $(date -u +%FT%TZ) =="
cd "$APP_DIR"

# ensure cache dir exists
if [ ! -d "$CACHE_DIR" ]; then
  sudo mkdir -p "$CACHE_DIR"
  sudo chown root:root "$CACHE_DIR"
  sudo chmod 1777 "$CACHE_DIR"
fi

# ensure builder exists
if ! docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
  docker buildx create --name "$BUILDER_NAME" --driver docker-container --use
else
  docker buildx use "$BUILDER_NAME"
fi
docker buildx inspect --bootstrap "$BUILDER_NAME"

# build both services in parallel using persistent cache
echo "Building services with cache..."
docker buildx bake \
  --builder "$BUILDER_NAME" \
  --file "$COMPOSE_FILE" \
  --set app.cache-from=type=local,src="$CACHE_DIR" \
  --set app.cache-to=type=local,dest="$CACHE_DIR" \
  --set app_build.cache-from=type=local,src="$CACHE_DIR" \
  --set app_build.cache-to=type=local,dest="$CACHE_DIR" \
  --load

# start/recreate containers
echo "Starting containers..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

docker image prune --force --filter "until=24h" || true
echo "== deploy finished $(date -u +%FT%TZ) =="