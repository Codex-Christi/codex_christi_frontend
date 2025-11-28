#!/usr/bin/env bash
set -euo pipefail

##############################################################################
# production.sh — fast, reliable deploy on the VPS using BuildKit + Compose
# - Reuses an existing buildx builder with the *docker* driver (e.g. "default")
# - Only creates a builder if none exists
# - Builds services in parallel with layer cache
# - Starts stack with up -d (all services, including app)
##############################################################################

APP_DIR="/root/apps/codexchristi"          # <-- adjust if needed
COMPOSE_FILE="$APP_DIR/docker-compose.yml"
PREFERRED_BUILDER="codex-builder-codexchristi"

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo "== deploy start $(date -u +%FT%TZ) =="
cd "$APP_DIR"

# --- Helper: does a builder exist? ---
have_builder() {
  docker buildx inspect "$1" >/dev/null 2>&1
}

# --- Pick a usable docker-driver builder (strip trailing '*') ---
use_first_docker_builder_or_create() {
  if have_builder "$PREFERRED_BUILDER"; then
    echo "Using existing builder: $PREFERRED_BUILDER"
    docker buildx use "$PREFERRED_BUILDER"
    return
  fi

  # Find any docker-driver builder (e.g. 'default' or another), strip trailing '*'
  existing_docker_builder="$(
    docker buildx ls \
      | awk '$2 ~ /^docker/ {name=$1; sub(/\*$/,"",name); print name; exit}'
  )"

  if [ -n "${existing_docker_builder:-}" ] && have_builder "$existing_docker_builder"; then
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

echo "Building services (parallel)…"
docker compose -f "$COMPOSE_FILE" build --progress=plain --parallel

echo "Starting services…"
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# Light cleanup of dangling images unless explicitly skipped
# Set SKIP_DOCKER_PRUNE=1 in the environment to disable this step.
if [ "${SKIP_DOCKER_PRUNE:-0}" != "1" ]; then
  # Use a conservative prune; adjust flags if you want more aggressive cleanup
  docker system prune --force >/dev/null 2>&1 || true
fi

echo "== deploy finished $(date -u +%FT%TZ) =="

echo "Services started. Current status:"
docker compose -f "$COMPOSE_FILE" ps