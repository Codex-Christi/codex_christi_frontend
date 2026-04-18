// prisma.config.ts
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

dotenv.config({ path: '.env.local' });
dotenv.config();

const root = __dirname;

// ── Schema paths ──────────────────────────────────────────────
const schemas = {
  merchize: path.join(root, 'prisma', 'shop', 'merchize', 'priceCatalog.prisma'),
  paypal: path.join(root, 'prisma', 'shop', 'paypal', 'paypalTXLedger.schema.prisma'),
} as const;

// ── Parse --schema from argv ──────────────────────────────────
function getSchemaArg(): string {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--schema' && args[i + 1]) return path.resolve(root, args[i + 1]);
    if (args[i].startsWith('--schema=')) return path.resolve(root, args[i].slice(9));
  }
  throw new Error(
    'Prisma schema must be passed explicitly with --schema.\n' +
      '  e.g. yarn prisma generate --schema prisma/shop/paypal/paypalTXLedger.schema.prisma',
  );
}

// ── Resolve datasource URL per schema ─────────────────────────
const schemaPath = getSchemaArg();

const defaultCatalogDbPath = path.join(root, 'data', 'db', 'shop', 'merchizeCatalog.db');

function resolveCatalogDbUrl(): string {
  const envUrl = process.env.MERCHIZE_PRICE_CATALOG_DATABASE_URL;
  if (!envUrl) return `file:${defaultCatalogDbPath}`;
  if (!envUrl.startsWith('file:')) {
    throw new Error('MERCHIZE_PRICE_CATALOG_DATABASE_URL must be a SQLite file: URL.');
  }

  const sqlitePath = envUrl.slice('file:'.length);
  if (sqlitePath === ':memory:' || path.isAbsolute(sqlitePath)) return envUrl;

  // Prisma CLI and runtime must resolve relative SQLite paths from the project root.
  return `file:${path.resolve(root, sqlitePath)}`;
}

function resolve(): { schema: string; url: string } {
  if (schemaPath === schemas.merchize) {
    const url = resolveCatalogDbUrl();
    if (url !== 'file::memory:') {
      fs.mkdirSync(path.dirname(url.slice('file:'.length)), { recursive: true });
    }
    return {
      schema: './prisma/shop/merchize/priceCatalog.prisma',
      url,
    };
  }

  if (schemaPath === schemas.paypal) {
    const target = process.env.PAYPAL_TX_LEDGER_NEON_BRANCH;
    if (target !== 'dev' && target !== 'prod') {
      throw new Error('PAYPAL_TX_LEDGER_NEON_BRANCH must be "dev" or "prod".');
    }
    const url =
      target === 'prod'
        ? process.env.PAYPAL_TX_LEDGER_NEON_DB_STRING
        : process.env.PAYPAL_TX_LEDGER_NEON_DB_DEV_STRING;
    if (!url) throw new Error(`Missing Neon DB string for PayPal ${target} branch.`);
    return { schema: './prisma/shop/paypal/paypalTXLedger.schema.prisma', url };
  }

  throw new Error(`Unknown schema: ${schemaPath}\nAdd it to prisma.config.ts.`);
}

const config = resolve();

export default defineConfig({
  schema: config.schema,
  datasource: { url: config.url },
});
