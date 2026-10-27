import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';
import { normalizePostgresSslMode } from '@/lib/prisma/postgresSslMode';
import { PrismaClient } from './generated/adminOpsLedger/client';

function resolveAdminOpsLedgerConnectionString(): string | null {
  return (
    process.env.NEON_ADMIN_OPS_LEDGER_POOLED_URL ?? process.env.NEON_ADMIN_OPS_LEDGER_URL ?? null
  );
}

export function isAdminOpsLedgerDatabaseConfigured() {
  return Boolean(resolveAdminOpsLedgerConnectionString());
}

declare global {
  var __adminOpsLedgerPrisma__: PrismaClient | undefined;
}

let adminOpsLedgerSingleton: PrismaClient | undefined;

export function getAdminOpsLedgerPrisma() {
  const connectionString = resolveAdminOpsLedgerConnectionString();

  if (!connectionString) {
    throw new Error(
      'No Admin Ops Ledger database URL is configured. Set NEON_ADMIN_OPS_LEDGER_POOLED_URL for runtime access.',
    );
  }

  const cachedClient = global.__adminOpsLedgerPrisma__ ?? adminOpsLedgerSingleton;
  if (cachedClient) return cachedClient;

  const adapter = new PrismaPg({ connectionString: normalizePostgresSslMode(connectionString) });
  const prisma = new PrismaClient({ adapter });
  adminOpsLedgerSingleton = prisma;

  if (process.env.NODE_ENV !== 'production') {
    global.__adminOpsLedgerPrisma__ = prisma;
  }

  return prisma;
}
