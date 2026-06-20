import 'server-only';

import {
  getAdminOpsLedgerPrisma,
  isAdminOpsLedgerDatabaseConfigured,
} from '@/lib/prisma/adminOpsLedger/adminOpsLedgerPrisma';
import { isActiveAdminStatus, isMasterAdminRole, normalizeAdminRole } from './admin-config';

export const ADMIN_NOTIFICATION_RECIPIENT_GROUP_KEY = {
  PAID_ORDER_FULFILLMENT_ISSUES: 'paid_order_fulfillment_issues',
  PAYMENT_ISSUES: 'payment_issues',
  GENERAL_ADMIN_OPS: 'general_admin_ops',
} as const;

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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
