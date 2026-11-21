import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { Prisma } from '../../src/lib/prisma/shop/merchize/generated/merchizeCatalog/client.ts';
import {
  checkProductionDatastores,
  resolveDatastores,
  verifyCatalog,
  verifyNeon,
} from '../check-production-datastores.mjs';

// Generate the catalog client first, then run with node --import tsx --test.
// All SQLite databases below are disposable fixtures; no Neon connection is made.
const quote = (value) => `"${value.replaceAll('"', '""')}"`;
const hash = (filename) => createHash('sha256').update(readFileSync(filename)).digest('hex');

function createCatalog(context, { omit = null, wal = false, keepOpen = false } = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'codex-datastore-test-'));
  const filename = path.join(directory, 'catalog.db');
  const database = new Database(filename);
  context.after(() => {
    if (database.open) database.close();
    rmSync(directory, { recursive: true, force: true });
  });
  if (wal) database.pragma('journal_mode = WAL');
  for (const [index, model] of Object.values(Prisma.ModelName).entries()) {
    if (omit === 'table' && index === 0) continue;
    const fields = Object.values(Prisma[`${model}ScalarFieldEnum`]);
    if (omit === 'column' && index === 0) fields.pop();
    database.exec(`CREATE TABLE ${quote(model)} (${fields.map((field) => `${quote(field)} TEXT`).join(',')})`);
  }
  if (!keepOpen) database.close();
  return { directory, filename };
}

test('the generated client verifies SQLite schema without changing its file or directory', async (context) => {
  const { directory, filename } = createCatalog(context);
  const before = hash(filename);
  await verifyCatalog(filename);
  assert.equal(hash(filename), before);
  assert.deepEqual(readdirSync(directory), ['catalog.db']);
});

test('compatibility checks query actual tables and scalar columns, even with zero matching rows', async (context) => {
  for (const omit of ['table', 'column']) {
    await context.test(`missing ${omit} fails`, async (child) => {
      const { filename } = createCatalog(child, { omit });
      await assert.rejects(verifyCatalog(filename));
    });
  }
});

test('a missing SQLite database is never created', async (context) => {
  const { directory } = createCatalog(context);
  const missing = path.join(directory, 'missing.db');
  await assert.rejects(verifyCatalog(missing));
  assert.equal(existsSync(missing), false);
  assert.deepEqual(readdirSync(directory), ['catalog.db']);
});

test('a clean WAL snapshot fails before SQLite can create sidecars', async (context) => {
  const { directory, filename } = createCatalog(context, { wal: true });
  const before = hash(filename);
  assert.deepEqual(readdirSync(directory), ['catalog.db']);
  await assert.rejects(verifyCatalog(filename));
  assert.equal(hash(filename), before);
  assert.deepEqual(readdirSync(directory), ['catalog.db']);
});

test('existing live WAL metadata supports read-only generated-client checks', async (context) => {
  const { filename } = createCatalog(context, { wal: true, keepOpen: true });
  assert.equal(existsSync(`${filename}-wal`), true);
  assert.equal(existsSync(`${filename}-shm`), true);
  await verifyCatalog(filename);
});

function neonFixture(readOnly = 'on') {
  const calls = [];
  const transaction = {
    async $executeRawUnsafe(sql) { calls.push(sql); },
    async $queryRawUnsafe(sql) { calls.push(sql); return [{ read_only: readOnly }]; },
    example: {
      async findMany(query) { calls.push(query); return []; },
    },
  };
  const client = {
    async $transaction(callback, options) {
      assert.deepEqual(options, { maxWait: 10000, timeout: 30000 });
      return callback(transaction);
    },
  };
  return { calls, client, Prisma: { ModelName: { Example: 'Example' } } };
}

test('Neon transactions become read-only before bounded, zero-record schema queries', async () => {
  const fixture = neonFixture();
  await verifyNeon(fixture.client, fixture.Prisma);
  assert.deepEqual(fixture.calls, [
    'SET TRANSACTION READ ONLY',
    "SET LOCAL statement_timeout = '10000ms'",
    "SELECT current_setting('transaction_read_only') AS read_only",
    { where: { OR: [] }, take: 1 },
  ]);
});

test('Neon schema queries stop if the server does not confirm a read-only transaction', async () => {
  const fixture = neonFixture('off');
  await assert.rejects(verifyNeon(fixture.client, fixture.Prisma));
  assert.equal(fixture.calls.length, 3);
});

const neonUrl = 'postgresql://fixture:fixture@ep-fixture.neon.tech/fixture?sslmode=require';
const environment = {
  NODE_ENV: 'production',
  SHOP_OPS_DATA_TARGET: 'prod',
  NEON_ADMIN_OPS_LEDGER_POOLED_URL: neonUrl,
  PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING: neonUrl,
  MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_STRING: neonUrl,
  MERCHIZE_OFFLINE_CATALOG_DATABASE_URL: 'file:/fixture/catalog.db',
};

test('connection checks retain the existing target and reject incompatible endpoints or namespaces', () => {
  assert.equal(resolveDatastores(environment).target, 'prod');
  for (const url of [
    'postgresql://fixture:fixture@localhost/fixture',
    `${neonUrl}&schema=other`,
    neonUrl.replace('require', 'no-verify'),
    undefined,
  ]) {
    assert.throws(() => resolveDatastores({ ...environment, PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING: url }));
  }
});

test('failure messages omit connection-string details and leave databases unchanged', async () => {
  const reports = [];
  await assert.rejects(
    checkProductionDatastores({ ...environment, PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING: 'private-invalid-value' }, (line) => reports.push(line)),
    { message: 'Production datastore check failed at configuration; existing databases unchanged.' },
  );
  assert.deepEqual(reports, []);
});
