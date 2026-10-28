import 'server-only';

import argon2 from 'argon2';
import { parseOptionalNewAdminPassword } from '../formSchemas/admin-password';
import { withAdminCredentialWork } from './admin-credential-work';
import { AdminCredentialError } from './admin-credential-work';
import {
  lockAdminUsersForWrite,
  requireCurrentMaster,
  type AdminWriteActor,
} from './admin-write-guards';
import type { Prisma } from '@/lib/prisma/adminOpsLedger/generated/adminOpsLedger/client';
import { getAdminOpsLedgerPrisma } from '@/lib/prisma/adminOpsLedger/adminOpsLedgerPrisma';
import {
  isActiveAdminStatus,
  isMasterAdminRole,
  normalizeAdminRole,
  normalizeAdminScopes,
  type AdminRole,
  type AdminScope,
  type AdminStatus,
} from './admin-config';
import { toAdminOpsLedgerUnavailableError } from './admin-ops-ledger-errors';
import { getAdminRequestAuditContext, type AdminRequestAuditContext } from './admin-request-audit';

const UNLOCK_WINDOW_MS = 15 * 60 * 1000;
const UNLOCK_LOCK_MS = 15 * 60 * 1000;
const MAX_UNLOCK_FAILURES = 5;

export type AdminUserAuthRecord = {
  id: string;
  codexUserId: string;
  email: string | null;
  displayName: string | null;
  passwordHash: string;
  role: AdminRole;
  scopes: AdminScope[];
  status: 'active';
  sessionVersion: number;
};

export type AdminUserSummary = {
  id: string;
  codexUserId: string;
  email: string | null;
  displayName: string | null;
  role: AdminRole | null;
  scopes: AdminScope[];
  status: string;
  lastUnlockedAt: Date | null;
  updatedAt: Date;
};

export type AdminAuditLogSummary = {
  id: string;
  actorCodexUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  outcome: string;
  metadata: unknown;
  ipHash: string | null;
  userAgentHash: string | null;
  createdAt: Date;
};

export type AdminAuditLogFilters = {
  action?: string;
  actorCodexUserId?: string;
  outcome?: string;
  since?: '24h';
  targetId?: string;
};

export type AdminAuditLogDeleteRange = {
  from: Date;
  to: Date;
};

export type AdminOpsDashboardSummary = {
  activeAdmins: number;
  disabledAdmins: number;
  recentAuditIssues: number;
  recentAuditWindowHours: number;
};

export type AdminUserProvisionInput = {
  codexUserId: string;
  email: string | null;
  displayName: string | null;
  password: string | null;
  role: AdminRole;
  scopes: AdminScope[];
  status: AdminStatus;
};

export type AdminAuditActor =
  Pick<AdminUserAuthRecord, 'id' | 'codexUserId'> | { adminUserId: string; userID: string } | null;

const adminAuditLogSummarySelect = {
  id: true,
  actorCodexUserId: true,
  action: true,
  targetType: true,
  targetId: true,
  outcome: true,
  metadata: true,
  ipHash: true,
  userAgentHash: true,
  createdAt: true,
} satisfies Prisma.AdminAuditLogSelect;

export async function getActiveAdminUserByCodexUserId(codexUserId: string) {
  try {
    const row = await getAdminOpsLedgerPrisma().adminUser.findUnique({
      where: { codexUserId },
    });

    return normalizeAdminUserAuthRecord(row);
  } catch (error) {
    const unavailableError = toAdminOpsLedgerUnavailableError(error);

    if (unavailableError) {
      throw unavailableError;
    }

    throw error;
  }
}

export async function touchAdminUserUnlockedAt(adminUserId: string) {
  await getAdminOpsLedgerPrisma().adminUser.update({
    where: { id: adminUserId },
    data: { lastUnlockedAt: new Date() },
  });
}

