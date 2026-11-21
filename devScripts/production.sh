#!/usr/bin/env bash
# Deploy prebuilt images. Existing database schemas and catalog data are inputs.
set -Eeuo pipefail
umask 077
APP_DIR="${APP_DIR:-/home/codex-christi/codexchristi}"
PROXY_RELOAD_SCRIPT="${PROXY_RELOAD_SCRIPT:-/home/codex-christi/codex-nginx/devScripts/reload.sh}"
PROJECT=codex-christi-frontend
PROJECT_RELEASE_LOCK="${PROJECT_RELEASE_LOCK:-/home/codex-christi/.codex-christi-release.lock}"
# A caller's Compose defaults must never remove retained recovery containers.
export COMPOSE_REMOVE_ORPHANS=false COMPOSE_IGNORE_ORPHANS=true
mode=deploy
if [[ "${1:-}" == --rollback && $# == 2 ]]; then
  mode=rollback
  restore_checkpoint="$2"
elif [[ $# != 0 ]]; then
  echo 'Usage: production.sh [--rollback CHECKPOINT_DIRECTORY]' >&2
  exit 2
fi
fail() { printf '%s\n' "$1" >&2; exit 1; }
for tool in docker python3 flock timeout git; do
  command -v "$tool" >/dev/null || fail "Required deployment command unavailable: $tool"
done
cd "$APP_DIR"
APP_DIR="$(pwd -P)"
[[ "$(git rev-parse --show-toplevel)" == "$APP_DIR" ]] || fail 'Deployment directory is not the frontend repository root.'
# Frontend and proxy releases share this lock. The proxy reload helper does
# not reacquire it, so checks/reloads remain inside this release transaction.
[[ "$PROJECT_RELEASE_LOCK" == /* && ! -L "$PROJECT_RELEASE_LOCK" ]] || fail 'The shared project release lock must be an absolute regular-file path.'
exec 8>"$PROJECT_RELEASE_LOCK"
flock -n 8 || fail 'Another Codex Christi frontend or proxy release holds the shared project lock.'
[[ -z "$(git status --porcelain=v1 --untracked-files=normal)" ]] || fail 'Frontend repository has uncommitted files; refusing deployment.'
[[ -f .env.production && ! -L .env.production ]] || fail 'The private runtime environment is missing or is a symlink.'
[[ -f "$PROXY_RELOAD_SCRIPT" && -x "$PROXY_RELOAD_SCRIPT" ]] || fail 'The repository-owned proxy reload/check script is unavailable.'
install -d -m 700 .deploy .deploy/checkpoints
if [[ "${DEPLOYMENT_LOCK_FD:-}" == 9 ]]; then
  [[ /proc/$$/fd/9 -ef "$APP_DIR/.deploy/deployment.lock" ]] || fail 'Inherited deployment lock does not belong to this repository.'
else
  exec 9>.deploy/deployment.lock
fi
flock -n 9 || fail 'Another frontend deployment holds the deployment lock.'
valid_revision() { [[ "$1" =~ ^[0-9a-f]{40}$ ]]; }
valid_image() { [[ "$1" =~ ^sha256:[0-9a-f]{64}$ ]]; }
read_release() {
  python3 - "$1" <<'RELEASE'
import pathlib, re, sys
lines = pathlib.Path(sys.argv[1]).read_text().splitlines()
values = dict(line.split('=', 1) for line in lines)
patterns = {'DEPLOY_REVISION': r'[0-9a-f]{40}', 'DEPLOY_IMAGE': r'sha256:[0-9a-f]{64}',
            'DATASTORE_CHECK_IMAGE': r'sha256:[0-9a-f]{64}'}
if len(lines) != 3 or set(values) != set(patterns) or not all(re.fullmatch(patterns[k], values[k]) for k in patterns):
    raise SystemExit('Invalid release identifier file.')
print(*(values[k] for k in patterns), sep='\n')
RELEASE
}
compose_file="$APP_DIR/docker-compose.yml"
if [[ "$mode" == rollback ]]; then
  restore_checkpoint="$(cd "$restore_checkpoint" && pwd -P)"
  [[ "$restore_checkpoint" == "$APP_DIR/.deploy/checkpoints/"* ]] || fail 'Rollback checkpoint must belong to this frontend repository.'
  [[ -f "$restore_checkpoint/previous.env" && -f "$restore_checkpoint/docker-compose.yml" ]] || fail 'Rollback checkpoint is incomplete.'
  release_values="$(read_release "$restore_checkpoint/previous.env")" || fail 'Rollback identifiers are invalid.'
  DEPLOY_REVISION="$(printf '%s\n' "$release_values" | sed -n '1p')"
  DEPLOY_IMAGE="$(printf '%s\n' "$release_values" | sed -n '2p')"
  DATASTORE_CHECK_IMAGE="$(printf '%s\n' "$release_values" | sed -n '3p')"
  compose_file="$restore_checkpoint/docker-compose.yml"
else
  DEPLOY_REVISION="${DEPLOY_REVISION:-}"
  DEPLOY_IMAGE="${DEPLOY_IMAGE:-}"
  DATASTORE_CHECK_IMAGE="${DATASTORE_CHECK_IMAGE:-}"
  valid_revision "$DEPLOY_REVISION" || fail 'DEPLOY_REVISION must be the complete verified commit SHA.'
  [[ "$(git rev-parse HEAD)" == "$DEPLOY_REVISION" ]] || fail 'The checkout does not match the verified release.'
fi
valid_revision "$DEPLOY_REVISION" || fail 'Invalid release revision.'
valid_image "$DEPLOY_IMAGE" || fail 'DEPLOY_IMAGE must be an exact local Docker image ID.'
valid_image "$DATASTORE_CHECK_IMAGE" || fail 'DATASTORE_CHECK_IMAGE must be an exact local Docker image ID.'
export DEPLOY_REVISION DEPLOY_IMAGE DATASTORE_CHECK_IMAGE
checkpoint="$(mktemp -d "$APP_DIR/.deploy/checkpoints/release-XXXXXXXX")"
log="$checkpoint/deployment.log"
touch "$log"
chmod 600 "$log"
printf 'Frontend release=%s\nPrivate deployment checkpoint=%s\n' "$DEPLOY_REVISION" "$checkpoint"
write_release() {
  printf 'DEPLOY_REVISION=%s\nDEPLOY_IMAGE=%s\nDATASTORE_CHECK_IMAGE=%s\n' "$1" "$2" "$3" > "$4"
}
write_release "$DEPLOY_REVISION" "$DEPLOY_IMAGE" "$DATASTORE_CHECK_IMAGE" "$checkpoint/candidate.env"
cp "$compose_file" "$checkpoint/candidate-compose.yml"
if [[ "$mode" == rollback ]]; then
  [[ -f "$restore_checkpoint/previous-runtime.env" ]] || fail 'Rollback runtime environment is missing.'
  cp "$restore_checkpoint/previous-runtime.env" "$checkpoint/runtime.env"
else
  cp .env.production "$checkpoint/runtime.env"
fi
export RUNTIME_ENV_FILE="$checkpoint/runtime.env"
chmod 600 "$checkpoint/"*
compose() {
  docker compose --project-name "$PROJECT" --project-directory "$APP_DIR" \
    --env-file "$checkpoint/candidate.env" -f "$compose_file" "$@"
}
previous_image=
previous_revision=
previous_check_image=
replacement_started=0
recovery_attempted=0
check_name="codex-christi-datastore-check-${checkpoint##*-}"
settings_name="codex-christi-release-settings-check-${checkpoint##*-}"
datastore_started=0
settings_started=0
image_revision() {
  docker image inspect "$1" | python3 -c '
import json, sys
value = json.load(sys.stdin)[0]
print(value.get("Config", {}).get("Labels", {}).get("org.opencontainers.image.revision", ""))'
}
image_environment_revision() {
  docker image inspect "$1" | python3 -c '
import json, sys
items = json.load(sys.stdin)[0].get("Config", {}).get("Env", [])
print(next((v.split("=",1)[1] for v in reversed(items) if v.startswith("APP_REVISION=")), ""))'
}
check_image() {
  local image="$1" identity
  identity="$(docker image inspect --format '{{.Id}} {{.Os}}/{{.Architecture}}' "$image")"
  [[ "$identity" == "$image linux/amd64" ]] || return 1
  local label
  label="$(image_revision "$image")"
  # An archived, previously verified migration image may predate OCI labels.
  # Only a recorded rollback target may omit the label; its image ID and
  # APP_REVISION are still checked against the retained local checkpoint.
  if [[ "$mode" == rollback && "$image" == "$DEPLOY_IMAGE" && -z "$label" ]]; then
    return 0
  fi
  [[ "$label" == "$DEPLOY_REVISION" ]] || return 1
}
cleanup_oneoff() {
  local name="$1" expected_service="$2" started="$3" owner service
  [[ "$started" == 1 ]] || return 0
  if docker container inspect "$name" >/dev/null 2>&1; then
    owner="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$name")"
    service="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$name")"
    if [[ "$owner" == "$PROJECT" && "$service" == "$expected_service" ]]; then
      docker container rm -f "$name" >>"$log" 2>&1
    fi
  fi
}
cleanup_check() {
  cleanup_oneoff "$settings_name" release-settings-check "$settings_started"
  cleanup_oneoff "$check_name" datastore-check "$datastore_started"
}
recover_previous() {
  recovery_attempted=1
  echo 'Readiness or proxy checks failed; recovering the previous frontend image.' >&2
  DEPLOY_IMAGE="$previous_image" DEPLOY_REVISION="$previous_revision" DATASTORE_CHECK_IMAGE="$previous_check_image" RUNTIME_ENV_FILE="$checkpoint/previous-runtime.env" \
    docker compose --project-name "$PROJECT" --project-directory "$APP_DIR" \
      --env-file "$checkpoint/previous.env" -f "$checkpoint/docker-compose.yml" \
      up -d --no-build --pull never --no-deps --force-recreate --wait --wait-timeout 120 app >>"$log" 2>&1 || return 1
  "$PROXY_RELOAD_SCRIPT" nginx "$previous_revision" >>"$log" 2>&1 || return 1
  cp "$checkpoint/previous.env" "$APP_DIR/.deploy/current.env.tmp" || return 1
  cp "$checkpoint/docker-compose.yml" "$APP_DIR/.deploy/current-compose.yml.tmp" || return 1
  cp "$checkpoint/previous-runtime.env" "$APP_DIR/.deploy/current-runtime.env.tmp" || return 1
  mv "$APP_DIR/.deploy/current-compose.yml.tmp" "$APP_DIR/.deploy/current-compose.yml" || return 1
  mv "$APP_DIR/.deploy/current-runtime.env.tmp" "$APP_DIR/.deploy/current-runtime.env" || return 1
  mv "$APP_DIR/.deploy/current.env.tmp" "$APP_DIR/.deploy/current.env" || return 1
  echo 'Previous frontend release recovered.' >&2
}
finish() {
  local status=$?
  trap - EXIT INT TERM
  set +e
  cleanup_check
  if [[ "$status" != 0 && "$replacement_started" == 1 && "$recovery_attempted" == 0 ]]; then
    if ! recover_previous; then
      echo 'Automatic frontend recovery did not pass; inspect the private checkpoint before any further deployment.' >&2
    fi
  fi
  if [[ "$status" != 0 ]]; then
    printf 'Frontend release stopped. Private diagnostic log: %s\n' "$log" >&2
  fi
  exit "$status"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo 'Checking immutable image identities, repository configuration and current service ownership...'
docker info >>"$log" 2>&1 || fail 'The deployment account cannot access Docker unattended; configure the approved deployment mechanism first.'
check_image "$DEPLOY_IMAGE" >>"$log" 2>&1 || fail 'Runtime image identity, platform or revision does not match this release.'
check_image "$DATASTORE_CHECK_IMAGE" >>"$log" 2>&1 || fail 'Datastore-check image identity, platform or revision does not match this release.'
[[ "$(image_environment_revision "$DEPLOY_IMAGE")" == "$DEPLOY_REVISION" ]] || fail 'Runtime APP_REVISION is inconsistent with its image label.'
compose --profile verify config --quiet >>"$log" 2>&1 || fail 'Frontend Compose validation failed.'
current_container="$(compose ps -q app)"
[[ -n "$current_container" ]] || fail 'No existing repository-owned frontend release is running; complete the private initial deployment first.'
[[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$current_container")" == "$PROJECT" ]] || fail 'Frontend container ownership mismatch.'
[[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$current_container")" == app ]] || fail 'Frontend service ownership mismatch.'
[[ "$(docker inspect --format '{{.State.Status}}' "$current_container")" == running ]] || fail 'Current frontend is not running; investigate before replacing it.'
[[ "$(docker inspect --format '{{.State.Health.Status}}' "$current_container")" == healthy ]] || fail 'Current frontend is not healthy; investigate before replacing it.'
previous_image="$(docker inspect --format '{{.Image}}' "$current_container")"
previous_revision="$(image_environment_revision "$previous_image")"
valid_image "$previous_image" && valid_revision "$previous_revision" || fail 'The current frontend image lacks valid recovery identifiers.'
[[ -f .deploy/current.env && -f .deploy/current-compose.yml && -f .deploy/current-runtime.env ]] || fail 'The initial frontend release manifest is missing; complete the private setup before enabling normal deployments.'
old_values="$(read_release .deploy/current.env)" || fail 'The current release manifest is invalid.'
[[ "$(printf '%s\n' "$old_values" | sed -n '1p')" == "$previous_revision" && "$(printf '%s\n' "$old_values" | sed -n '2p')" == "$previous_image" ]] || fail 'The current release manifest does not match the running image.'
previous_check_image="$(printf '%s\n' "$old_values" | sed -n '3p')"
write_release "$previous_revision" "$previous_image" "$previous_check_image" "$checkpoint/previous.env"
cp "$APP_DIR/.deploy/current-compose.yml" "$checkpoint/docker-compose.yml"
cp "$APP_DIR/.deploy/current-runtime.env" "$checkpoint/previous-runtime.env"
chmod 600 "$checkpoint/previous.env" "$checkpoint/docker-compose.yml" "$checkpoint/previous-runtime.env"
"$PROXY_RELOAD_SCRIPT" nginx "$previous_revision" >>"$log" 2>&1

settings_feature="$(docker image inspect --format '{{index .Config.Labels "org.codex-christi.release-settings"}}' "$DEPLOY_IMAGE")"
settings_services="$(compose --profile verify config --services 2>>"$log")"
if [[ "$settings_feature" == 1 ]]; then
  printf '%s\n' "$settings_services" | grep -Fxq release-settings-check \
    || fail 'The release-settings-check service is missing for this manifest-capable image.'
  echo 'Checking compiled public settings against runtime payment settings offline...'
  if docker container inspect "$settings_name" >/dev/null 2>&1; then
    fail 'The one-off release-settings-check container name is already in use.'
  fi
  settings_started=1
  timeout --signal=TERM --kill-after=10s 20s \
    docker compose --project-name "$PROJECT" --project-directory "$APP_DIR" \
      --env-file "$checkpoint/candidate.env" -f "$compose_file" --profile verify \
      run --rm --no-deps --name "$settings_name" release-settings-check >>"$log" 2>&1
  cleanup_oneoff "$settings_name" release-settings-check "$settings_started"
  settings_started=0
else
  # Recorded legacy rollback images predate the embedded manifest and checker service.
  # Their retained image, revision, Compose and runtime environment remain pinned above.
  [[ "$mode" == rollback && ( -z "$settings_feature" || "$settings_feature" == '<no value>' ) ]] \
    || fail 'The candidate image does not support the required release-settings check.'
  if printf '%s\n' "$settings_services" | grep -Fxq release-settings-check; then
    fail 'A legacy rollback image cannot use a manifest-capable Compose configuration.'
  fi
  echo 'Using the recorded rollback image and runtime settings; retaining legacy compatibility.'
fi

echo 'Checking the existing Neon databases and SQLite catalog read-only...'
if docker container inspect "$check_name" >/dev/null 2>&1; then
  fail 'The one-off datastore-check container name is already in use.'
fi
datastore_started=1
timeout --signal=TERM --kill-after=10s 90s \
  docker compose --project-name "$PROJECT" --project-directory "$APP_DIR" \
    --env-file "$checkpoint/candidate.env" -f "$compose_file" --profile verify \
    run --rm --no-deps --name "$check_name" datastore-check >>"$log" 2>&1
cleanup_oneoff "$check_name" datastore-check "$datastore_started"
datastore_started=0

echo 'Replacing the frontend and waiting for application readiness...'
replacement_started=1
compose up -d --no-build --pull never --no-deps --force-recreate --wait --wait-timeout 120 app >>"$log" 2>&1 || fail 'The replacement frontend did not become ready.'
[[ "$(compose exec -T app printenv APP_REVISION)" == "$DEPLOY_REVISION" ]] || fail 'The running application reports the wrong revision.'
[[ "$(docker inspect --format '{{.Image}}' "$(compose ps -q app)")" == "$DEPLOY_IMAGE" ]] || fail 'The running application uses the wrong image.'

echo 'Refreshing Nginx upstreams and checking both HTTPS routes...'
"$PROXY_RELOAD_SCRIPT" nginx "$DEPLOY_REVISION" >>"$log" 2>&1
cp "$checkpoint/candidate.env" "$APP_DIR/.deploy/current.env.tmp"
cp "$checkpoint/candidate-compose.yml" "$APP_DIR/.deploy/current-compose.yml.tmp"
cp "$checkpoint/runtime.env" "$APP_DIR/.deploy/current-runtime.env.tmp"
mv "$APP_DIR/.deploy/current-compose.yml.tmp" "$APP_DIR/.deploy/current-compose.yml"
mv "$APP_DIR/.deploy/current-runtime.env.tmp" "$APP_DIR/.deploy/current-runtime.env"
mv "$APP_DIR/.deploy/current.env.tmp" "$APP_DIR/.deploy/current.env"
replacement_started=0
printf 'Release %s is healthy.\nRecovery checkpoint: %s\n' "$DEPLOY_REVISION" "$checkpoint"
