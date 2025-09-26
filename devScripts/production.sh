#!/usr/bin/env bash
set -euo pipefail

##############################################################################
# production.sh — fast, reliable deploy on the VPS using BuildKit + Compose
# - Reuses an existing buildx builder with the *docker* driver (e.g. "default")
# - Only creates a builder if none exists
# - Builds services in parallel with layer cache
# - Starts stack with up -d (your app_build then app flow remains the same)
##############################################################################

# >>> Adjust this if your project path differs
APP_DIR="/root/apps/codexchristi"
COMPOSE_FILE="$APP_DIR/docker-compose.yml"

# Preferred builder name (optional). We'll use it if present; otherwise we fall back.
PREFERRED_BUILDER="codex-builder-codexchristi"

# Use BuildKit + docker CLI backend so compose benefits from buildx
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo "== deploy start $(date -u +%FT%TZ) =="
cd "$APP_DIR"

##############################################################################
# Ensure we have a usable buildx builder on the *docker* driver (no tar export)
# Logic:
#  1) If $PREFERRED_BUILDER exists -> use it
#  2) else if a docker-driver builder (e.g. 'default') exists -> use it
#  3) else create $PREFERRED_BUILDER with --driver docker and use it
##############################################################################
have_builder() {
  docker buildx inspect "$1" >/dev/null 2>&1
}

use_first_docker_builder_or_create() {
  if have_builder "$PREFERRED_BUILDER"; then
    echo "Using existing builder: $PREFERRED_BUILDER"
    docker buildx use "$PREFERRED_BUILDER"
    return
  fi

  # Try to find any existing docker-driver builder (commonly 'default')
  existing_docker_builder="$(docker buildx ls | awk '/docker/ && $1 !~ /^\*/ {print $1; exit}')"
  if [ -n "${existing_docker_builder:-}" ]; then
    echo "Using existing docker-driver builder: $existing_docker_builder"
    docker buildx use "$existing_docker_builder"
    return
  fi

  # Create our preferred one if none exist
  echo "No docker-driver builder found; creating: $PREFERRED_BUILDER"
  docker buildx create --name "$PREFERRED_BUILDER" --driver docker --use
}

use_first_docker_builder_or_create
docker buildx inspect --bootstrap >/dev/null

##############################################################################
# Build images (parallel) — leverages Docker layer cache automatically
##############################################################################
echo "Building services (parallel)…"
docker compose -f "$COMPOSE_FILE" build --progress=plain --parallel

##############################################################################
# Start / recreate stack — your app_build runs once to prep .next volume, then app starts
##############################################################################
echo "Starting services…"
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# Light cleanup of dangling images older than 24h (safe)
docker image prune --force --filter "until=24h" >/dev/null 2>&1 || true

echo "== deploy finished $(date -u +%FT%TZ) =="