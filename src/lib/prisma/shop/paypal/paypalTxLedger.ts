import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';
import { normalizePostgresSslMode } from '@/lib/prisma/postgresSslMode';
import { PrismaClient } from './txLedger/generated/paypalTxLedger/client';

function resolvePaypalLedgerConnectionString(): string | null {
  const explicitTarget = process.env.PAYPAL_TX_LEDGER_NEON_BRANCH;
  const prodUrl = process.env.PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING;
  const devUrl = process.env.PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING;

  if (explicitTarget === 'prod') {
    return prodUrl ?? null;
  }

  if (explicitTarget === 'dev') {
    return devUrl ?? null;
  }

  if (process.env.NODE_ENV !== 'production' && devUrl) {
    return devUrl;
  }

  if (prodUrl) {
    return prodUrl;
  }

  return devUrl ?? null;
}

export function isPaypalTxLedgerDatabaseConfigured() {
  return Boolean(resolvePaypalLedgerConnectionString());
}

declare global {
  var __paypalTxLedger__: PrismaClient | undefined;
}

let paypalTxLedgerSingleton: PrismaClient | undefined;

export function getPaypalTxLedger() {
  const cachedClient = global.__paypalTxLedger__ ?? paypalTxLedgerSingleton;
  if (cachedClient) return cachedClient;

  const connectionString = resolvePaypalLedgerConnectionString();
  if (!connectionString) {
    throw new Error(
      'No pooled PayPal ledger database URL is configured. Set PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING or PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING.',
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: normalizePostgresSslMode(connectionString) }),
  });

  paypalTxLedgerSingleton = prisma;

  if (process.env.NODE_ENV !== 'production') {
    global.__paypalTxLedger__ = prisma;
  }

  return prisma;
}

export const paypalTxLedger = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPaypalTxLedger();
    const value = Reflect.get(client, property, receiver);

    return typeof value === 'function' ? value.bind(client) : value;
  },
});
