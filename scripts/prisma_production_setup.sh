#!/usr/bin/env bash
set -euo pipefail

# Runs once per production deploy inside the Docker `migrate` service.
# Keep this explicit: each Prisma schema uses the production command that fits its DB.

ADMIN_SCHEMA="prisma/adminOpsLedger/adminOpsLedger.schema.prisma"
MERCHIZE_SCHEMA="prisma/shop/merchize/priceCatalog.prisma"
PAYPAL_SCHEMA="prisma/shop/paypal/paypalTXLedger.schema.prisma"
CATALOG_DB_URL="${MERCHIZE_OFFLINE_CATALOG_DATABASE_URL:-file:/app/data/db/shop/merchizeCatalog.db}"

echo "== Prisma production setup start =="

# Pin the selected URL before Prisma loads dotenv files, including the pooled fallback.
export NEON_ADMIN_OPS_LEDGER_URL="${NEON_ADMIN_OPS_LEDGER_URL-${NEON_ADMIN_OPS_LEDGER_POOLED_URL-}}"
node --input-type=module -e '
  if (process.env.NODE_ENV !== "production") {
    console.error("Production database setup requires NODE_ENV=production.");
    process.exit(1);
  }
  try {
    const value = process.env.NEON_ADMIN_OPS_LEDGER_URL;
    if (!value || /[\s\\]/u.test(value)) throw new Error();
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) ||
        !url.hostname || url.pathname.length < 2 || url.hash) throw new Error();
  } catch {
    console.error("Set a valid production Admin Ops PostgreSQL URL in the migrate service environment.");
    process.exit(1);
  }
'

echo "1. Applying Admin Ops migrations"
yarn prisma generate --schema "$ADMIN_SCHEMA"
yarn prisma migrate deploy --schema "$ADMIN_SCHEMA"

echo "2. Preparing Merchize SQLite catalog"
export MERCHIZE_OFFLINE_CATALOG_DATABASE_URL="$CATALOG_DB_URL"
mkdir -p /app/data/db/shop

yarn prisma generate --schema "$MERCHIZE_SCHEMA"
RUST_LOG=info yarn prisma db push --schema "$MERCHIZE_SCHEMA"

echo "3. Repairing Merchize SQLite volume permissions"
# Runtime containers run as `node`, and SQLite writes journal/WAL files beside the DB.
chown -R node:node /app/data
chmod -R u+rwX,g+rwX /app/data

echo "4. Preparing PayPal TX ledger"
PAYPAL_TX_LEDGER_NEON_BRANCH=prod yarn prisma generate --schema "$PAYPAL_SCHEMA"
PAYPAL_TX_LEDGER_NEON_BRANCH=prod yarn prisma migrate deploy --schema "$PAYPAL_SCHEMA"

echo "== Prisma production setup complete =="
