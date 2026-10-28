import 'server-only';

import { Prisma } from '../prisma/adminOpsLedger/generated/adminOpsLedger/client';
import { AdminCredentialError } from './admin-credential-work';
import { MASTER_ADMIN_ROLE } from './admin-config';

export type AdminWriteActor = {
  adminUserId: string;
  userID: string;
  sessionVersion: number;
};

export async function lockAdminUsersForWrite(tx: Prisma.TransactionClient, userIDs: string[]) {
  const ids = [...new Set(userIDs)].sort();
  if (!ids.length) throw new Error('Missing admin write target.');
  // Lock existing accounts in a stable order before touching their challenges.
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "AdminUser"
    WHERE "codexUserId" IN (${Prisma.join(ids)})
    ORDER BY "codexUserId" FOR UPDATE
  `);
}

export async function requireCurrentMaster(tx: Prisma.TransactionClient, actor: AdminWriteActor) {
  const source = await tx.adminUser.findUnique({ where: { codexUserId: actor.userID } });
  if (
    !source ||
    source.id !== actor.adminUserId ||
    source.status !== 'active' ||
    source.role !== MASTER_ADMIN_ROLE ||
    source.sessionVersion !== actor.sessionVersion
  )
    throw new AdminCredentialError('Admin access changed. Unlock again before continuing.', 409);
  return source;
}
