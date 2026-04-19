#!/usr/bin/env bash
set -euo pipefail

# Runs once per production deploy inside the Docker `migrate` service.
# Keep this explicit: each Prisma schema uses the production command that fits its DB.

MERCHIZE_SCHEMA="prisma/shop/merchize/priceCatalog.prisma"
PAYPAL_SCHEMA="prisma/shop/paypal/paypalTXLedger.schema.prisma"
CATALOG_DB_URL="${MERCHIZE_PRICE_CATALOG_DATABASE_URL:-file:/app/data/db/shop/merchizeCatalog.db}"

echo "== Prisma production setup start =="

echo "1. Preparing Merchize SQLite catalog"
export MERCHIZE_PRICE_CATALOG_DATABASE_URL="$CATALOG_DB_URL"
mkdir -p /app/data/db/shop

yarn prisma generate --schema "$MERCHIZE_SCHEMA"
RUST_LOG=info yarn prisma db push --schema "$MERCHIZE_SCHEMA"

echo "2. Repairing Merchize SQLite volume permissions"
# Runtime containers run as `node`, and SQLite writes journal/WAL files beside the DB.
chown -R node:node /app/data
chmod -R u+rwX,g+rwX /app/data

echo "3. Preparing PayPal TX ledger"
PAYPAL_TX_LEDGER_NEON_BRANCH=prod yarn prisma generate --schema "$PAYPAL_SCHEMA"
PAYPAL_TX_LEDGER_NEON_BRANCH=prod yarn prisma migrate deploy --schema "$PAYPAL_SCHEMA"

echo "== Prisma production setup complete =="
