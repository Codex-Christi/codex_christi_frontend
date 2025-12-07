// src/lib/prisma/shop/merchize/merchizeCatalogPrisma.ts
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/merchizeCatalog/client';
import fs from 'fs';
import path from 'path';

// Keep this in sync with prisma.config.ts / MERCHIZE_PRICE_CATALOG_DATABASE_URL
const DEFAULT_DB_URL = 'file:/data/db/shop/merchizeCatalog.db';

// Prisma's adapter expects ':memory:' | (string & {}), so we narrow the type here
const dbUrl = (process.env.MERCHIZE_PRICE_CATALOG_DATABASE_URL ?? DEFAULT_DB_URL) as
  | ':memory:'
  | (string & {});

// If we're using a file: URL, make sure the folder exists so SQLite can create the file
if (dbUrl.startsWith('file:')) {
  const filePath = dbUrl.slice('file:'.length); // e.g. "/data/db/shop/merchizeCatalog.db"
  const dir = path.dirname(filePath);
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
