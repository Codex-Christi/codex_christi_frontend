import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';
import { normalizePostgresSslMode } from '@/lib/prisma/postgresSslMode';
import { PrismaClient } from './txLedger/generated/paypalTxLedger/client';

export type PaypalTxLedgerBranch = 'dev' | 'prod';
export type PaypalTxLedgerBranchSelectionSource =
  | 'explicit'
  | 'fallback'
  | 'node_env_default'
  | 'unconfigured';

export type PaypalTxLedgerDatabaseStatus = {
  configured: boolean;
  devUrlConfigured: boolean;
  explicitBranch: PaypalTxLedgerBranch | null;
  invalidExplicitBranchConfigured: boolean;
  nodeEnv: string;
  prodDevUrlsMatch: boolean;
  prodUrlConfigured: boolean;
  selectedBranch: PaypalTxLedgerBranch | null;
  selectionSource: PaypalTxLedgerBranchSelectionSource;
};

type PaypalTxLedgerConnectionResolution = {
  connectionString: string | null;
  status: PaypalTxLedgerDatabaseStatus;
};

function normalizePaypalTxLedgerBranch(value: string | undefined): PaypalTxLedgerBranch | null {
  const normalizedValue = value?.trim().toLowerCase();

  return normalizedValue === 'prod' || normalizedValue === 'dev' ? normalizedValue : null;
}

function normalizeComparableConnectionString(value: string | undefined) {
  return value?.trim() ? normalizePostgresSslMode(value).trim() : null;
}

function resolvePaypalLedgerConnection(): PaypalTxLedgerConnectionResolution {
  const explicitBranch = normalizePaypalTxLedgerBranch(process.env.PAYPAL_TX_LEDGER_NEON_BRANCH);
  const invalidExplicitBranchConfigured = Boolean(
    process.env.PAYPAL_TX_LEDGER_NEON_BRANCH?.trim() && !explicitBranch,
  );
  const prodUrl = process.env.PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING;
  const devUrl = process.env.PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING;
  const normalizedProdUrl = normalizeComparableConnectionString(prodUrl);
  const normalizedDevUrl = normalizeComparableConnectionString(devUrl);
  const baseStatus = {
    devUrlConfigured: Boolean(normalizedDevUrl),
    explicitBranch,
    invalidExplicitBranchConfigured,
    nodeEnv: process.env.NODE_ENV ?? 'unknown',
    prodDevUrlsMatch: Boolean(
      normalizedProdUrl && normalizedDevUrl && normalizedProdUrl === normalizedDevUrl,
    ),
    prodUrlConfigured: Boolean(normalizedProdUrl),
  };

  if (explicitBranch === 'prod') {
    return {
      connectionString: normalizedProdUrl ? prodUrl! : null,
      status: {
        ...baseStatus,
        configured: Boolean(normalizedProdUrl),
        selectedBranch: normalizedProdUrl ? 'prod' : null,
        selectionSource: normalizedProdUrl ? 'explicit' : 'unconfigured',
      },
    };
  }

  if (explicitBranch === 'dev') {
    return {
      connectionString: normalizedDevUrl ? devUrl! : null,
      status: {
        ...baseStatus,
        configured: Boolean(normalizedDevUrl),
        selectedBranch: normalizedDevUrl ? 'dev' : null,
        selectionSource: normalizedDevUrl ? 'explicit' : 'unconfigured',
      },
    };
  }

  if (process.env.NODE_ENV !== 'production' && normalizedDevUrl) {
    return {
      connectionString: devUrl ?? null,
      status: {
        ...baseStatus,
        configured: true,
        selectedBranch: 'dev',
        selectionSource: 'node_env_default',
      },
    };
  }

  if (normalizedProdUrl) {
    return {
      connectionString: prodUrl ?? null,
      status: {
        ...baseStatus,
        configured: true,
        selectedBranch: 'prod',
        selectionSource: process.env.NODE_ENV === 'production' ? 'node_env_default' : 'fallback',
      },
    };
  }

  if (normalizedDevUrl) {
    return {
      connectionString: devUrl ?? null,
      status: {
        ...baseStatus,
        configured: true,
        selectedBranch: 'dev',
        selectionSource: 'fallback',
      },
    };
  }

  return {
    connectionString: null,
    status: {
      ...baseStatus,
      configured: false,
      selectedBranch: null,
      selectionSource: 'unconfigured',
    },
  };
}

function resolvePaypalLedgerConnectionString(): string | null {
  return resolvePaypalLedgerConnection().connectionString;
}

export function isPaypalTxLedgerDatabaseConfigured() {
  return Boolean(resolvePaypalLedgerConnectionString());
}

export function getPaypalTxLedgerDatabaseStatus(): PaypalTxLedgerDatabaseStatus {
  return resolvePaypalLedgerConnection().status;
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
