// Run only inside the exact checker image, with --network none, read-only
// root and a temporary filesystem. No application env files or real data.
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { strict as assert } from 'node:assert';
import Database from 'better-sqlite3';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';

const generated = [
  '/app/src/lib/prisma/shop/merchize/generated/merchizeCatalog/client.ts',
  '/app/src/lib/prisma/adminOpsLedger/generated/adminOpsLedger/client.ts',
  '/app/src/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client.ts',
  '/app/src/lib/prisma/shop/merchizeFulfillmentOps/generated/merchizeFulfillmentOps/client.ts',
];

function verifyDelegates(client, Prisma) {
  const models = Object.values(Prisma.ModelName);
  assert.ok(models.length > 0);
  for (const model of models) {
    assert.equal(typeof client[model[0].toLowerCase() + model.slice(1)]?.findMany, 'function');
  }
}

const temp = mkdtempSync('/tmp/codex-checker-fixture-');
try {
  const database = new Database(':memory:');
  try {
    assert.equal(database.prepare('SELECT 1 AS value').get().value, 1);
    // Copy only this empty synthetic in-memory database into container tmpfs
    // to exercise the same read-only SQLite adapter options used in preflight.
    await database.backup(join(temp, 'catalog.sqlite'));
  } finally {
    database.close();
  }

  const catalog = await import(generated[0]);
  const sqliteClient = new catalog.PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: `file:${join(temp, 'catalog.sqlite')}`,
      readonly: true,
      fileMustExist: true,
      timeout: 5000,
    }),
    log: [],
  });
  try {
    verifyDelegates(sqliteClient, catalog.Prisma);
    const rows = await sqliteClient.$queryRaw`SELECT 1 AS value`;
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].value), 1);
  } finally {
    await sqliteClient.$disconnect();
  }

  // Instantiate and inspect the actual PostgreSQL client/adapter pairs.
  // Do not connect or issue any query; no database endpoint is contacted.
  for (const clientPath of generated.slice(1)) {
    const { PrismaClient, Prisma } = await import(clientPath);
    const client = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: 'postgresql://fixture:fixture@127.0.0.1:5432/synthetic',
        max: 1,
        connectionTimeoutMillis: 1000,
      }),
      log: [],
    });
    try {
      verifyDelegates(client, Prisma);
    } finally {
      await client.$disconnect();
    }
  }
} finally {
  rmSync(temp, { recursive: true });
}

console.log('Checker imports, all four generated clients, SQLite native and Prisma read-only fixture=OK.');
