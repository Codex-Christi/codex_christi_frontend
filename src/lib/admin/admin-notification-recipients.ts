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

export const ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY = 'all_notification_groups' as const;

export const ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_DEFINITION = {
  key: ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY,
  label: 'All Notification Groups',
  description:
    'Default recipients inherited by every notification group and used when new groups are created.',
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
  | typeof ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY
  | (typeof ADMIN_NOTIFICATION_RECIPIENT_GROUP_DEFINITIONS)[number]['key'];

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

export type AdminNotificationRecipientEmailPermissionsInput = {
  email: string;
  includeGlobalDefault: boolean;
  groupKeys: string[];
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
    const [globalDefaults, group] = await Promise.all([
      prisma.adminNotificationRecipientGroup.findUnique({
        where: { key: ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY },
        select: {
          recipientEmails: true,
        },
      }),
      prisma.adminNotificationRecipientGroup.findUnique({
        where: { key: groupKey },
        select: {
          enabled: true,
          recipientEmails: true,
          includeMasterAdmins: true,
        },
      }),
    ]);

    if (group && !group.enabled) {
      return [];
    }

    if (!group) {
      const recipientsWithoutGroup = normalizeAdminNotificationEmails([
        ...(globalDefaults?.recipientEmails ?? []),
        ...fallbackRecipients,
      ]);

      return recipientsWithoutGroup.length ? recipientsWithoutGroup : fallbackRecipients;
    }

    const recipientEmails = [...(globalDefaults?.recipientEmails ?? []), ...group.recipientEmails];

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
  return (
    key === ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY ||
    ADMIN_NOTIFICATION_RECIPIENT_GROUP_DEFINITIONS.some((definition) => definition.key === key)
  );
}

export async function listAdminNotificationRecipientGroupsForDashboard(): Promise<
  AdminNotificationRecipientGroupSummary[]
> {
  if (!isAdminOpsLedgerDatabaseConfigured()) {
    return [
      {
        ...ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_DEFINITION,
        recipientEmails: [],
        includeMasterAdmins: false,
        enabled: true,
        configured: false,
        updatedAt: null,
      },
      ...ADMIN_NOTIFICATION_RECIPIENT_GROUP_DEFINITIONS.map((definition) => ({
        ...definition,
        recipientEmails: [],
        includeMasterAdmins: true,
        enabled: false,
        configured: false,
        updatedAt: null,
      })),
    ];
  }

  const prisma = getAdminOpsLedgerPrisma();
  await prisma.adminNotificationRecipientGroup.upsert({
    where: { key: ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY },
    create: {
      key: ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY,
      label: ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_DEFINITION.label,
      description: ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_DEFINITION.description,
      includeMasterAdmins: false,
      enabled: true,
    },
    update: {
      label: ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_DEFINITION.label,
      description: ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_DEFINITION.description,
      includeMasterAdmins: false,
      enabled: true,
    },
  });

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
        in: [
          ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY,
          ...ADMIN_NOTIFICATION_RECIPIENT_GROUP_DEFINITIONS.map((definition) => definition.key),
        ],
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
  const globalRow = rowByKey.get(ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY);

  return [
    {
      key: ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY,
      label: globalRow?.label ?? ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_DEFINITION.label,
      description:
        globalRow?.description ?? ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_DEFINITION.description,
      recipientEmails: normalizeAdminNotificationEmails(globalRow?.recipientEmails ?? []),
      includeMasterAdmins: false,
      enabled: true,
      configured: Boolean(globalRow),
      updatedAt: globalRow?.updatedAt ?? null,
    },
    ...ADMIN_NOTIFICATION_RECIPIENT_GROUP_DEFINITIONS.map((definition) => {
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
    }),
  ];
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

  const definition =
    key === ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY
      ? ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_DEFINITION
      : ADMIN_NOTIFICATION_RECIPIENT_GROUP_DEFINITIONS.find((candidate) => candidate.key === key);

  if (!definition) {
    throw new Error('Unsupported notification recipient group.');
  }

  const normalizedEmails = normalizeAdminNotificationEmails(recipientEmails);
  const prisma = getAdminOpsLedgerPrisma();
  const protectedAdmins = await prisma.adminUser.findMany({
    where: {
      email: {
        in: normalizedEmails,
      },
    },
    select: {
      email: true,
      role: true,
      status: true,
    },
  });
  const protectedMasterAdmin = protectedAdmins.find(
    (admin) =>
      admin.email &&
      isMasterAdminRole(normalizeAdminRole(admin.role)) &&
      isActiveAdminStatus(admin.status),
  );

  if (protectedMasterAdmin) {
    throw new Error('Master admin notification routing is inherited and cannot be edited here.');
  }

  return prisma.adminNotificationRecipientGroup.upsert({
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

export async function saveAdminNotificationRecipientEmailPermissions({
  email,
  includeGlobalDefault,
  groupKeys,
  actorCodexUserId,
}: AdminNotificationRecipientEmailPermissionsInput) {
  const normalizedEmail = normalizeAdminNotificationEmails([email])[0];

  if (!normalizedEmail) {
    throw new Error('Enter a valid notification recipient email.');
  }

  if (!isAdminOpsLedgerDatabaseConfigured()) {
    throw new Error('Admin Ops Ledger database is not configured.');
  }

  const supportedGroupKeySet = new Set<string>(
    ADMIN_NOTIFICATION_RECIPIENT_GROUP_DEFINITIONS.map((definition) => definition.key),
  );
  const normalizedGroupKeys = Array.from(
    new Set(groupKeys.map((key) => key.trim()).filter(Boolean)),
  );
  const unsupportedGroupKey = normalizedGroupKeys.find((key) => !supportedGroupKeySet.has(key));

  if (unsupportedGroupKey) {
    throw new Error('Unsupported notification recipient group.');
  }

  const prisma = getAdminOpsLedgerPrisma();
  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail },
    select: {
      role: true,
      status: true,
    },
  });

  if (
    existingAdmin &&
    isMasterAdminRole(normalizeAdminRole(existingAdmin.role)) &&
    isActiveAdminStatus(existingAdmin.status)
  ) {
    throw new Error('Master admin notification routing is inherited and cannot be edited here.');
  }

  const managedKeys = [
    ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY,
    ...ADMIN_NOTIFICATION_RECIPIENT_GROUP_DEFINITIONS.map((definition) => definition.key),
  ];
  const existingRows = await prisma.adminNotificationRecipientGroup.findMany({
    where: {
      key: {
        in: managedKeys,
      },
    },
    select: {
      key: true,
      recipientEmails: true,
    },
  });
  const rowByKey = new Map(existingRows.map((row) => [row.key, row]));
  const selectedGroupKeySet = new Set(normalizedGroupKeys);

  const getNextRecipientEmails = (currentEmails: string[], shouldIncludeEmail: boolean) => {
    const remainingEmails = normalizeAdminNotificationEmails(currentEmails).filter(
      (candidate) => candidate !== normalizedEmail,
    );

    return shouldIncludeEmail
      ? normalizeAdminNotificationEmails([...remainingEmails, normalizedEmail])
      : remainingEmails;
  };

  const updates = [
    prisma.adminNotificationRecipientGroup.upsert({
      where: { key: ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY },
      create: {
        key: ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY,
        label: ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_DEFINITION.label,
        description: ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_DEFINITION.description,
        recipientEmails: getNextRecipientEmails([], includeGlobalDefault),
        includeMasterAdmins: false,
        enabled: true,
        createdByCodexUserId: actorCodexUserId ?? null,
        updatedByCodexUserId: actorCodexUserId ?? null,
      },
      update: {
        label: ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_DEFINITION.label,
        description: ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_DEFINITION.description,
        recipientEmails: getNextRecipientEmails(
          rowByKey.get(ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY)?.recipientEmails ?? [],
          includeGlobalDefault,
        ),
        includeMasterAdmins: false,
        enabled: true,
        updatedByCodexUserId: actorCodexUserId ?? null,
      },
    }),
    ...ADMIN_NOTIFICATION_RECIPIENT_GROUP_DEFINITIONS.map((definition) => {
      const shouldIncludeEmail = !includeGlobalDefault && selectedGroupKeySet.has(definition.key);

      return prisma.adminNotificationRecipientGroup.upsert({
        where: { key: definition.key },
        create: {
          key: definition.key,
          label: definition.label,
          description: definition.description,
          recipientEmails: getNextRecipientEmails([], shouldIncludeEmail),
          updatedByCodexUserId: actorCodexUserId ?? null,
          createdByCodexUserId: actorCodexUserId ?? null,
        },
        update: {
          label: definition.label,
          description: definition.description,
          recipientEmails: getNextRecipientEmails(
            rowByKey.get(definition.key)?.recipientEmails ?? [],
            shouldIncludeEmail,
          ),
          updatedByCodexUserId: actorCodexUserId ?? null,
        },
      });
    }),
  ];

  await prisma.$transaction(updates);

  return {
    email: normalizedEmail,
    includeGlobalDefault,
    groupCount: includeGlobalDefault
      ? ADMIN_NOTIFICATION_RECIPIENT_GROUP_DEFINITIONS.length
      : normalizedGroupKeys.length,
  };
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
