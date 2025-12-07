#!/usr/bin/env bash
set -euo pipefail

# Resolve script directory and project root so this script is location-agnostic.
# This allows running it from anywhere (e.g. repo root, scripts/, or via absolute path).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Always execute from project root so relative paths (prisma/, data/, etc.) are consistent.
cd "$ROOT_DIR"

echo "→ Running setup_merchize_catalog.sh from project root: $ROOT_DIR"

WITH_CRON=0
RUN_BUILD=1
RUN_DEPS=1
FORCE_MIGRATE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-cron)
      WITH_CRON=1
      shift
      ;;
    --no-build)
      RUN_BUILD=0
      shift
      ;;
    --no-deps)
      RUN_DEPS=0
      shift
      ;;
    --force-migrate)
      FORCE_MIGRATE=1
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--with-cron] [--no-build] [--no-deps] [--force-migrate]"
      exit 1
      ;;
  esac
done

SCHEMA_PATH="$ROOT_DIR/prisma/shop/merchize/priceCatalog.prisma"
# IMPORTANT: store the schema hash file in the scripts directory (writable in container),
# not directly in /app, which is owned by root.
SCHEMA_HASH_FILE="${SCRIPT_DIR}/.merchize_price_catalog_schema.sha"

echo "→ Checking Merchize catalog Prisma schema fingerprint"
echo "→ Using schema: $SCHEMA_PATH"
echo "→ Using schema hash file: $SCHEMA_HASH_FILE"

if [ ! -f "$SCHEMA_PATH" ]; then
  echo "❌ Schema file not found at $SCHEMA_PATH"
  exit 1
fi

NEW_HASH="$(sha256sum "$SCHEMA_PATH" | awk '{print $1}')"

if [ -f "$SCHEMA_HASH_FILE" ]; then
  OLD_HASH="$(cat "$SCHEMA_HASH_FILE")"
else
  echo "→ No previous schema fingerprint found. Treating as changed."
  OLD_HASH=""
fi

if [ "$FORCE_MIGRATE" -eq 1 ]; then
  echo "→ --force-migrate set: forcing migrate dev regardless of schema hash."
  MERCHIZE_PRICE_CATALOG_SCHEMA_CHANGED=1
elif [ "$NEW_HASH" != "$OLD_HASH" ]; then
  echo "→ Schema hash changed:"
  echo "   Old: $OLD_HASH"
  echo "   New: $NEW_HASH"
  MERCHIZE_PRICE_CATALOG_SCHEMA_CHANGED=1
else
  echo "→ Schema hash unchanged."
  MERCHIZE_PRICE_CATALOG_SCHEMA_CHANGED=0
fi

# Persist the new hash (this is where the permission issue was before).
echo "$NEW_HASH" > "$SCHEMA_HASH_FILE"

echo "→ Ensuring data directory exists at $ROOT_DIR/data"
mkdir -p "$ROOT_DIR/data"

# Prefer .env.production if present (prod container), otherwise .env
ENV_FILE=""
if [ -f "$ROOT_DIR/.env.production" ]; then
  ENV_FILE="$ROOT_DIR/.env.production"
elif [ -f "$ROOT_DIR/.env" ]; then
  ENV_FILE="$ROOT_DIR/.env"
fi

if [ -z "$ENV_FILE" ]; then
  cat <<'EOF'
⚠️  .env/.env.production missing. Create one with at least:

MERCHIZE_PRICE_CATALOG_DATABASE_URL="file:./data/merchize_price_catalog.db"

For example, in .env.local for development:

MERCHIZE_PRICE_CATALOG_DATABASE_URL="file:./data/merchize_price_catalog.db"
EOF
  exit 1
fi

echo "→ Using env file: $ENV_FILE"
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

if [ "$RUN_DEPS" -eq 1 ]; then
  echo "→ Installing dependencies with Yarn (if needed)"
  yarn install --immutable --inline-builds
else
  echo "→ Skipping dependency installation (--no-deps)"
fi

echo "→ Generate Prisma client (Merchize catalog schema)"
yarn prisma generate \
  --schema "$SCHEMA_PATH"

if [ "${MERCHIZE_PRICE_CATALOG_SCHEMA_CHANGED:-1}" = "1" ]; then
  echo "→ Schema changed (or unknown): running Prisma migrate dev for Merchize catalog DB"
  yarn prisma migrate dev \
    --schema "$SCHEMA_PATH" \
    -n bootstrap_merchize_catalog
else
  echo "→ Schema unchanged: skipping migrate dev, ensuring DB is in sync with db push"
  yarn prisma db push \
    --schema "$SCHEMA_PATH"
fi

if [ "$RUN_BUILD" -eq 1 ]; then
  echo "→ Building Next.js app"
  yarn build
else
  echo "→ Skipping Next.js build (--no-build)"
fi

if [ "$WITH_CRON" -eq 1 ]; then
  cat <<'EOF'

You can add a cron entry like:

# m h  dom mon dow   command
0 3 * * * cd /root/apps/codexchristi && /usr/bin/env bash scripts/setup_merchize_catalog.sh --no-deps --no-build >> /var/log/merchize_catalog_setup.log 2>&1

EOF
fi

echo "✅ Merchize catalog setup complete."