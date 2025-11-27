// src/lib/prisma/shop/merchizeCatalogPrisma.ts
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/merchizeCatalog/client';

const adapter = new PrismaBetterSqlite3({
  url: process.env.MERCHIZE_PRICE_CATALOG_DATABASE_URL ?? 'file:./data/merchize_price_catalog.db',
});

declare global {
  var merchizeCatalogPrisma: PrismaClient | undefined;
}

const prisma =
  globalThis.merchizeCatalogPrisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.merchizeCatalogPrisma = prisma;
}

export { prisma as merchizeCatalogPrisma };
