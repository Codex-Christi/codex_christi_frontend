import { closeSync, existsSync, openSync, readSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { normalizePostgresSslMode } from '../src/lib/prisma/postgresSslMode.ts';
import { resolveShopOpsDataTarget } from '../src/lib/prisma/shop/shopOpsDataTarget.ts';

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientPaths = {
  catalog: '../src/lib/prisma/shop/merchize/generated/merchizeCatalog/client.ts',
  admin: '../src/lib/prisma/adminOpsLedger/generated/adminOpsLedger/client.ts',
  paypal: '../src/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client.ts',
  fulfillment: '../src/lib/prisma/shop/merchizeFulfillmentOps/generated/merchizeFulfillmentOps/client.ts',
};

function required(condition) {
  if (!condition) throw new Error('Datastore configuration or compatibility check failed.');
}

export function resolveDatastores(env = process.env) {
  required(env.NODE_ENV === 'production');
  const status = resolveShopOpsDataTarget(env);
  required(status.aligned && status.target);
  const production = status.target === 'prod';
  const connections = {
    admin: env.NEON_ADMIN_OPS_LEDGER_POOLED_URL ?? env.NEON_ADMIN_OPS_LEDGER_URL,
    paypal: production
      ? env.PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING
      : env.PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING,
    fulfillment: production
      ? env.MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_STRING?.trim() || env.MERCHIZE_FULFILLMENT_OPS_DATABASE_URL?.trim()
      : env.MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_DEV_STRING?.trim() || env.MERCHIZE_FULFILLMENT_OPS_DATABASE_DEV_URL?.trim(),
  };
  for (const value of Object.values(connections)) {
    required(typeof value === 'string' && value.length > 0);
    const url = new URL(value);
    required(['postgres:', 'postgresql:'].includes(url.protocol));
    required(url.hostname.endsWith('.neon.tech') && url.pathname.length > 1 && !url.hash);
    // The app uses PrismaPg's public namespace, not a URL-selected schema.
    required(!url.searchParams.has('schema') || url.searchParams.get('schema') === 'public');
    // Mirror the app's SSL normalization; credentials and endpoint names are never logged.
    const normalized = new URL(normalizePostgresSslMode(value));
    const sslMode = normalized.searchParams.get('sslmode')?.toLowerCase();
    required(!sslMode || sslMode === 'verify-full');
  }
  const catalogUrl = env.MERCHIZE_OFFLINE_CATALOG_DATABASE_URL;
  required(typeof catalogUrl === 'string' && catalogUrl.startsWith('file:'));
  const catalogPath = catalogUrl.slice('file:'.length);
  required(path.isAbsolute(catalogPath) && catalogPath !== ':memory:');
  return { connections, catalogPath, target: status.target };
}

async function loadClient(name) {
  const generated = await import(new URL(clientPaths[name], import.meta.url).href);
  required(generated.PrismaClient && generated.Prisma?.ModelName);
  return generated;
}

export async function verifyModels(client, Prisma) {
  const modelNames = Object.values(Prisma.ModelName);
  required(modelNames.length > 0);
  for (const model of modelNames) {
    const delegate = model[0].toLowerCase() + model.slice(1);
    required(typeof client[delegate]?.findMany === 'function');
    // Empty OR is false: Prisma selects its scalar columns but returns no records.
    const rows = await client[delegate].findMany({ where: { OR: [] }, take: 1 });
    required(Array.isArray(rows) && rows.length === 0);
  }
}

export async function verifyNeon(client, Prisma) {
  await client.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await transaction.$executeRawUnsafe("SET LOCAL statement_timeout = '10000ms'");
    const setting = await transaction.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS read_only");
    required(setting.length === 1 && setting[0].read_only === 'on');
    await verifyModels(transaction, Prisma);
  }, { maxWait: 10000, timeout: 30000 });
}

export async function verifyCatalog(catalogPath) {
  required(existsSync(catalogPath));
  const descriptor = openSync(catalogPath, 'r');
  const header = Buffer.alloc(20);
  try {
    required(readSync(descriptor, header, 0, header.length, 0) === header.length);
  } finally {
    closeSync(descriptor);
  }
  required(header.subarray(0, 16).equals(Buffer.from('SQLite format 3\0')));
  if (header[18] === 2 || header[19] === 2) {
    // A clean WAL snapshot without sidecars may make SQLite try to create them.
    // Fail closed; initial archived-app readiness handles its normal startup separately.
    // Never copy an active database piecemeal or bypass WAL with immutable=1.
    required(existsSync(`${catalogPath}-wal`) && existsSync(`${catalogPath}-shm`));
  }
  const database = new Database(catalogPath, { readonly: true, fileMustExist: true, timeout: 5000 });
  try {
    database.pragma('query_only = ON');
    required(database.pragma('quick_check', { simple: true }) === 'ok');
  } finally {
    database.close();
  }
  const { PrismaClient, Prisma } = await loadClient('catalog');
  const client = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${catalogPath}`, readonly: true, fileMustExist: true, timeout: 5000 }),
    log: [],
  });
  try {
    await verifyModels(client, Prisma);
  } finally {
    await client.$disconnect();
  }
}

export async function checkProductionDatastores(env = process.env, report = console.log) {
  let stage = 'configuration';
  try {
    // No app modules, callbacks, migrations, catalog synchronization or credentials helpers run.
    const { connections, catalogPath } = resolveDatastores(env);
    required(!existsSync(path.join(projectDirectory, 'prisma/userSecurity/userSecurity.schema.prisma')));
    stage = 'catalog';
    await verifyCatalog(catalogPath);
    report('Datastore catalog=OK; access=read-only');
    for (const name of ['admin', 'paypal', 'fulfillment']) {
      stage = name;
      const { PrismaClient, Prisma } = await loadClient(name);
      const client = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: normalizePostgresSslMode(connections[name]),
          max: 1,
          connectionTimeoutMillis: 10000,
        }),
        log: [],
      });
      try {
        await verifyNeon(client, Prisma);
      } finally {
        await client.$disconnect();
      }
      report(`Datastore ${name}=OK; access=read-only`);
    }
    report('Production datastores=OK; schema changes=none');
  } catch {
    // Driver errors can contain endpoints, SQL or credentials. Emit only a fixed stage.
    throw new Error(`Production datastore check failed at ${stage}; existing databases unchanged.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await checkProductionDatastores();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
