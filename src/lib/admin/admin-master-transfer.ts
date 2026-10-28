import 'server-only';

import crypto from 'node:crypto';
import argon2 from 'argon2';
import type {
  AdminMasterTransferChallenge,
  AdminUser,
  Prisma,
} from '../prisma/adminOpsLedger/generated/adminOpsLedger/client';
import { getAdminOpsLedgerPrisma } from '../prisma/adminOpsLedger/adminOpsLedgerPrisma';
import { getDefaultAdminScopes, isMasterAdminRole, MASTER_ADMIN_ROLE } from './admin-config';
import { getActiveAdminUserByCodexUserId, writeAdminAuditLog } from './admin-auth-ledger';
import { AdminCredentialError, withAdminCredentialWork } from './admin-credential-work';
import { verifyAdminPassword } from './admin-password-check';
import {
  lockAdminUsersForWrite,
  requireCurrentMaster,
  type AdminWriteActor,
} from './admin-write-guards';
import { getAdminRequestAuditContext } from './admin-request-audit';
import { buildAdminMasterTransferOtpEmailHtml } from './admin-master-transfer-email';
import { requireCodexChristiUserProfilePreview } from './codex-christi-user-profile';
import {
  adminTransferAcceptanceSchema,
  adminTransferIdSchema,
  adminTransferStartSchema,
} from '../formSchemas/admin-transfer';
import { getEncodedAdminSessionSecret } from '../session/session-config';
import { getMainSiteBaseUrl } from '../siteBaseUrls';
import { buildAdminTransferAcceptancePath } from './admin-paths';
import type { z } from 'zod';

const INVITATION_VERSION = 2;
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const SEND_WINDOW_MS = 15 * 60_000;
const SEND_COOLDOWN_MS = 60_000;
const MAX_SENDS = 3;

type ActiveInvitation = AdminMasterTransferChallenge & {
  actorAdminUserId: string;
  sourceSessionVersion: number;
};
export type MasterTransferChallengeSummary = {
  challengeId: string;
  targetCodexUserId: string;
  targetEmailHint: string;
  expiresAt: Date;
};

function unavailableInvitation() {
  return new AdminCredentialError(
    'This invitation is unavailable. Check the account, code and expiry, or ask for a new invitation.',
    400,
  );
}

function isActiveInvitation(
  invite: AdminMasterTransferChallenge | null,
): invite is ActiveInvitation {
  return Boolean(
    invite &&
    invite.acceptanceVersion === INVITATION_VERSION &&
    invite.targetPasswordHash === null &&
    invite.actorAdminUserId &&
    invite.sourceSessionVersion &&
    invite.sourceSessionVersion > 0 &&
    invite.actorCodexUserId !== invite.targetCodexUserId &&
    !invite.consumedAt &&
    invite.expiresAt > new Date() &&
    invite.attemptCount < MAX_OTP_ATTEMPTS,
  );
}

function checkTarget(invite: ActiveInvitation, target: AdminUser | null) {
  if (invite.targetAdminUserId === null && invite.targetAdminSessionVersion === null && !target)
    return;
  if (
    !target ||
    target.id !== invite.targetAdminUserId ||
    target.sessionVersion !== invite.targetAdminSessionVersion ||
    target.status !== 'active' ||
    target.role === MASTER_ADMIN_ROLE
  )
    throw unavailableInvitation();
}

function hashOtp(otp: string) {
  return crypto.createHmac('sha256', getEncodedAdminSessionSecret()).update(otp).digest('hex');
}

function matchesOtp(invite: ActiveInvitation, otp: string) {
  const expected = Buffer.from(invite.otpHash, 'hex');
  const candidate = Buffer.from(hashOtp(otp), 'hex');
  return expected.length === candidate.length && crypto.timingSafeEqual(expected, candidate);
}

function summary(
  invite: Pick<
    AdminMasterTransferChallenge,
    'id' | 'targetCodexUserId' | 'targetEmail' | 'expiresAt'
  >,
): MasterTransferChallengeSummary {
  const [local, domain] = invite.targetEmail.split('@');
  return {
    challengeId: invite.id,
    targetCodexUserId: invite.targetCodexUserId,
    targetEmailHint: `${local.slice(0, 2)}***@${domain}`,
    expiresAt: invite.expiresAt,
  };
}

