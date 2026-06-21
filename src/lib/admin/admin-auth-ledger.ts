import 'server-only';

import argon2 from 'argon2';
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
  | Pick<AdminUserAuthRecord, 'id' | 'codexUserId'>
  | { adminUserId: string; userID: string }
  | null;

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
  const row = await getAdminOpsLedgerPrisma().adminUser.findUnique({
    where: { codexUserId },
  });

  return normalizeAdminUserAuthRecord(row);
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
  actor: Exclude<AdminAuditActor, null>;
  input: AdminUserProvisionInput;
}) {
  const prisma = getAdminOpsLedgerPrisma();
  const existing = await prisma.adminUser.findUnique({
    where: { codexUserId: input.codexUserId },
    select: {
      id: true,
    },
  });

  if (!existing && !input.password) {
    throw new Error('A new admin user requires an unlock password.');
  }

  if (isMasterAdminRole(input.role)) {
    throw new Error('The master admin user must be managed by the master-admin creation script.');
  }

  const passwordHash = input.password
    ? await argon2.hash(input.password, { type: argon2.argon2id })
    : undefined;
  const disabledAt = input.status === 'disabled' ? new Date() : null;
  const disabledReason =
    input.status === 'disabled' ? 'Disabled from admin access management.' : null;
  const actorCodexUserId = getActorCodexUserId(actor);
  const adminUser = await prisma.adminUser.upsert({
    where: {
      codexUserId: input.codexUserId,
    },
    create: {
      codexUserId: input.codexUserId,
      email: input.email,
      displayName: input.displayName,
      passwordHash: passwordHash as string,
      role: input.role,
      scopes: input.scopes,
      status: input.status,
      disabledAt,
      disabledReason,
      createdByCodexUserId: actorCodexUserId,
      updatedByCodexUserId: actorCodexUserId,
    },
    update: {
      email: input.email,
      displayName: input.displayName,
      ...(passwordHash ? { passwordHash } : {}),
      role: input.role,
      scopes: input.scopes,
      status: input.status,
      disabledAt,
      disabledReason,
      sessionVersion: {
        increment: 1,
      },
      updatedByCodexUserId: actorCodexUserId,
    },
    select: {
      id: true,
      codexUserId: true,
      email: true,
      displayName: true,
      role: true,
      scopes: true,
      status: true,
      sessionVersion: true,
    },
  });

  await writeAdminAuditLog({
    actor,
    action: existing ? 'admin.user.updated' : 'admin.user.created',
    targetType: 'adminUser',
    targetId: adminUser.id,
    outcome: 'success',
    metadata: {
      codexUserId: adminUser.codexUserId,
      email: adminUser.email,
      displayName: adminUser.displayName,
      role: adminUser.role,
      scopes: adminUser.scopes,
      status: adminUser.status,
      sessionVersion: adminUser.sessionVersion,
      passwordChanged: Boolean(passwordHash),
    },
  });

  return {
    action: existing ? 'updated' : 'created',
    adminUser,
  } as const;
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
