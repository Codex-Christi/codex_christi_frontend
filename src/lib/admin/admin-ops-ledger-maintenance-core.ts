import type { PrismaClient } from '../prisma/adminOpsLedger/generated/adminOpsLedger/client';

export type AdminOpsLedgerRetentionPolicy = {
  auditLogRetentionDays: number;
  masterTransferChallengeRetentionHours: number;
  unlockAttemptRetentionHours: number;
};

export type AdminOpsLedgerPruneCutoffs = {
  auditLogCreatedBefore: Date;
  masterTransferChallengeCreatedBefore: Date;
  unlockAttemptCreatedBefore: Date;
};

export type AdminOpsLedgerPruneCounts = {
  auditLogs: number;
  masterTransferChallenges: number;
  unlockAttempts: number;
};

export type AdminOpsLedgerPruneResult = {
  cutoffs: AdminOpsLedgerPruneCutoffs;
  deleted: AdminOpsLedgerPruneCounts;
  policy: AdminOpsLedgerRetentionPolicy;
};

export const ADMIN_OPS_LEDGER_MINIMUM_STORAGE_RETENTION_POLICY: AdminOpsLedgerRetentionPolicy = {
  auditLogRetentionDays: 7,
  masterTransferChallengeRetentionHours: 24,
  unlockAttemptRetentionHours: 24,
};

export const ADMIN_OPS_LEDGER_STANDARD_RETENTION_POLICY: AdminOpsLedgerRetentionPolicy = {
  auditLogRetentionDays: 30,
  masterTransferChallengeRetentionHours: 24,
  unlockAttemptRetentionHours: 24,
};

export function getAdminOpsLedgerPruneCutoffs({
  now = new Date(),
  policy,
}: {
  now?: Date;
  policy: AdminOpsLedgerRetentionPolicy;
}): AdminOpsLedgerPruneCutoffs {
  const timestamp = now.getTime();

  return {
    auditLogCreatedBefore: new Date(
      timestamp - policy.auditLogRetentionDays * 24 * 60 * 60 * 1000,
    ),
    masterTransferChallengeCreatedBefore: new Date(
      timestamp - policy.masterTransferChallengeRetentionHours * 60 * 60 * 1000,
    ),
    unlockAttemptCreatedBefore: new Date(
      timestamp - policy.unlockAttemptRetentionHours * 60 * 60 * 1000,
    ),
  };
}

export async function previewAdminOpsLedgerPrune({
  now,
  policy,
  prisma,
}: {
  now?: Date;
  policy: AdminOpsLedgerRetentionPolicy;
  prisma: PrismaClient;
}) {
  const cutoffs = getAdminOpsLedgerPruneCutoffs({ now, policy });
  const [unlockAttempts, auditLogs, masterTransferChallenges] = await Promise.all([
    prisma.adminUnlockAttempt.count({
      where: {
        createdAt: {
          lt: cutoffs.unlockAttemptCreatedBefore,
        },
      },
    }),
    prisma.adminAuditLog.count({
      where: {
        createdAt: {
          lt: cutoffs.auditLogCreatedBefore,
        },
      },
    }),
    prisma.adminMasterTransferChallenge.count({
      where: {
        createdAt: {
          lt: cutoffs.masterTransferChallengeCreatedBefore,
        },
      },
    }),
  ]);

  return {
    cutoffs,
    eligible: {
      auditLogs,
      masterTransferChallenges,
      unlockAttempts,
    },
    policy,
  };
}

export async function pruneAdminOpsLedger({
  now,
  policy,
  prisma,
}: {
  now?: Date;
  policy: AdminOpsLedgerRetentionPolicy;
  prisma: PrismaClient;
}): Promise<AdminOpsLedgerPruneResult> {
  const cutoffs = getAdminOpsLedgerPruneCutoffs({ now, policy });
  const [unlockAttempts, auditLogs, masterTransferChallenges] = await prisma.$transaction([
    prisma.adminUnlockAttempt.deleteMany({
      where: {
        createdAt: {
          lt: cutoffs.unlockAttemptCreatedBefore,
        },
      },
    }),
    prisma.adminAuditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffs.auditLogCreatedBefore,
        },
      },
    }),
    prisma.adminMasterTransferChallenge.deleteMany({
      where: {
        createdAt: {
          lt: cutoffs.masterTransferChallengeCreatedBefore,
        },
      },
    }),
  ]);

  return {
    cutoffs,
    deleted: {
      auditLogs: auditLogs.count,
      masterTransferChallenges: masterTransferChallenges.count,
      unlockAttempts: unlockAttempts.count,
    },
    policy,
  };
}

export function getAdminOpsLedgerPruneTotal(counts: AdminOpsLedgerPruneCounts) {
  return counts.auditLogs + counts.masterTransferChallenges + counts.unlockAttempts;
}
