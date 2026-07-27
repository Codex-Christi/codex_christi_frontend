import 'server-only';

import { createHash } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { normalizePostgresSslMode } from '@/lib/prisma/postgresSslMode';
import { getShopOpsDataTargetStatus } from '@/lib/prisma/shop/shopOpsDataTarget';
import { PrismaClient } from './txLedger/generated/paypalTxLedger/client';

export type PaypalTxLedgerBranch = 'dev' | 'prod';
export type PaypalTxLedgerBranchSelectionSource =
  'canonical' | 'explicit' | 'legacy_aligned' | 'unconfigured';

export type PaypalTxLedgerDatabaseStatus = {
  configured: boolean;
  devUrlFingerprint: string | null;
  devUrlConfigured: boolean;
  explicitBranch: PaypalTxLedgerBranch | null;
  invalidExplicitBranchConfigured: boolean;
  nodeEnv: string;
  prodDevUrlsMatch: boolean;
  prodUrlFingerprint: string | null;
  prodUrlConfigured: boolean;
  selectedBranch: PaypalTxLedgerBranch | null;
  selectedUrlFingerprint: string | null;
  selectionSource: PaypalTxLedgerBranchSelectionSource;
  shopOpsConfigurationError: string | null;
};

type PaypalTxLedgerConnectionResolution = {
  connectionString: string | null;
  status: PaypalTxLedgerDatabaseStatus;
};

function normalizeComparableConnectionString(value: string | undefined) {
  return value?.trim() ? normalizePostgresSslMode(value).trim() : null;
}

function fingerprintConnectionString(value: string | null) {
  if (!value) return null;

  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function resolvePaypalLedgerConnection(): PaypalTxLedgerConnectionResolution {
  const shopOpsTarget = getShopOpsDataTargetStatus();
  const explicitBranch = shopOpsTarget.paypalLegacyTarget;
  const invalidExplicitBranchConfigured = Boolean(
    process.env.PAYPAL_TX_LEDGER_NEON_BRANCH?.trim() && !explicitBranch,
  );
  const prodUrl = process.env.PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING;
  const devUrl = process.env.PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING;
  const normalizedProdUrl = normalizeComparableConnectionString(prodUrl);
  const normalizedDevUrl = normalizeComparableConnectionString(devUrl);
  const baseStatus = {
    devUrlFingerprint: fingerprintConnectionString(normalizedDevUrl),
    devUrlConfigured: Boolean(normalizedDevUrl),
    explicitBranch,
    invalidExplicitBranchConfigured,
    nodeEnv: process.env.NODE_ENV ?? 'unknown',
    prodDevUrlsMatch: Boolean(
      normalizedProdUrl && normalizedDevUrl && normalizedProdUrl === normalizedDevUrl,
    ),
    prodUrlFingerprint: fingerprintConnectionString(normalizedProdUrl),
    prodUrlConfigured: Boolean(normalizedProdUrl),
    shopOpsConfigurationError: shopOpsTarget.configurationError,
  };
  const selectedBranch = shopOpsTarget.aligned ? shopOpsTarget.target : null;
  const selectedUrl =
    selectedBranch === 'prod'
      ? normalizedProdUrl
        ? prodUrl
        : null
      : selectedBranch === 'dev'
        ? normalizedDevUrl
          ? devUrl
          : null
        : null;
  const normalizedSelectedUrl =
    selectedBranch === 'prod'
      ? normalizedProdUrl
      : selectedBranch === 'dev'
        ? normalizedDevUrl
        : null;

  if (selectedBranch && selectedUrl && normalizedSelectedUrl) {
    return {
      connectionString: selectedUrl,
      status: {
        ...baseStatus,
        configured: true,
        selectedBranch,
        selectedUrlFingerprint: fingerprintConnectionString(normalizedSelectedUrl),
        selectionSource:
          shopOpsTarget.source === 'canonical'
            ? 'canonical'
            : shopOpsTarget.source === 'legacy_aligned'
              ? 'legacy_aligned'
              : 'explicit',
      },
    };
  }

  return {
    connectionString: null,
    status: {
      ...baseStatus,
      configured: false,
      selectedBranch,
      selectedUrlFingerprint: null,
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
