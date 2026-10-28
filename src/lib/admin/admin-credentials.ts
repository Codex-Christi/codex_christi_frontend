import 'server-only';

import argon2 from 'argon2';
import {
  getActiveAdminUserByCodexUserId,
  touchAdminUserUnlockedAt,
  writeAdminAuditLog,
} from './admin-auth-ledger';
import { buildAdminSessionCookie } from './admin-session-server';
import { getServerSessionState } from '../session/server-session';
import { requireAdminAction } from './require-admin';
import { getAdminOpsLedgerPrisma } from '../prisma/adminOpsLedger/adminOpsLedgerPrisma';
import { getAdminRequestAuditContext } from './admin-request-audit';
import { getEncodedAdminSessionSecret } from '../session/session-config';
import { parseNewAdminPassword } from '../formSchemas/admin-password';
import { AdminCredentialError } from './admin-credential-work';
import { verifyAdminPassword } from './admin-password-check';

export async function unlockAdmin(password: string) {
  getEncodedAdminSessionSecret();
  const primary = await getServerSessionState();
  if (!primary.isAuthenticated || !primary.userID)
    throw new AdminCredentialError('Sign in to the website again before unlocking admin.', 401);
  const admin = await getActiveAdminUserByCodexUserId(primary.userID);
  if (!admin) throw new AdminCredentialError('This account does not have admin access.', 403);
  await verifyAdminPassword(admin, password, 'unlock');
  const cookie = await buildAdminSessionCookie({
    userID: admin.codexUserId,
    role: admin.role,
    scopes: admin.scopes,
    sessionVersion: admin.sessionVersion,
  });
  await touchAdminUserUnlockedAt(admin.id);
  await writeAdminAuditLog({
    actor: admin,
    action: 'admin.unlock.success',
    targetType: 'adminUser',
    targetId: admin.id,
    outcome: 'success',
  });
  const current = await getActiveAdminUserByCodexUserId(admin.codexUserId);
  if (
    !current ||
    current.sessionVersion !== admin.sessionVersion ||
    current.passwordHash !== admin.passwordHash
  )
    throw new AdminCredentialError('Admin access changed. Unlock again.', 409);
  return cookie;
}

export async function changeAdminUnlockPassword(input: {
  currentPassword: string;
  password: string;
}) {
  const context = await requireAdminAction();
  const password = parseNewAdminPassword(input.password);
  const admin = await getActiveAdminUserByCodexUserId(context.userID);
  if (!admin || admin.id !== context.adminUserId || admin.sessionVersion !== context.sessionVersion)
    throw new AdminCredentialError('Admin access changed. Unlock again.', 409);
  await verifyAdminPassword(admin, input.currentPassword, 'password_change');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const auditContext = await getAdminRequestAuditContext();
  const now = new Date();
  // Hash before the short transaction; only the still-current account version may change.
  await getAdminOpsLedgerPrisma().$transaction(async (tx) => {
    const changed = await tx.adminUser.updateMany({
      where: {
        id: admin.id,
        codexUserId: context.userID,
        status: 'active',
        sessionVersion: context.sessionVersion,
        passwordHash: admin.passwordHash,
      },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
        updatedByCodexUserId: context.userID,
      },
    });
    if (changed.count !== 1)
      throw new AdminCredentialError('Admin access changed. Unlock again.', 409);
    await tx.adminMasterTransferChallenge.updateMany({
      where: { actorAdminUserId: admin.id, consumedAt: null },
      data: { consumedAt: now },
    });
    await tx.adminAuditLog.create({
      data: {
        actorAdminUserId: admin.id,
        actorCodexUserId: context.userID,
        action: 'admin.password.changed',
        targetType: 'adminUser',
        targetId: admin.id,
        outcome: 'success',
        metadata: { sessionVersion: context.sessionVersion + 1 },
        ...auditContext,
      },
    });
  });
}
