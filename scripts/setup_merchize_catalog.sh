#!/usr/bin/env bash
set -euo pipefail

WITH_CRON=0
RUN_BUILD=1
RUN_DEPS=1
FORCE_MIGRATE=0

for arg in "$@"; do
  case "$arg" in
    --with-cron)
      WITH_CRON=1
      ;;
    --no-build)
      RUN_BUILD=0
      ;;
    --no-deps)
      RUN_DEPS=0
      ;;
    --force-migrate)
      FORCE_MIGRATE=1
      ;;
  esac
done

SCHEMA_PATH="prisma/shop/merchize/priceCatalog.prisma"
SCHEMA_HASH_FILE=".merchize_price_catalog_schema.sha"

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

echo "→ Ensuring data directory exists"
mkdir -p ./data

if [ ! -f .env ]; then
  cat <<'EOF'
⚠️  .env missing. Create it with at least:

MERCHIZE_PRICE_CATALOG_DATABASE_URL="file:./data/merchize_price_catalog.db"
MERCHIZE_PRICE_CATALOG_CRON_SECRET="some-long-random"
MERCHIZE_PRICE_CATALOG_ADMIN_PASSWORD="your-admin-password"

MERCHIZE_CATALOG_URL="https://bo-group-2-2.merchize.com/27mkjsl/bo-api/product/catalog/"
MERCHIZE_API_KEY="YOUR_MERCHIZE_TOKEN"
MERCHIZE_BASE_URL="https://bo-group-2-2.merchize.com/27mkjsl/bo-api"
MERCHIZE_API_KEY="YOUR_MERCHIZE_TOKEN"
EOF
  exit 1
fi

if [ "$RUN_DEPS" -eq 1 ]; then
  echo "→ Installing deps (yarn)"
  yarn install --frozen-lockfile || yarn install
else
  echo "→ Skipping yarn install (RUN_DEPS=0)"
fi

echo "→ Generate Prisma client (Merchize catalog schema)"
yarn prisma generate \
  --schema prisma/shop/merchize/priceCatalog.prisma

if [ "${MERCHIZE_PRICE_CATALOG_SCHEMA_CHANGED:-1}" = "1" ]; then
  echo "→ Schema changed (or unknown): running Prisma migrate dev for Merchize catalog DB"
  yarn prisma migrate dev \
    --schema prisma/shop/merchize/priceCatalog.prisma \
    -n bootstrap_merchize_catalog
else
  echo "→ Schema unchanged: skipping migrate dev, ensuring DB is in sync with db push"
  yarn prisma db push \
    --schema prisma/shop/merchize/priceCatalog.prisma
fi

if [ "$RUN_BUILD" -eq 1 ]; then
  echo "→ Build Next.js app"
  yarn build
else
  echo "→ Skipping Next.js build (RUN_BUILD=0)"
fi

echo "✓ Merchize catalog setup complete."

echo
echo "Next steps:"
echo "1) Start your app: yarn start (or your PM2 / Docker command)."
echo "2) Once the app is running, ingest the catalog via either:"
echo "   curl -X POST -H \"x-cron-secret: \$MERCHIZE_PRICE_CATALOG_CRON_SECRET\" http://localhost:3000/api/jobs/merchize-refresh"
echo "   or visit /admin/merchize and click 'Refresh now'."

if [ $WITH_CRON -eq 1 ]; then
  echo
  echo "→ Example cron on VPS:"
  echo "   10 3 * * * curl -fsS -X POST -H \"x-cron-secret: \$MERCHIZE_PRICE_CATALOG_CRON_SECRET\" https://YOUR_DOMAIN/api/jobs/merchize-refresh >/dev/null"
fi