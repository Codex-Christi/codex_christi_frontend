#!/usr/bin/env bash
set -euo pipefail

# --------------------------------------------------------------------
# Merchize catalog Prisma setup
# - Dev: migrate dev/db push
# - Prod: migrate deploy if migrations exist, else db push
# - NO dependency installs here; assumes node_modules already present.
# --------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT_DIR"

echo "→ Running setup_merchize_catalog.sh from project root: $ROOT_DIR"

# Optional flag: --force-migrate (forces treating schema as changed)
FORCE_MIGRATE=0
for arg in "$@"; do
  case "$arg" in
    --force-migrate)
      FORCE_MIGRATE=1
      ;;
  esac
done

SCHEMA_PATH="$ROOT_DIR/prisma/shop/merchize/priceCatalog.prisma"
SCHEMA_HASH_FILE="$ROOT_DIR/.merchize_price_catalog_schema.sha"
MIGRATIONS_DIR="$ROOT_DIR/prisma/shop/merchize/migrations"

if [ ! -f "$SCHEMA_PATH" ]; then
  echo "❌ Prisma schema not found at: $SCHEMA_PATH"
  exit 1
fi

# Ensure data dir exists (for SQLite file)
DATA_DIR="$ROOT_DIR/data"
echo "→ Ensuring data directory exists at $DATA_DIR"
mkdir -p "$DATA_DIR"

# Decide which env file to load
NODE_ENV_EFFECTIVE="${NODE_ENV:-development}"
if [ "$NODE_ENV_EFFECTIVE" = "production" ]; then
  ENV_FILE="$ROOT_DIR/.env.production"
else
  ENV_FILE="$ROOT_DIR/.env.local"
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "⚠️  Env file $ENV_FILE not found. Prisma may not see MERCHIZE_PRICE_CATALOG_DATABASE_URL."
else
  echo "→ Using env file: $ENV_FILE"
  # Export variables so Prisma can see MERCHIZE_PRICE_CATALOG_DATABASE_URL, etc.
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# --------------------------------------------------------------------
# Detect schema fingerprint changes (for dev / debugging purposes)
# --------------------------------------------------------------------
CURRENT_HASH="$(sha256sum "$SCHEMA_PATH" | awk '{print $1}')"
SCHEMA_CHANGED=0

if [ "$FORCE_MIGRATE" -eq 1 ]; then
  echo "→ --force-migrate passed: treating schema as changed."
  SCHEMA_CHANGED=1
elif [ ! -f "$SCHEMA_HASH_FILE" ]; then
  echo "→ No previous schema fingerprint found. Treating as changed."
  SCHEMA_CHANGED=1
else
  PREV_HASH="$(cat "$SCHEMA_HASH_FILE" || true)"
  if [ "$PREV_HASH" != "$CURRENT_HASH" ]; then
    echo "→ Schema fingerprint changed."
    SCHEMA_CHANGED=1
  else
    echo "→ Schema fingerprint unchanged."
  fi
fi

echo "$CURRENT_HASH" >"$SCHEMA_HASH_FILE"

# --------------------------------------------------------------------
# Generate Prisma client for this schema
# --------------------------------------------------------------------
echo "→ Generating Prisma client (Merchize catalog schema)"
yarn prisma generate --schema "$SCHEMA_PATH"

# --------------------------------------------------------------------
# DB sync strategy
# --------------------------------------------------------------------
if [ "$NODE_ENV_EFFECTIVE" = "production" ]; then
  echo "→ NODE_ENV=production: using migrate deploy / db push strategy"

  if [ -d "$MIGRATIONS_DIR" ] && [ "$(ls -A "$MIGRATIONS_DIR")" ]; then
    echo "→ Migrations directory found. Running prisma migrate deploy…"
    yarn prisma migrate deploy --schema "$SCHEMA_PATH"
  else
    echo "→ No migrations directory or it is empty. Running prisma db push…"
    yarn prisma db push --schema "$SCHEMA_PATH"
  fi
else
  echo "→ NODE_ENV=$NODE_ENV_EFFECTIVE: using dev strategy (migrate dev / db push)"

  if [ "$SCHEMA_CHANGED" -eq 1 ]; then
    echo "→ Schema changed: running prisma migrate dev…"
    yarn prisma migrate dev \
      --schema "$SCHEMA_PATH" \
      -n bootstrap_merchize_catalog
  else
    echo "→ Schema unchanged: running prisma db push to ensure DB is in sync…"
    yarn prisma db push --schema "$SCHEMA_PATH"
  fi
fi

echo "✓ Merchize catalog Prisma setup complete."