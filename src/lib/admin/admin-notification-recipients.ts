import 'server-only';

import {
  getAdminOpsLedgerPrisma,
  isAdminOpsLedgerDatabaseConfigured,
} from '@/lib/prisma/adminOpsLedger/adminOpsLedgerPrisma';
import { isActiveAdminStatus, isMasterAdminRole, normalizeAdminRole } from './admin-config';

export const ADMIN_NOTIFICATION_RECIPIENT_GROUP_KEY = {
  PAID_ORDER_FULFILLMENT_ISSUES: 'paid_order_fulfillment_issues',
  PAID_ORDER_FULFILLMENT_SUCCESS: 'paid_order_fulfillment_success',
  PAYMENT_ISSUES: 'payment_issues',
  GENERAL_ADMIN_OPS: 'general_admin_ops',
} as const;

export const ADMIN_NOTIFICATION_RECIPIENT_GROUP_DEFINITIONS = [
  {
    key: ADMIN_NOTIFICATION_RECIPIENT_GROUP_KEY.PAYMENT_ISSUES,
    label: 'Payment Issues',
    description:
      'PayPal authorization, capture, reconciliation, refund, and money-risk attention alerts.',
  },
  {
    key: ADMIN_NOTIFICATION_RECIPIENT_GROUP_KEY.PAID_ORDER_FULFILLMENT_ISSUES,
    label: 'Paid Order Fulfillment Issues',
    description:
      'Paid checkout rows where receipt, Django payment save, fulfillment processing, or Merchize push needs attention.',
  },
  {
    key: ADMIN_NOTIFICATION_RECIPIENT_GROUP_KEY.PAID_ORDER_FULFILLMENT_SUCCESS,
    label: 'Paid Order Fulfillment Success',
    description: 'Optional notices when a paid order is pushed successfully into fulfillment.',
  },
  {
    key: ADMIN_NOTIFICATION_RECIPIENT_GROUP_KEY.GENERAL_ADMIN_OPS,
    label: 'General Admin Ops',
    description: 'General operational notifications that are not tied to a shop payment stage.',
  },
] as const;

export type AdminNotificationRecipientGroupKey =
  (typeof ADMIN_NOTIFICATION_RECIPIENT_GROUP_DEFINITIONS)[number]['key'];

export type AdminNotificationRecipientGroupSummary = {
  key: AdminNotificationRecipientGroupKey;
  label: string;
  description: string;
  recipientEmails: string[];
  includeMasterAdmins: boolean;
  enabled: boolean;
  configured: boolean;
  updatedAt: Date | null;
};

export type AdminNotificationRecipientGroupInput = {
  key: string;
  recipientEmails: string[];
  includeMasterAdmins: boolean;
  enabled: boolean;
  actorCodexUserId?: string | null;
};

type ResolveAdminNotificationRecipientsProps = {
  groupKey: string;
  fallbackEmails?: string[];
};

