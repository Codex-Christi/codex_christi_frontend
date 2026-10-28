import 'server-only';

import crypto from 'node:crypto';
import argon2 from 'argon2';
import { getAdminOpsLedgerPrisma } from '@/lib/prisma/adminOpsLedger/adminOpsLedgerPrisma';
import { sendMailFromPrimaryAgent } from '@/lib/zeptomail/sendMailFromPrimaryAgent';
import {
  getAdminSessionSecret,
  getDefaultAdminScopes,
  isMasterAdminRole,
  MASTER_ADMIN_ROLE,
} from './admin-config';
import { getActiveAdminUserByCodexUserId, writeAdminAuditLog } from './admin-auth-ledger';
import { getAdminRequestAuditContext } from './admin-request-audit';
import { buildAdminMasterTransferOtpEmailHtml } from './admin-master-transfer-email';
import { requireCodexChristiUserProfilePreview } from './codex-christi-user-profile';
import { parseNewAdminPassword } from '../formSchemas/admin-password';
import { AdminCredentialError, withAdminCredentialWork } from './admin-credential-work';
import { verifyAdminPassword } from './admin-password-check';
import type { Prisma } from '../prisma/adminOpsLedger/generated/adminOpsLedger/client';

const MASTER_TRANSFER_OTP_EXPIRY_MINUTES = 10;
const MAX_MASTER_TRANSFER_OTP_ATTEMPTS = 5;
const TRANSFER_SEND_WINDOW_MS = 15 * 60_000;
const TRANSFER_SEND_COOLDOWN_MS = 60_000;
const MAX_TRANSFER_SENDS = 3;

