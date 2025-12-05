#!/usr/bin/env bash
set -euo pipefail

# Resolve script directory and project root so this script is location-agnostic.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Always execute from project root so relative paths (prisma/, data/, etc.) are consistent.
cd "$ROOT_DIR"

echo "→ Running setup_merchize_catalog.sh from project root: $ROOT_DIR"

FORCE_MIGRATE=0

# Flags:
#   --force-migrate  Always run `prisma migrate dev` instead of comparing schema fingerprint.
for arg in "$@"; do
  case "$arg" in
    --force-migrate)
      FORCE_MIGRATE=1
      ;;
  esac
done

SCHEMA_PATH="$ROOT_DIR/prisma/shop/merchize/priceCatalog.prisma"
SCHEMA_HASH_FILE="$ROOT_DIR/.merchize_price_catalog_schema.sha"

echo "→ Checking Merchize catalog Prisma schema fingerprint"

if [ "$FORCE_MIGRATE" -eq 1 ]; then
  echo "→ --force-migrate set: Prisma migrate will run regardless of schema fingerprint."
  export MERCHIZE_PRICE_CATALOG_SCHEMA_CHANGED=1
else
  if [ -f "$SCHEMA_PATH" ]; then
    CURRENT_HASH="$(sha256sum "$SCHEMA_PATH" | awk '{print $1}')"
    PREV_HASH=""
    if [ -f "$SCHEMA_HASH_FILE" ]; then
      PREV_HASH="$(cat "$SCHEMA_HASH_FILE" 2>/dev/null || echo "")"
    fi

    if [ "$CURRENT_HASH" != "$PREV_HASH" ]; then
      echo "→ Detected schema change for Merchize price catalog."
      echo "$CURRENT_HASH" > "$SCHEMA_HASH_FILE"
      export MERCHIZE_PRICE_CATALOG_SCHEMA_CHANGED=1
    else
      echo "→ No schema change detected for Merchize price catalog."
      export MERCHIZE_PRICE_CATALOG_SCHEMA_CHANGED=0
    fi
  else
    echo "⚠️  Schema file $SCHEMA_PATH not found; assuming migration needed."
    export MERCHIZE_PRICE_CATALOG_SCHEMA_CHANGED=1
  fi
fi

echo "→ Ensuring data directory exists at $ROOT_DIR/data"
mkdir -p "$ROOT_DIR/data"

# Determine which env file to require, based only on NODE_ENV.
if [ "${NODE_ENV:-development}" = "production" ]; then
  ENV_FILE="$ROOT_DIR/.env.production"
else
  ENV_FILE="$ROOT_DIR/.env.local"
fi

echo "→ Using env file: $ENV_FILE"

if [ ! -f "$ENV_FILE" ]; then
  echo "⚠️  Required env file missing: $ENV_FILE"
  echo "Create it with at least:"
  cat <<'EOF'
MERCHIZE_PRICE_CATALOG_DATABASE_URL="file:./data/merchize_price_catalog.db"
MERCHIZE_PRICE_CATALOG_CRON_SECRET="some-long-random"
MERCHIZE_PRICE_CATALOG_ADMIN_PASSWORD="your-admin-password"

MERCHIZE_CATALOG_URL="https://bo-group-2-2.merchize.com/27mkjsl/bo-api/product/catalog/"
MERCHIZE_API_KEY="YOUR_MERCHIZE_TOKEN"
MERCHIZE_BASE_URL="https://bo-group-2-2.merchize.com/27mkjsl/bo-api"
EOF
  exit 1
fi

# Export variables from the env file so Prisma can see the DB URL.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "→ Generating Prisma client (Merchize catalog schema)"
yarn prisma generate \
  --schema "$SCHEMA_PATH"

if [ "${MERCHIZE_PRICE_CATALOG_SCHEMA_CHANGED:-1}" = "1" ]; then
  echo "→ Schema changed (or unknown): running Prisma migrate dev for Merchize catalog DB"
  yarn prisma migrate dev \
    --schema "$SCHEMA_PATH" \
    -n bootstrap_merchize_catalog
else
  echo "→ Schema unchanged: running Prisma db push to ensure DB is in sync"
  yarn prisma db push \
    --schema "$SCHEMA_PATH"
fi

echo "✓ Merchize catalog Prisma setup complete."