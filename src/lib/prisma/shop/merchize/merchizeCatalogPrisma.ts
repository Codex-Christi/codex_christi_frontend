// src/lib/prisma/shop/merchize/merchizeCatalogPrisma.ts
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/merchizeCatalog/client';
import fs from 'fs';
import path from 'path';

// Keep this default in sync with prisma.config.ts and the Docker /app/data volume.
const DEFAULT_DB_URL = `file:${path.join(process.cwd(), 'data', 'db', 'shop', 'merchizeCatalog.db')}`;

function resolveDbUrl(): ':memory:' | (string & {}) {
  const url = process.env.MERCHIZE_PRICE_CATALOG_DATABASE_URL ?? DEFAULT_DB_URL;
  if (url === ':memory:' || url === 'file::memory:') return url as ':memory:' | (string & {});
  if (!url.startsWith('file:')) {
    throw new Error('MERCHIZE_PRICE_CATALOG_DATABASE_URL must be a SQLite file: URL.');
  }

  const filePath = url.slice('file:'.length);
  return (path.isAbsolute(filePath) ? url : `file:${path.resolve(process.cwd(), filePath)}`) as string & {};
}

// Prisma's adapter expects ':memory:' | (string & {}), so we narrow the type here.
const dbUrl = resolveDbUrl();

// Ensure the parent folder exists so SQLite can create or open the catalog file.
if (dbUrl.startsWith('file:') && dbUrl !== 'file::memory:') {
  const dir = path.dirname(dbUrl.slice('file:'.length));
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error('Failed to ensure Merchize catalog DB directory exists:', err);
  }
}

let adapter: PrismaBetterSqlite3 | undefined;

try {
  // New API: pass an options object with `url`, not a Database instance
  adapter = new PrismaBetterSqlite3({ url: dbUrl });
} catch (err) {
  console.error('Error initializing Prisma adapter for Merchize catalog:', err);
}

declare global {
  // Re-use the client between HMR reloads in dev
  var merchizeCatalogPrisma: PrismaClient | undefined;
}

let prisma: PrismaClient;

try {
  if (!adapter) {
    throw new Error('Prisma adapter failed to initialize');
  }

  prisma = globalThis.merchizeCatalogPrisma ?? new PrismaClient({ adapter });
} catch (err) {
  console.error('Error initializing PrismaClient (Merchize catalog):', err);
  throw err;
}

if (process.env.NODE_ENV !== 'production') {
  globalThis.merchizeCatalogPrisma = prisma;
}

export { prisma as merchizeCatalogPrisma };
