import argon2 from 'argon2';
import type {
  Prisma,
  PrismaClient,
} from '../prisma/adminOpsLedger/generated/adminOpsLedger/client';
import { parseNewAdminPassword } from '../formSchemas/admin-password';
import { getDefaultAdminRole, getDefaultAdminScopes } from './admin-config';

export type AdminRecoveryMode = 'create' | 'reset-password';

export class AdminRecoveryError extends Error {}

export const adminRecoverySummarySelect = {
  id: true,
  codexUserId: true,
  email: true,
  displayName: true,
  role: true,
  scopes: true,
  status: true,
  sessionVersion: true,
} satisfies Prisma.AdminUserSelect;

export const adminRecoverySnapshotSelect = {
  ...adminRecoverySummarySelect,
  passwordHash: true,
} satisfies Prisma.AdminUserSelect;

export type AdminRecoverySnapshot = Prisma.AdminUserGetPayload<{
  select: typeof adminRecoverySnapshotSelect;
}>;

export function assertAdminRecoveryTarget(
  mode: AdminRecoveryMode,
  existing: AdminRecoverySnapshot | null,
) {
  if (mode === 'create' && existing)
    throw new AdminRecoveryError(
      'This admin already exists. Use reset-password to change only its password.',
    );
  if (mode === 'reset-password' && !existing)
    throw new AdminRecoveryError(
      'This admin does not exist. Reset never creates or promotes an account.',
    );
}

// No server action: only the VPS maintenance CLI imports this mutation helper.
export async function recoverAdminAccess({
  prisma,
  mode,
  environment,
  codexUserId,
  expected,
  password,
}: {
  prisma: PrismaClient;
  mode: AdminRecoveryMode;
  environment: 'production' | 'development';
  codexUserId: string;
  expected: AdminRecoverySnapshot | null;
  password: string;
}) {
  assertAdminRecoveryTarget(mode, expected);
  if (expected && expected.codexUserId !== codexUserId)
    throw new AdminRecoveryError('Admin preview mismatch.');
  const passwordHash = await argon2.hash(parseNewAdminPassword(password), {
    type: argon2.argon2id,
  });
  const actor = 'emergency_admin_cli';
  return prisma.$transaction(async (tx) => {
    let admin;
    if (mode === 'create') {
      // A unique-key conflict must fail, never turn creation into a reset.
      admin = await tx.adminUser.create({
        data: {
          codexUserId,
          passwordHash,
          role: getDefaultAdminRole(),
          scopes: getDefaultAdminScopes(),
          status: 'active',
          createdByCodexUserId: actor,
          updatedByCodexUserId: actor,
        },
        select: adminRecoverySummarySelect,
      });
    } else {
      if (!expected) throw new AdminRecoveryError('Admin preview is missing.');
      const changed = await tx.adminUser.updateMany({
        where: {
          id: expected.id,
          codexUserId,
          sessionVersion: expected.sessionVersion,
          passwordHash: expected.passwordHash,
          role: expected.role,
          status: expected.status,
        },
        data: {
          passwordHash,
          sessionVersion: { increment: 1 },
          updatedByCodexUserId: actor,
        },
      });
      if (changed.count !== 1)
        throw new AdminRecoveryError(
          'The admin changed after preview. Start again and review its current state.',
        );
      await tx.adminMasterTransferChallenge.updateMany({
        where: {
          consumedAt: null,
          OR: [{ actorAdminUserId: expected.id }, { targetCodexUserId: codexUserId }],
        },
        data: { consumedAt: new Date() },
      });
      admin = await tx.adminUser.findUniqueOrThrow({
        where: { id: expected.id },
        select: adminRecoverySummarySelect,
      });
    }
    await tx.adminAuditLog.create({
      data: {
        actorCodexUserId: actor,
        action: mode === 'create' ? 'admin.emergency.created' : 'admin.emergency.password_reset',
        targetType: 'adminUser',
        targetId: admin.id,
        outcome: 'success',
        metadata: { environment, sessionVersion: admin.sessionVersion },
      },
    });
    return admin;
  });
}
