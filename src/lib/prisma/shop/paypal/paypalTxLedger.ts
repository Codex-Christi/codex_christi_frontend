import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './txLedger/generated/paypalTxLedger/client';

function getPaypalLedgerConnectionString(): string {
  const explicitTarget = process.env.PAYPAL_TX_LEDGER_NEON_BRANCH;
  const prodUrl = process.env.PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING;
  const devUrl = process.env.PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING;

  if (explicitTarget === 'prod') {
    if (!prodUrl) throw new Error('PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING is not configured.');
    return prodUrl;
  }

  if (explicitTarget === 'dev') {
    if (!devUrl) throw new Error('PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING is not configured.');
    return devUrl;
  }

  if (process.env.NODE_ENV !== 'production' && devUrl) {
    return devUrl;
  }

  if (prodUrl) {
    return prodUrl;
  }

  throw new Error(
    'No pooled PayPal ledger database URL is configured. Set PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING or PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING.',
  );
}

const adapter = new PrismaPg({
  connectionString: getPaypalLedgerConnectionString(),
});

declare global {
  var __paypalTxLedger__: PrismaClient | undefined;
}

export const paypalTxLedger =
  global.__paypalTxLedger__ ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== 'production') {
  global.__paypalTxLedger__ = paypalTxLedger;
}
