#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ "${1:-}" == "--print-cron" ]]; then
  cat <<'EOF'
# Refresh the sharded shop SEO metadata manifest.
# Prefer localhost on the VPS if the Next.js app listens there; otherwise use the public origin.
17 * * * * cd /root/apps/codexchristi && SHOP_SEO_MANIFEST_BASE_URL=http://127.0.0.1:3000 /usr/bin/env bash scripts/refresh_shop_seo_manifest.sh >> /var/log/shop_seo_manifest_refresh.log 2>&1
EOF
  exit 0
fi

cd "$ROOT_DIR"

ENV_FILE="${SHOP_SEO_MANIFEST_ENV_FILE:-}"
if [[ -z "$ENV_FILE" ]]; then
  if [[ -f "$ROOT_DIR/.env.production" ]]; then
    ENV_FILE="$ROOT_DIR/.env.production"
  elif [[ -f "$ROOT_DIR/.env.local" ]]; then
    ENV_FILE="$ROOT_DIR/.env.local"
  elif [[ -f "$ROOT_DIR/.env" ]]; then
    ENV_FILE="$ROOT_DIR/.env"
  fi
fi

read_env_value() {
  local key="$1"
  local env_file="$2"
  local line
  local value

  line="$(grep -E "^${key}=" "$env_file" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    return 0
  fi

  value="${line#*=}"
  value="${value%$'\r'}"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi

  printf '%s' "$value"
}

load_env_value_if_missing() {
  local key="$1"
  local current_value="${!key:-}"
  local loaded_value

  if [[ -n "$current_value" || -z "$ENV_FILE" ]]; then
    return 0
  fi

  loaded_value="$(read_env_value "$key" "$ENV_FILE")"
  if [[ -n "$loaded_value" ]]; then
    export "$key=$loaded_value"
  fi
}

if [[ -n "$ENV_FILE" ]]; then
  load_env_value_if_missing SHOP_SEO_MANIFEST_CRON_SECRET
  load_env_value_if_missing MERCHIZE_OFFLINE_CATALOG_CRON_SECRET
  load_env_value_if_missing SHOP_SEO_MANIFEST_BASE_URL
  load_env_value_if_missing NEXT_PUBLIC_SITE_URL
  load_env_value_if_missing SITE_URL
fi

BASE_URL="${SHOP_SEO_MANIFEST_BASE_URL:-${NEXT_PUBLIC_SITE_URL:-${SITE_URL:-http://127.0.0.1:3000}}}"
BASE_URL="${BASE_URL%/}"
SECRET="${SHOP_SEO_MANIFEST_CRON_SECRET:-${MERCHIZE_OFFLINE_CATALOG_CRON_SECRET:-}}"

if [[ -z "$SECRET" ]]; then
  echo "SHOP_SEO_MANIFEST_CRON_SECRET or MERCHIZE_OFFLINE_CATALOG_CRON_SECRET must be set." >&2
  exit 1
fi

curl --silent --show-error --fail \
  --request POST \
  --header "x-cron-secret: ${SECRET}" \
  "${BASE_URL}/api/jobs/shop-seo-manifest-refresh"
echo
