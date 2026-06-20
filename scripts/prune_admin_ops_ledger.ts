import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/lib/prisma/adminOpsLedger/generated/adminOpsLedger/client';

dotenv.config({ path: '.env.local' });
dotenv.config();

const DEFAULT_UNLOCK_ATTEMPT_RETENTION_HOURS = 24;
const DEFAULT_AUDIT_LOG_RETENTION_DAYS = 30;

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

async function main() {
  const unlockAttemptRetentionHours = getPositiveNumberEnv(
    'ADMIN_UNLOCK_ATTEMPT_RETENTION_HOURS',
    DEFAULT_UNLOCK_ATTEMPT_RETENTION_HOURS,
  );
  const auditLogRetentionDays = getPositiveNumberEnv(
    'ADMIN_AUDIT_LOG_RETENTION_DAYS',
    DEFAULT_AUDIT_LOG_RETENTION_DAYS,
  );
  const adapter = new PrismaPg({ connectionString: getConnectionString() });
  const prisma = new PrismaClient({ adapter });
  const now = Date.now();
  const unlockAttemptCutoff = new Date(
    now - unlockAttemptRetentionHours * 60 * 60 * 1000,
  );
  const auditLogCutoff = new Date(now - auditLogRetentionDays * 24 * 60 * 60 * 1000);

  const [unlockAttempts, auditLogs] = await prisma.$transaction([
    prisma.adminUnlockAttempt.deleteMany({
      where: {
        createdAt: {
          lt: unlockAttemptCutoff,
        },
      },
    }),
    prisma.adminAuditLog.deleteMany({
      where: {
        createdAt: {
          lt: auditLogCutoff,
        },
      },
    }),
  ]);

  await prisma.$disconnect();

  console.log(
    JSON.stringify(
      {
        ok: true,
        retention: {
          unlockAttemptRetentionHours,
          auditLogRetentionDays,
        },
        deleted: {
          unlockAttempts: unlockAttempts.count,
          auditLogs: auditLogs.count,
        },
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