async function checkSendLimit(
  tx: Pick<Prisma.TransactionClient, 'adminMasterTransferChallenge'>,
  sourceId: string,
) {
  const recent = await tx.adminMasterTransferChallenge.findMany({
    where: { actorAdminUserId: sourceId, createdAt: { gt: new Date(Date.now() - SEND_WINDOW_MS) } },
    orderBy: { createdAt: 'desc' },
    take: MAX_SENDS,
    select: { createdAt: true },
  });
  if (
    recent.length >= MAX_SENDS ||
    (recent[0] && recent[0].createdAt.getTime() > Date.now() - SEND_COOLDOWN_MS)
  )
    throw new AdminCredentialError(
      'Wait before sending another invitation. At most three are allowed in 15 minutes, at least one minute apart.',
      429,
    );
}

function invitationUrl(id: string) {
  const url = new URL(buildAdminTransferAcceptancePath(id), getMainSiteBaseUrl());
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
  )
    throw new Error('Invalid admin invitation site configuration.');
  return url.toString();
}

export async function startMasterAdminTransfer({
  actor,
  ...input
}: {
  actor: AdminWriteActor;
  currentAdminPassword: string;
  targetCodexUserId: string;
  targetEmail: string;
}): Promise<MasterTransferChallengeSummary> {
  const parsed = adminTransferStartSchema.parse(input);
  if (parsed.targetCodexUserId === actor.userID)
    throw new AdminCredentialError('Choose a different target account.', 400);
  const source = await getActiveAdminUserByCodexUserId(actor.userID);
  if (
    !source ||
    source.id !== actor.adminUserId ||
    source.sessionVersion !== actor.sessionVersion ||
    !isMasterAdminRole(source.role)
  )
    throw new AdminCredentialError('Master admin authorization required.', 403);
  await withAdminCredentialWork(() =>
    verifyAdminPassword(source, parsed.currentAdminPassword, 'master_transfer'),
  );
  const prisma = getAdminOpsLedgerPrisma();
  await checkSendLimit(prisma, source.id);
  await requireCodexChristiUserProfilePreview({ userId: parsed.targetCodexUserId });
  invitationUrl('configuration-check');
  const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const otpHash = hashOtp(otp);
  const auditContext = await getAdminRequestAuditContext();
  const invite = await prisma.$transaction(async (tx) => {
    await lockAdminUsersForWrite(tx, [actor.userID, parsed.targetCodexUserId]);
    const current = await requireCurrentMaster(tx, actor);
    if (current.passwordHash !== source.passwordHash)
      throw new AdminCredentialError('Admin access changed. Unlock again.', 409);
    const target = await tx.adminUser.findUnique({
      where: { codexUserId: parsed.targetCodexUserId },
    });
    if (target && (target.status !== 'active' || target.role === MASTER_ADMIN_ROLE))
      throw new AdminCredentialError(
        'Choose an active non-master account, or a user without admin access.',
        400,
      );
    await checkSendLimit(tx, source.id);
    await tx.adminMasterTransferChallenge.updateMany({
      where: { actorAdminUserId: source.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const created = await tx.adminMasterTransferChallenge.create({
      data: {
        actorAdminUserId: source.id,
        actorCodexUserId: actor.userID,
        targetCodexUserId: parsed.targetCodexUserId,
        targetEmail: parsed.targetEmail.toLowerCase(),
        targetPasswordHash: null,
        acceptanceVersion: INVITATION_VERSION,
        sourceSessionVersion: current.sessionVersion,
        targetAdminUserId: target?.id ?? null,
        targetAdminSessionVersion: target?.sessionVersion ?? null,
        otpHash,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000),
      },
    });
    await tx.adminAuditLog.create({
      data: {
        actorAdminUserId: source.id,
        actorCodexUserId: actor.userID,
        action: 'admin.master_transfer.invited',
        targetType: 'adminUser',
        targetId: parsed.targetCodexUserId,
        outcome: 'success',
        metadata: { challengeId: created.id, sourceSessionVersion: current.sessionVersion },
        ...auditContext,
      },
    });
    return created;
  });
  try {
    const { sendMailFromPrimaryAgent } = await import('../zeptomail/sendMailFromPrimaryAgent');
    await sendMailFromPrimaryAgent({
      emailReceipents: [
        { email_address: { address: invite.targetEmail, name: invite.targetEmail.split('@')[0] } },
      ],
      subject: 'Accept your Codex Christi admin ownership invitation',
      htmlbody: buildAdminMasterTransferOtpEmailHtml({
        otp,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
        acceptanceUrl: invitationUrl(invite.id),
      }),
    });
  } catch {
    await prisma.adminMasterTransferChallenge.updateMany({
      where: { id: invite.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await writeAdminAuditLog({
      actor,
      action: 'admin.master_transfer.delivery_unconfirmed',
      targetType: 'adminUser',
      targetId: parsed.targetCodexUserId,
      outcome: 'failure',
      metadata: { challengeId: invite.id },
      requestContext: auditContext,
    });
    throw new AdminCredentialError(
      'Invitation delivery could not be confirmed. Check the recipient before requesting another invitation.',
      503,
    );
  }
  return summary(invite);
}

export async function getRecipientTransferInvitation(challengeId: string, recipientUserId: string) {
  if (!adminTransferIdSchema.safeParse(challengeId).success) return null;
  const prisma = getAdminOpsLedgerPrisma();
  const invite = await prisma.adminMasterTransferChallenge.findUnique({
    where: { id: challengeId },
  });
  if (!isActiveInvitation(invite) || invite.targetCodexUserId !== recipientUserId) return null;
  const source = await prisma.adminUser.findUnique({ where: { id: invite.actorAdminUserId } });
  if (
    !source ||
    source.codexUserId !== invite.actorCodexUserId ||
    source.role !== MASTER_ADMIN_ROLE ||
    source.status !== 'active' ||
    source.sessionVersion !== invite.sourceSessionVersion
  )
    return null;
  const target = await prisma.adminUser.findUnique({ where: { codexUserId: recipientUserId } });
  try {
    checkTarget(invite, target);
  } catch {
    return null;
  }
  return summary(invite);
}

async function lockedInvitation(
  tx: Prisma.TransactionClient,
  initial: ActiveInvitation,
  recipientUserId: string,
) {
  await lockAdminUsersForWrite(tx, [initial.actorCodexUserId, recipientUserId]);
  const invite = await tx.adminMasterTransferChallenge.findUnique({ where: { id: initial.id } });
  if (
    !isActiveInvitation(invite) ||
    invite.targetCodexUserId !== recipientUserId ||
    invite.actorAdminUserId !== initial.actorAdminUserId ||
    invite.actorCodexUserId !== initial.actorCodexUserId
  )
    throw unavailableInvitation();
  const source = await requireCurrentMaster(tx, {
    adminUserId: invite.actorAdminUserId,
    userID: invite.actorCodexUserId,
    sessionVersion: invite.sourceSessionVersion,
  });
  const target = await tx.adminUser.findUnique({ where: { codexUserId: recipientUserId } });
  checkTarget(invite, target);
  return { invite, source, target };
}

export async function acceptMasterAdminTransfer({
  recipientUserId,
  input,
}: {
  recipientUserId: string;
  input: z.infer<typeof adminTransferAcceptanceSchema>;
}) {
  const parsed = adminTransferAcceptanceSchema.parse(input);
  const prisma = getAdminOpsLedgerPrisma();
  const initial = await prisma.adminMasterTransferChallenge.findUnique({
    where: { id: parsed.challengeId },
  });
  if (!isActiveInvitation(initial) || initial.targetCodexUserId !== recipientUserId)
    throw unavailableInvitation();
  const auditContext = await getAdminRequestAuditContext();
  if (!matchesOtp(initial, parsed.otp)) {
    // Commit failed guesses; throwing inside this transaction would undo the counter.
    await prisma.$transaction(async (tx) => {
      const { invite, target } = await lockedInvitation(tx, initial, recipientUserId);
      await tx.adminMasterTransferChallenge.updateMany({
        where: { id: invite.id, consumedAt: null, attemptCount: { lt: MAX_OTP_ATTEMPTS } },
        data: {
          attemptCount: { increment: 1 },
          ...(invite.attemptCount + 1 >= MAX_OTP_ATTEMPTS ? { consumedAt: new Date() } : {}),
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorAdminUserId: target?.id ?? null,
          actorCodexUserId: recipientUserId,
          action: 'admin.master_transfer.code_failed',
          targetType: 'adminTransfer',
          targetId: invite.id,
          outcome: 'failure',
          ...auditContext,
        },
      });
    });
    throw unavailableInvitation();
  }
  const passwordHash = await argon2.hash(parsed.password, { type: argon2.argon2id });
  return prisma.$transaction(async (tx) => {
    const { invite, source, target } = await lockedInvitation(tx, initial, recipientUserId);
    if (!matchesOtp(invite, parsed.otp)) throw unavailableInvitation();
    const now = new Date();
    const claimed = await tx.adminMasterTransferChallenge.updateMany({
      where: {
        id: invite.id,
        acceptanceVersion: INVITATION_VERSION,
        consumedAt: null,
        targetCodexUserId: recipientUserId,
        sourceSessionVersion: source.sessionVersion,
        expiresAt: { gt: now },
        attemptCount: { lt: MAX_OTP_ATTEMPTS },
        otpHash: invite.otpHash,
      },
      data: { consumedAt: now },
    });
    if (claimed.count !== 1) throw unavailableInvitation();
    const revoked = await tx.adminUser.updateMany({
      where: {
        id: source.id,
        role: MASTER_ADMIN_ROLE,
        status: 'active',
        sessionVersion: invite.sourceSessionVersion,
      },
      data: {
        status: 'disabled',
        disabledAt: now,
        disabledReason: `Ownership transferred to ${recipientUserId}.`,
        sessionVersion: { increment: 1 },
        updatedByCodexUserId: recipientUserId,
      },
    });
    if (revoked.count !== 1) throw unavailableInvitation();
    const data = {
      passwordHash,
      role: MASTER_ADMIN_ROLE,
      scopes: getDefaultAdminScopes(),
      updatedByCodexUserId: recipientUserId,
    };
    let accepted;
    const select = { id: true, codexUserId: true, sessionVersion: true } as const;
    if (target) {
      const changed = await tx.adminUser.updateMany({
        where: {
          id: target.id,
          sessionVersion: invite.targetAdminSessionVersion!,
          status: 'active',
          role: { not: MASTER_ADMIN_ROLE },
        },
        data: { ...data, sessionVersion: { increment: 1 } },
      });
      if (changed.count !== 1) throw unavailableInvitation();
      accepted = await tx.adminUser.findUniqueOrThrow({ where: { id: target.id }, select });
    } else {
      accepted = await tx.adminUser.create({
        data: {
          ...data,
          codexUserId: recipientUserId,
          status: 'active',
          createdByCodexUserId: source.codexUserId,
        },
        select,
      });
    }
    await tx.adminMasterTransferChallenge.updateMany({
      where: {
        consumedAt: null,
        OR: [
          { actorAdminUserId: { in: [source.id, accepted.id] } },
          { targetCodexUserId: { in: [source.codexUserId, recipientUserId] } },
        ],
      },
      data: { consumedAt: now },
    });
    await tx.adminAuditLog.create({
      data: {
        actorAdminUserId: accepted.id,
        actorCodexUserId: recipientUserId,
        action: 'admin.master_transfer.accepted',
        targetType: 'adminUser',
        targetId: accepted.id,
        outcome: 'success',
        metadata: {
          challengeId: invite.id,
          previousMasterCodexUserId: source.codexUserId,
          sourceSessionVersion: invite.sourceSessionVersion,
          targetSessionVersion: accepted.sessionVersion,
        },
        ...auditContext,
      },
    });
    return accepted;
  });
}

export async function cancelMasterAdminTransfer(actor: AdminWriteActor, challengeId: string) {
  adminTransferIdSchema.parse(challengeId);
  const prisma = getAdminOpsLedgerPrisma();
  const initial = await prisma.adminMasterTransferChallenge.findUnique({
    where: { id: challengeId },
  });
  if (
    !isActiveInvitation(initial) ||
    initial.actorAdminUserId !== actor.adminUserId ||
    initial.actorCodexUserId !== actor.userID
  )
    throw unavailableInvitation();
  const context = await getAdminRequestAuditContext();
  await prisma.$transaction(async (tx) => {
    await lockAdminUsersForWrite(tx, [actor.userID, initial.targetCodexUserId]);
    await requireCurrentMaster(tx, actor);
    const changed = await tx.adminMasterTransferChallenge.updateMany({
      where: {
        id: challengeId,
        actorAdminUserId: actor.adminUserId,
        acceptanceVersion: INVITATION_VERSION,
        sourceSessionVersion: actor.sessionVersion,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    if (changed.count !== 1) throw unavailableInvitation();
    await tx.adminAuditLog.create({
      data: {
        actorAdminUserId: actor.adminUserId,
        actorCodexUserId: actor.userID,
        action: 'admin.master_transfer.cancelled',
        targetType: 'adminTransfer',
        targetId: challengeId,
        outcome: 'success',
        ...context,
      },
    });
  });
}
