import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  pruneAdminOpsLedger,
  type AdminOpsLedgerRetentionPolicy,
} from '../src/lib/admin/admin-ops-ledger-maintenance-core';
import { normalizePostgresSslMode } from '../src/lib/prisma/postgresSslMode';
import { PrismaClient } from '../src/lib/prisma/adminOpsLedger/generated/adminOpsLedger/client';

dotenv.config({ path: '.env.local' });
dotenv.config();

const DEFAULT_RETENTION_POLICY: AdminOpsLedgerRetentionPolicy = {
  unlockAttemptRetentionHours: 24,
  auditLogRetentionDays: 30,
  masterTransferChallengeRetentionHours: 24,
};

function getConnectionString() {
  const connectionString =
    process.env.NEON_ADMIN_OPS_LEDGER_URL ?? process.env.NEON_ADMIN_OPS_LEDGER_POOLED_URL;

  if (!connectionString) {
    throw new Error('Set NEON_ADMIN_OPS_LEDGER_URL before pruning the admin ops ledger.');
  }

  return connectionString;
}

function getPositiveNumberEnv(name: string, fallback: number) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }

  return parsed;
}

function getRetentionPolicyFromEnv(): AdminOpsLedgerRetentionPolicy {
  return {
    unlockAttemptRetentionHours: getPositiveNumberEnv(
      'ADMIN_UNLOCK_ATTEMPT_RETENTION_HOURS',
      DEFAULT_RETENTION_POLICY.unlockAttemptRetentionHours,
    ),
    auditLogRetentionDays: getPositiveNumberEnv(
      'ADMIN_AUDIT_LOG_RETENTION_DAYS',
      DEFAULT_RETENTION_POLICY.auditLogRetentionDays,
    ),
    masterTransferChallengeRetentionHours: getPositiveNumberEnv(
      'ADMIN_MASTER_TRANSFER_CHALLENGE_RETENTION_HOURS',
      DEFAULT_RETENTION_POLICY.masterTransferChallengeRetentionHours,
    ),
  };
}

async function main() {
  const adapter = new PrismaPg({
    connectionString: normalizePostgresSslMode(getConnectionString()),
  });
  const prisma = new PrismaClient({ adapter });
  const result = await pruneAdminOpsLedger({
    policy: getRetentionPolicyFromEnv(),
    prisma,
  });

  await prisma.$disconnect();

  console.log(
    JSON.stringify(
      {
        ok: true,
        retention: {
          unlockAttemptRetentionHours: result.policy.unlockAttemptRetentionHours,
          auditLogRetentionDays: result.policy.auditLogRetentionDays,
          masterTransferChallengeRetentionHours:
            result.policy.masterTransferChallengeRetentionHours,
        },
        cutoffs: {
          unlockAttemptCreatedBefore: result.cutoffs.unlockAttemptCreatedBefore.toISOString(),
          auditLogCreatedBefore: result.cutoffs.auditLogCreatedBefore.toISOString(),
          masterTransferChallengeCreatedBefore:
            result.cutoffs.masterTransferChallengeCreatedBefore.toISOString(),
        },
        deleted: result.deleted,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