async function checkTransferSendLimit(
  prisma: Pick<Prisma.TransactionClient, 'adminMasterTransferChallenge'>,
  actorAdminUserId: string,
) {
  const recent = await prisma.adminMasterTransferChallenge.findMany({
    where: {
      actorAdminUserId,
      createdAt: { gt: new Date(Date.now() - TRANSFER_SEND_WINDOW_MS) },
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_TRANSFER_SENDS,
    select: { createdAt: true },
  });
  if (
    recent.length >= MAX_TRANSFER_SENDS ||
    (recent[0] && recent[0].createdAt.getTime() > Date.now() - TRANSFER_SEND_COOLDOWN_MS)
  )
    throw new AdminCredentialError(
      'A transfer was started recently. Wait before requesting another code; at most three are allowed in 15 minutes.',
      429,
    );
}

type MasterTransferActor = {
  adminUserId: string;
  userID: string;
  sessionVersion: number;
};

export type MasterTransferChallengeSummary = {
  challengeId: string;
  targetCodexUserId: string;
  targetEmailHint: string;
  expiresAt: Date;
};

export async function startMasterAdminTransfer({
  actor,
  currentAdminPassword,
  targetCodexUserId,
  targetEmail,
  targetAdminPassword,
}: {
  actor: MasterTransferActor;
  currentAdminPassword: string;
  targetCodexUserId: string;
  targetEmail: string;
  targetAdminPassword: string;
}): Promise<MasterTransferChallengeSummary> {
  const password = parseNewAdminPassword(targetAdminPassword);
  const normalizedTargetCodexUserId = targetCodexUserId.trim();
  const normalizedTargetEmail = normalizeAdminTransferEmail(targetEmail);

  if (!normalizedTargetCodexUserId) {
    throw new Error('Enter the target Codex Christi user ID.');
  }

  if (normalizedTargetCodexUserId === actor.userID) {
    throw new Error('Choose a different target Codex Christi user ID.');
  }

  if (!isValidEmail(normalizedTargetEmail)) {
    throw new Error('Enter a valid target email.');
  }

  const actorAdmin = await getActiveAdminUserByCodexUserId(actor.userID);

  if (
    !actorAdmin ||
    actorAdmin.id !== actor.adminUserId ||
    actorAdmin.sessionVersion !== actor.sessionVersion ||
    !isMasterAdminRole(actorAdmin.role)
  ) {
    throw new Error('Master admin authorization required.');
  }

  await withAdminCredentialWork(() =>
    verifyAdminPassword(actorAdmin, currentAdminPassword, 'master_transfer'),
  );
  const prisma = getAdminOpsLedgerPrisma();
  await checkTransferSendLimit(prisma, actor.adminUserId);

  const targetProfile = await requireCodexChristiUserProfilePreview({
    userId: normalizedTargetCodexUserId,
  });

  const otp = createAdminTransferOtp();
  const otpHash = hashAdminTransferOtp(otp);
  const targetPasswordHash = await withAdminCredentialWork(() =>
    argon2.hash(password, { type: argon2.argon2id }),
  );
  const expiresAt = new Date(Date.now() + MASTER_TRANSFER_OTP_EXPIRY_MINUTES * 60_000);

  const challenge = await prisma.$transaction(async (tx) => {
    // Lock the source row before its challenges, matching password-change lock order.
    const current = await tx.adminUser.updateMany({
      where: activeMasterWhere(actor),
      data: { updatedAt: new Date() },
    });
    if (current.count !== 1)
      throw new Error('Admin access changed. Unlock again before starting a transfer.');
    // The source-row lock serializes this check with concurrent starts.
    await checkTransferSendLimit(tx, actor.adminUserId);
    await tx.adminMasterTransferChallenge.updateMany({
      where: { actorAdminUserId: actor.adminUserId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return tx.adminMasterTransferChallenge.create({
      data: {
        actorAdminUserId: actor.adminUserId,
        actorCodexUserId: actor.userID,
        targetCodexUserId: normalizedTargetCodexUserId,
        targetEmail: normalizedTargetEmail,
        targetPasswordHash,
        otpHash,
        expiresAt,
      },
      select: {
        id: true,
        targetCodexUserId: true,
        targetEmail: true,
        expiresAt: true,
      },
    });
  });

  try {
    await sendMailFromPrimaryAgent({
      emailReceipents: [
        {
          email_address: {
            address: normalizedTargetEmail,
            name: normalizedTargetEmail.split('@')[0],
          },
        },
      ],
      subject: 'Your Codex Christi master admin transfer code',
      htmlbody: buildAdminMasterTransferOtpEmailHtml({
        otp,
        expiresInMinutes: MASTER_TRANSFER_OTP_EXPIRY_MINUTES,
      }),
    });
  } catch (error) {
    await prisma.adminMasterTransferChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    await writeAdminAuditLog({
      actor,
      action: 'admin.master_transfer.otp_send_failed',
      targetType: 'adminUser',
      targetId: normalizedTargetCodexUserId,
      outcome: 'failure',
      metadata: {
        targetEmail: normalizedTargetEmail,
        reason: error instanceof Error ? error.message : 'email_send_failed',
      },
    });

    throw new Error('Unable to send the transfer code.');
  }

  await writeAdminAuditLog({
    actor,
    action: 'admin.master_transfer.otp_sent',
    targetType: 'adminUser',
    targetId: normalizedTargetCodexUserId,
    outcome: 'success',
    metadata: {
      targetEmail: normalizedTargetEmail,
      targetDisplayName: targetProfile.displayName,
      targetUsername: targetProfile.username,
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt.toISOString(),
    },
  });

  return {
    challengeId: challenge.id,
    targetCodexUserId: challenge.targetCodexUserId,
    targetEmailHint: maskEmail(challenge.targetEmail),
    expiresAt: challenge.expiresAt,
  };
}

export async function completeMasterAdminTransfer({
  actor,
  challengeId,
  otp,
}: {
  actor: MasterTransferActor;
  challengeId: string;
  otp: string;
}) {
  const prisma = getAdminOpsLedgerPrisma();
  const challenge = await prisma.adminMasterTransferChallenge.findUnique({
    where: {
      id: challengeId,
    },
  });

  if (
    !challenge ||
    challenge.actorAdminUserId !== actor.adminUserId ||
    challenge.actorCodexUserId !== actor.userID ||
    challenge.consumedAt ||
    challenge.expiresAt <= new Date()
  ) {
    throw new Error('This transfer code is expired or invalid.');
  }

  if (challenge.attemptCount >= MAX_MASTER_TRANSFER_OTP_ATTEMPTS) {
    await prisma.adminMasterTransferChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    throw new Error('Too many incorrect attempts. Start a new transfer.');
  }

  if (challenge.otpHash !== hashAdminTransferOtp(otp)) {
    const nextAttemptCount = challenge.attemptCount + 1;

    await prisma.adminMasterTransferChallenge.update({
      where: { id: challenge.id },
      data: {
        attemptCount: {
          increment: 1,
        },
        consumedAt: nextAttemptCount >= MAX_MASTER_TRANSFER_OTP_ATTEMPTS ? new Date() : undefined,
      },
    });

    throw new Error(
      nextAttemptCount >= MAX_MASTER_TRANSFER_OTP_ATTEMPTS
        ? 'Too many incorrect attempts. Start a new transfer.'
        : 'Invalid transfer code.',
    );
  }

  const now = new Date();

  const auditContext = await getAdminRequestAuditContext();
  return prisma.$transaction(async (tx) => {
    const source = await tx.adminUser.updateMany({
      where: activeMasterWhere(actor),
      data: {
        status: 'disabled',
        disabledAt: now,
        disabledReason: `Master admin transferred to ${challenge.targetCodexUserId}.`,
        sessionVersion: { increment: 1 },
        updatedByCodexUserId: actor.userID,
      },
    });
    if (source.count !== 1)
      throw new Error('Admin access changed. Unlock again before completing a transfer.');
    const claimed = await tx.adminMasterTransferChallenge.updateMany({
      where: {
        id: challenge.id,
        actorAdminUserId: actor.adminUserId,
        actorCodexUserId: actor.userID,
        consumedAt: null,
        expiresAt: { gt: now },
        attemptCount: { lt: MAX_MASTER_TRANSFER_OTP_ATTEMPTS },
        otpHash: challenge.otpHash,
      },
      data: { consumedAt: now },
    });
    if (claimed.count !== 1) throw new Error('This transfer code is expired or already used.');
    const targetAdmin = await tx.adminUser.upsert({
      where: {
        codexUserId: challenge.targetCodexUserId,
      },
      create: {
        codexUserId: challenge.targetCodexUserId,
        email: null,
        displayName: null,
        passwordHash: challenge.targetPasswordHash,
        role: MASTER_ADMIN_ROLE,
        scopes: getDefaultAdminScopes(),
        status: 'active',
        createdByCodexUserId: actor.userID,
        updatedByCodexUserId: actor.userID,
      },
      update: {
        email: null,
        displayName: null,
        passwordHash: challenge.targetPasswordHash,
        role: MASTER_ADMIN_ROLE,
        scopes: getDefaultAdminScopes(),
        status: 'active',
        disabledAt: null,
        disabledReason: null,
        sessionVersion: {
          increment: 1,
        },
        updatedByCodexUserId: actor.userID,
      },
      select: {
        id: true,
        codexUserId: true,
        sessionVersion: true,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        actorAdminUserId: actor.adminUserId,
        actorCodexUserId: actor.userID,
        action: 'admin.master_transfer.completed',
        targetType: 'adminUser',
        targetId: targetAdmin.id,
        outcome: 'success',
        metadata: {
          targetCodexUserId: targetAdmin.codexUserId,
          targetSessionVersion: targetAdmin.sessionVersion,
          previousMasterCodexUserId: actor.userID,
        },
        ...auditContext,
      },
    });
    return targetAdmin;
  });
}

function activeMasterWhere(actor: MasterTransferActor) {
  return {
    id: actor.adminUserId,
    codexUserId: actor.userID,
    role: MASTER_ADMIN_ROLE,
    status: 'active',
    sessionVersion: actor.sessionVersion,
  };
}

function createAdminTransferOtp(length = 6) {
  const max = 10 ** length;
  return crypto.randomInt(0, max).toString().padStart(length, '0');
}

function hashAdminTransferOtp(otp: string) {
  const secret = getAdminSessionSecret();

  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET is not configured.');
  }

  return crypto.createHmac('sha256', secret).update(otp).digest('hex');
}

function normalizeAdminTransferEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function maskEmail(email: string) {
  const [localPart, domain] = email.split('@');

  if (!localPart || !domain) {
    return email;
  }

  const visiblePrefix = localPart.slice(0, 2);
  const visibleSuffix = localPart.length > 4 ? localPart.slice(-1) : '';

  return `${visiblePrefix}${'*'.repeat(Math.max(2, localPart.length - 3))}${visibleSuffix}@${domain}`;
}
