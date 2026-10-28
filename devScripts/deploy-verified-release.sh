#!/usr/bin/env bash
set -Eeuo pipefail

# Run on the VPS via `ssh ... bash -s -- "$GITHUB_SHA" < this-file`.
# A separate checkout keeps generated files and old server edits out of releases.
stage='preflight'
trap 'status=$?; echo "Deployment failed during $stage (line $LINENO, exit $status)." >&2; exit "$status"' ERR

revision="${1:?Pass the verified full Git commit SHA.}"
if [[ ! "$revision" =~ ^[0-9a-f]{40}$ ]]; then
  echo 'Expected a full Git commit SHA.' >&2
  exit 1
fi

source_dir="${APP_DIR:-$HOME/apps/codexchristi}"
cd "$source_dir"
source_dir="$(pwd -P)"
log_file="$source_dir/deploy-$(date -u +%Y%m%d%H%M%S).log"
(umask 077; : >> "$log_file")
exec > >(tee -a "$log_file") 2>&1
echo "Starting deploy for commit: $revision"
echo "Deployment log: $log_file"
test -f "$source_dir/.env.production"

# Serialize manual recovery with any other invocation of this script.
exec 9>"$source_dir/.deployment.lock"
flock -n 9 || { echo 'Another VPS deployment is running.' >&2; exit 1; }

stage='checking the existing Compose project'
project="${COMPOSE_PROJECT_NAME:-}"
if docker container inspect codex-con-app-start >/dev/null 2>&1; then
  running_project="$(docker container inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' codex-con-app-start)"
  if [ -z "$running_project" ] || [ "$running_project" = '<no value>' ]; then
    echo 'Cannot identify the running Compose project; refusing to change catalog volumes.' >&2
    exit 1
  fi
  if [ -n "$project" ] && [ "$project" != "$running_project" ]; then
    echo 'COMPOSE_PROJECT_NAME differs from the running app project.' >&2
    exit 1
  fi
  project="$running_project"
  catalog_mount="$(docker container inspect --format '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Type}}:{{.Name}}{{end}}{{end}}' codex-con-app-start)"
  if [ "$catalog_mount" != "volume:${project}_merchize_price_catalog_data" ]; then
    echo "Unexpected existing catalog mount: $catalog_mount. Inspect it before deploying." >&2
    exit 1
  fi
  previous_image="$(docker container inspect --format '{{.Image}}' codex-con-app-start)"
fi
if [ -z "$project" ]; then
  echo 'Set COMPOSE_PROJECT_NAME for a first deployment with no existing app container.' >&2
  exit 1
fi
export COMPOSE_PROJECT_NAME="$project"
echo "Using existing Compose project: $COMPOSE_PROJECT_NAME"

stage='fetching the verified release'
GIT_SSH_COMMAND='ssh -o BatchMode=yes -o ConnectTimeout=15' git fetch origin main </dev/null
git cat-file -e "$revision^{commit}"
git merge-base --is-ancestor "$revision" refs/remotes/origin/main

stage='preparing an isolated release checkout'
release_root="$(dirname "$source_dir")/codexchristi-releases"
release_dir="$release_root/$revision"
mkdir -p "$release_root"
if [ ! -e "$release_dir" ]; then
  git worktree add --detach "$release_dir" "$revision" </dev/null
fi
test "$(git -C "$release_dir" rev-parse --show-toplevel)" = "$release_dir"
test "$(git -C "$release_dir" rev-parse HEAD)" = "$revision"
git -C "$release_dir" diff --quiet
git -C "$release_dir" diff --cached --quiet

if [ ! -e "$release_dir/.env.production" ] && [ ! -L "$release_dir/.env.production" ]; then
  ln -s "$source_dir/.env.production" "$release_dir/.env.production"
fi
test -L "$release_dir/.env.production"
test "$(readlink "$release_dir/.env.production")" = "$source_dir/.env.production"

stage='building and starting the verified release'
echo "Deploying release: $revision"
if [ -n "${previous_image:-}" ]; then
  rollback_tag="codexchristi-next:before-${revision:0:12}"
  if ! docker image inspect "$rollback_tag" >/dev/null 2>&1; then
    docker image tag "$previous_image" "$rollback_tag"
  fi
  echo "Previous runtime retained as $rollback_tag."
fi
# Keep the previous images available while recovering this deployment.
APP_DIR="$release_dir" SKIP_DOCKER_PRUNE=1 bash "$release_dir/devScripts/production.sh" </dev/null
echo "Verified release $revision is running from $release_dir."