export async function getAdminUnlockRateLimit(codexUserId: string) {
  const windowStart = new Date(Date.now() - UNLOCK_WINDOW_MS);
  const failedAttempts = await getAdminOpsLedgerPrisma().adminUnlockAttempt.findMany({
    where: {
      codexUserId,
      success: false,
      createdAt: {
        gte: windowStart,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: MAX_UNLOCK_FAILURES,
  });

  if (failedAttempts.length < MAX_UNLOCK_FAILURES) {
    return {
      locked: false,
      remainingAttempts: MAX_UNLOCK_FAILURES - failedAttempts.length,
    };
  }

  const latestAttempt = failedAttempts[0];
  const lockExpiresAt = latestAttempt.createdAt.getTime() + UNLOCK_LOCK_MS;
  const now = Date.now();

  if (lockExpiresAt <= now) {
    return {
      locked: false,
      remainingAttempts: MAX_UNLOCK_FAILURES,
    };
  }

  return {
    locked: true,
    remainingAttempts: 0,
    retryAfterSeconds: Math.ceil((lockExpiresAt - now) / 1000),
  };
}

export async function recordAdminUnlockAttempt({
  adminUser,
  success,
  failureReason,
}: {
  adminUser: AdminUserAuthRecord;
  success: boolean;
  failureReason?: string;
}) {
  const auditContext = await getAdminRequestAuditContext();

  await getAdminOpsLedgerPrisma().adminUnlockAttempt.create({
    data: {
      adminUserId: adminUser.id,
      codexUserId: adminUser.codexUserId,
      email: adminUser.email,
      success,
      failureReason: failureReason ?? null,
      ...auditContext,
    },
  });
}

export async function writeAdminAuditLog({
  actor,
  action,
  targetType,
  targetId,
  outcome,
  metadata,
  requestContext,
}: {
  actor?: AdminAuditActor;
  action: string;
  targetType?: string;
  targetId?: string;
  outcome: 'success' | 'failure' | 'blocked' | 'started';
  metadata?: Record<string, unknown>;
  requestContext?: AdminRequestAuditContext;
}) {
  try {
    const resolvedRequestContext = requestContext ?? (await getAdminRequestAuditContext());

    await getAdminOpsLedgerPrisma().adminAuditLog.create({
      data: {
        actorAdminUserId: getActorAdminUserId(actor),
        actorCodexUserId: getActorCodexUserId(actor),
        action,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
        outcome,
        metadata: metadata ? toJsonObject(metadata) : undefined,
        ...resolvedRequestContext,
      },
    });
  } catch (error) {
    console.error('[AdminAuditLog] Failed to write admin audit log:', error);
  }
}

function getActorAdminUserId(actor: AdminAuditActor | undefined) {
  if (!actor) return null;

  return 'adminUserId' in actor ? actor.adminUserId : actor.id;
}

function getActorCodexUserId(actor: AdminAuditActor | undefined) {
  if (!actor) return null;

  return 'userID' in actor ? actor.userID : actor.codexUserId;
}

export async function listAdminUsersForDashboard(): Promise<AdminUserSummary[]> {
  const rows = await getAdminOpsLedgerPrisma().adminUser.findMany({
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 25,
    select: {
      id: true,
      codexUserId: true,
      email: true,
      displayName: true,
      role: true,
      scopes: true,
      status: true,
      lastUnlockedAt: true,
      updatedAt: true,
    },
  });

  return rows.map((row) => ({
    ...row,
    role: normalizeAdminRole(row.role),
    scopes: normalizeAdminScopes(row.scopes),
  }));
}

export async function getAdminOpsDashboardSummary(): Promise<AdminOpsDashboardSummary> {
  const recentAuditWindowHours = 24;
  const recentAuditSince = new Date(Date.now() - recentAuditWindowHours * 60 * 60 * 1000);
  const prisma = getAdminOpsLedgerPrisma();
  const [activeAdmins, disabledAdmins, recentAuditIssues] = await Promise.all([
    prisma.adminUser.count({ where: { status: 'active' } }),
    prisma.adminUser.count({ where: { status: 'disabled' } }),
    prisma.adminAuditLog.count({
      where: {
        createdAt: { gte: recentAuditSince },
        outcome: { in: ['failure', 'blocked'] },
      },
    }),
  ]);

  return {
    activeAdmins,
    disabledAdmins,
    recentAuditIssues,
    recentAuditWindowHours,
  };
}

export async function listAdminAuditLogsForDashboard({
  filters = {},
  skip = 0,
  take = 100,
}: {
  filters?: AdminAuditLogFilters;
  skip?: number;
  take?: number;
} = {}): Promise<AdminAuditLogSummary[]> {
  const rows = await getAdminOpsLedgerPrisma().adminAuditLog.findMany({
    where: buildAdminAuditLogWhere(filters),
    orderBy: {
      createdAt: 'desc',
    },
    skip: Math.max(skip, 0),
    take: Math.min(Math.max(take, 1), 250),
    select: adminAuditLogSummarySelect,
  });

  return rows;
}

export async function listAdminAuditLogsForExport({
  filters = {},
  take = 1000,
}: {
  filters?: AdminAuditLogFilters;
  take?: number;
} = {}): Promise<AdminAuditLogSummary[]> {
  return getAdminOpsLedgerPrisma().adminAuditLog.findMany({
    where: buildAdminAuditLogWhere(filters),
    orderBy: {
      createdAt: 'desc',
    },
    take: Math.min(Math.max(take, 1), 1000),
    select: adminAuditLogSummarySelect,
  });
}

export async function countAdminAuditLogsForDashboard({
  filters = {},
}: {
  filters?: AdminAuditLogFilters;
} = {}) {
  return getAdminOpsLedgerPrisma().adminAuditLog.count({
    where: buildAdminAuditLogWhere(filters),
  });
}

export async function deleteAdminAuditLogsByCreatedAtRange({ from, to }: AdminAuditLogDeleteRange) {
  const result = await getAdminOpsLedgerPrisma().adminAuditLog.deleteMany({
    where: {
      createdAt: {
        gte: from,
        lte: to,
      },
      action: {
        not: 'admin.audit_logs.cleared',
      },
    },
  });

  return result.count;
}

export async function upsertAdminUserFromDashboard({
  actor,
  input,
}: {
  actor: AdminWriteActor;
  input: AdminUserProvisionInput;
}) {
  const password = parseOptionalNewAdminPassword(input.password);
  const prisma = getAdminOpsLedgerPrisma();
  if (input.codexUserId === actor.userID || isMasterAdminRole(input.role))
    throw new AdminCredentialError('Use ownership transfer to change master access.', 400);
  if (
    !normalizeAdminRole(input.role) ||
    !input.scopes.length ||
    normalizeAdminScopes(input.scopes).length !== input.scopes.length ||
    !['active', 'disabled'].includes(input.status)
  )
    throw new AdminCredentialError('Check the admin role, permissions and status.', 400);

  const passwordHash =
    password !== null
      ? await withAdminCredentialWork(() => argon2.hash(password, { type: argon2.argon2id }))
      : undefined;
  const disabledAt = input.status === 'disabled' ? new Date() : null;
  const disabledReason =
    input.status === 'disabled' ? 'Disabled from admin access management.' : null;
  const requestContext = await getAdminRequestAuditContext();
  const select = {
    id: true,
    codexUserId: true,
    email: true,
    displayName: true,
    role: true,
    scopes: true,
    status: true,
    sessionVersion: true,
  } satisfies Prisma.AdminUserSelect;
  const data = {
    email: input.email,
    displayName: input.displayName,
    role: input.role,
    scopes: input.scopes,
    status: input.status,
    disabledAt,
    disabledReason,
    updatedByCodexUserId: actor.userID,
  };
  return prisma.$transaction(async (tx) => {
    await lockAdminUsersForWrite(tx, [actor.userID, input.codexUserId]);
    await requireCurrentMaster(tx, actor);
    const existing = await tx.adminUser.findUnique({ where: { codexUserId: input.codexUserId } });
    if (existing?.role === 'master_admin')
      throw new AdminCredentialError(
        'Use ownership transfer to change an existing master account.',
        400,
      );
    let adminUser;
    if (existing) {
      const changed = await tx.adminUser.updateMany({
        where: {
          id: existing.id,
          sessionVersion: existing.sessionVersion,
          role: { not: 'master_admin' },
        },
        data: {
          ...data,
          ...(passwordHash ? { passwordHash } : {}),
          sessionVersion: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new AdminCredentialError(
          'The target admin changed. Reload and review it again.',
          409,
        );
      await tx.adminMasterTransferChallenge.updateMany({
        where: {
          consumedAt: null,
          OR: [{ actorAdminUserId: existing.id }, { targetCodexUserId: input.codexUserId }],
        },
        data: { consumedAt: new Date() },
      });
      adminUser = await tx.adminUser.findUniqueOrThrow({ where: { id: existing.id }, select });
    } else {
      if (!passwordHash)
        throw new AdminCredentialError('A new admin user requires an unlock password.', 400);
      // A concurrent create must fail its unique constraint, never update the new account.
      adminUser = await tx.adminUser.create({
        data: {
          ...data,
          codexUserId: input.codexUserId,
          passwordHash,
          createdByCodexUserId: actor.userID,
        },
        select,
      });
      await tx.adminMasterTransferChallenge.updateMany({
        where: { consumedAt: null, targetCodexUserId: input.codexUserId },
        data: { consumedAt: new Date() },
      });
    }
    await tx.adminAuditLog.create({
      data: {
        actorAdminUserId: actor.adminUserId,
        actorCodexUserId: actor.userID,
        action: existing ? 'admin.user.updated' : 'admin.user.created',
        targetType: 'adminUser',
        targetId: adminUser.id,
        outcome: 'success',
        metadata: { ...adminUser, passwordChanged: Boolean(passwordHash) },
        ...requestContext,
      },
    });
    return { action: existing ? ('updated' as const) : ('created' as const), adminUser };
  });
}

function normalizeAdminUserAuthRecord(row: unknown): AdminUserAuthRecord | null {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const record = row as {
    id: string;
    codexUserId: string;
    email: string | null;
    displayName: string | null;
    passwordHash: string;
    role: string;
    scopes: string[];
    status: string;
    sessionVersion: number;
  };
  const role = normalizeAdminRole(record.role);
  const scopes = normalizeAdminScopes(record.scopes);

  if (!role || !scopes.length || !isActiveAdminStatus(record.status)) {
    return null;
  }

  return {
    id: record.id,
    codexUserId: record.codexUserId,
    email: record.email,
    displayName: record.displayName,
    passwordHash: record.passwordHash,
    role,
    scopes,
    status: 'active',
    sessionVersion: record.sessionVersion,
  };
}

function toJsonObject(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildAdminAuditLogWhere(filters: AdminAuditLogFilters) {
  const where: Prisma.AdminAuditLogWhereInput = {};
  const action = filters.action?.trim();
  const actorCodexUserId = filters.actorCodexUserId?.trim();
  const targetId = filters.targetId?.trim();
  const outcome = normalizeAuditOutcome(filters.outcome);
  const since = normalizeAuditSince(filters.since);

  if (action) {
    where.action = { contains: action.slice(0, 128) };
  }

  if (actorCodexUserId) {
    where.actorCodexUserId = actorCodexUserId.slice(0, 128);
  }

  if (targetId) {
    where.targetId = { contains: targetId.slice(0, 128) };
  }

  if (outcome) {
    where.outcome = outcome;
  }

  if (since === '24h') {
    where.createdAt = { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
  }

  return where;
}

function normalizeAuditOutcome(value: string | null | undefined) {
  const outcome = value?.trim();

  return ['success', 'failure', 'blocked', 'started'].includes(outcome ?? '') ? outcome : undefined;
}

function normalizeAuditSince(value: string | null | undefined) {
  return value?.trim() === '24h' ? '24h' : undefined;
}