export function normalizeAdminNotificationEmails(emails: Iterable<string | null | undefined>) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const email of emails) {
    const value = email?.trim().toLowerCase();
    if (!value || seen.has(value) || !isValidEmail(value)) continue;

    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

export async function resolveAdminNotificationRecipients({
  groupKey,
  fallbackEmails = [],
}: ResolveAdminNotificationRecipientsProps) {
  const fallbackRecipients = normalizeAdminNotificationEmails(fallbackEmails);

  if (!isAdminOpsLedgerDatabaseConfigured()) {
    return fallbackRecipients;
  }

  try {
    const prisma = getAdminOpsLedgerPrisma();
    const group = await prisma.adminNotificationRecipientGroup.findUnique({
      where: { key: groupKey },
      select: {
        enabled: true,
        recipientEmails: true,
        includeMasterAdmins: true,
      },
    });

    if (group && !group.enabled) {
      return [];
    }

    if (!group) {
      return fallbackRecipients;
    }

    const recipientEmails = [...group.recipientEmails];

    if (group.includeMasterAdmins) {
      const masterAdmins = await prisma.adminUser.findMany({
        where: {
          email: { not: null },
        },
        select: {
          email: true,
          role: true,
          status: true,
        },
      });

      for (const admin of masterAdmins) {
        if (
          admin.email &&
          isMasterAdminRole(normalizeAdminRole(admin.role)) &&
          isActiveAdminStatus(admin.status)
        ) {
          recipientEmails.push(admin.email);
        }
      }
    }

    const resolvedRecipients = normalizeAdminNotificationEmails(recipientEmails);
    return resolvedRecipients.length ? resolvedRecipients : fallbackRecipients;
  } catch (error) {
    console.error('[admin.notification_recipients.resolve_failed]', {
      groupKey,
      error: error instanceof Error ? error.message : 'unknown_error',
    });

    return fallbackRecipients;
  }
}

export function isSupportedAdminNotificationRecipientGroupKey(
  key: string,
): key is AdminNotificationRecipientGroupKey {
  return ADMIN_NOTIFICATION_RECIPIENT_GROUP_DEFINITIONS.some(
    (definition) => definition.key === key,
  );
}

export async function listAdminNotificationRecipientGroupsForDashboard(): Promise<
  AdminNotificationRecipientGroupSummary[]
> {
  if (!isAdminOpsLedgerDatabaseConfigured()) {
    return ADMIN_NOTIFICATION_RECIPIENT_GROUP_DEFINITIONS.map((definition) => ({
      ...definition,
      recipientEmails: [],
      includeMasterAdmins: true,
      enabled: false,
      configured: false,
      updatedAt: null,
    }));
  }

  const prisma = getAdminOpsLedgerPrisma();

  await Promise.all(
    ADMIN_NOTIFICATION_RECIPIENT_GROUP_DEFINITIONS.map((definition) =>
      prisma.adminNotificationRecipientGroup.upsert({
        where: { key: definition.key },
        create: {
          key: definition.key,
          label: definition.label,
          description: definition.description,
        },
        update: {
          label: definition.label,
          description: definition.description,
        },
      }),
    ),
  );

  const rows = await prisma.adminNotificationRecipientGroup.findMany({
    where: {
      key: {
        in: ADMIN_NOTIFICATION_RECIPIENT_GROUP_DEFINITIONS.map((definition) => definition.key),
      },
    },
    select: {
      key: true,
      label: true,
      description: true,
      recipientEmails: true,
      includeMasterAdmins: true,
      enabled: true,
      updatedAt: true,
    },
  });
  const rowByKey = new Map(rows.map((row) => [row.key, row]));

  return ADMIN_NOTIFICATION_RECIPIENT_GROUP_DEFINITIONS.map((definition) => {
    const row = rowByKey.get(definition.key);

    return {
      key: definition.key,
      label: row?.label ?? definition.label,
      description: row?.description ?? definition.description,
      recipientEmails: normalizeAdminNotificationEmails(row?.recipientEmails ?? []),
      includeMasterAdmins: row?.includeMasterAdmins ?? true,
      enabled: row?.enabled ?? true,
      configured: Boolean(row),
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

export async function saveAdminNotificationRecipientGroup({
  key,
  recipientEmails,
  includeMasterAdmins,
  enabled,
  actorCodexUserId,
}: AdminNotificationRecipientGroupInput) {
  if (!isSupportedAdminNotificationRecipientGroupKey(key)) {
    throw new Error('Unsupported notification recipient group.');
  }

  if (!isAdminOpsLedgerDatabaseConfigured()) {
    throw new Error('Admin Ops Ledger database is not configured.');
  }

  const definition = ADMIN_NOTIFICATION_RECIPIENT_GROUP_DEFINITIONS.find(
    (candidate) => candidate.key === key,
  );

  if (!definition) {
    throw new Error('Unsupported notification recipient group.');
  }

  const normalizedEmails = normalizeAdminNotificationEmails(recipientEmails);

  return getAdminOpsLedgerPrisma().adminNotificationRecipientGroup.upsert({
    where: { key },
    create: {
      key,
      label: definition.label,
      description: definition.description,
      recipientEmails: normalizedEmails,
      includeMasterAdmins,
      enabled,
      createdByCodexUserId: actorCodexUserId ?? null,
      updatedByCodexUserId: actorCodexUserId ?? null,
    },
    update: {
      label: definition.label,
      description: definition.description,
      recipientEmails: normalizedEmails,
      includeMasterAdmins,
      enabled,
      updatedByCodexUserId: actorCodexUserId ?? null,
    },
  });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
