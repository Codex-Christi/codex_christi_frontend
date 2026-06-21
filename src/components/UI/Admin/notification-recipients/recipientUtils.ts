import type { AdminNotificationRecipientGroupSummary } from '@/lib/admin/admin-notification-recipients';
import {
  ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY,
  type ActiveRecipient,
  type AdminRecipientOption,
  type RecipientDirectoryEntry,
  type RecipientGroupMode,
} from './types';

export function getNotificationGroups(groups: AdminNotificationRecipientGroupSummary[]) {
  return groups.filter((group) => group.key !== ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY);
}

export function buildRecipientDirectoryEntries({
  groups,
  adminOptions,
}: {
  groups: AdminNotificationRecipientGroupSummary[];
  adminOptions: AdminRecipientOption[];
}) {
  const notificationGroups = getNotificationGroups(groups);
  const globalDefaultGroup = groups.find(
    (group) => group.key === ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY,
  );
  const adminByEmail = new Map(
    adminOptions
      .filter((admin) => admin.email)
      .map((admin) => [normalizeEmail(admin.email), admin] as const),
  );
  const entries = new Map<string, RecipientDirectoryEntry>();
  const ensureEntry = (email: string, label?: string) => {
    const normalizedEmail = normalizeEmail(email);
    const admin = adminByEmail.get(normalizedEmail);
    const existing = entries.get(normalizedEmail);

    if (existing) return existing;

    const entry = createRecipientDirectoryEntry({
      email: normalizedEmail,
      label: label ?? admin?.label ?? 'Custom recipient',
      isMasterAdmin: admin?.role === 'master_admin',
    });

    entries.set(normalizedEmail, entry);
    return entry;
  };

  for (const email of globalDefaultGroup?.recipientEmails ?? []) {
    const entry = ensureEntry(email, 'All notification groups');
    entry.inGlobalDefaults = true;
  }

  for (const group of notificationGroups) {
    for (const email of group.recipientEmails) {
      const entry = ensureEntry(email);
      entry.directGroupKeys = addUniqueString(entry.directGroupKeys, group.key);
    }
  }

  for (const admin of adminOptions) {
    if (!admin.email || admin.role !== 'master_admin') continue;

    const entry = ensureEntry(admin.email, admin.label);
    entry.isMasterAdmin = true;

    for (const group of notificationGroups) {
      if (!group.includeMasterAdmins) continue;
      entry.inheritedMasterGroupKeys = addUniqueString(entry.inheritedMasterGroupKeys, group.key);
    }
  }

  for (const entry of entries.values()) {
    entry.effectiveGroupKeys = getEffectiveGroupKeys(entry, notificationGroups);
    entry.activeGroupKeys = entry.effectiveGroupKeys.filter((groupKey) =>
      notificationGroups.some((group) => group.key === groupKey && group.enabled),
    );
  }

  return [...entries.values()].sort((left, right) => {
    if (left.isMasterAdmin !== right.isMasterAdmin) return left.isMasterAdmin ? -1 : 1;
    if (left.activeGroupKeys.length !== right.activeGroupKeys.length) {
      return right.activeGroupKeys.length - left.activeGroupKeys.length;
    }

    return left.email.localeCompare(right.email);
  });
}

export function getRecipientDirectorySearchText(
  entry: RecipientDirectoryEntry,
  groups: AdminNotificationRecipientGroupSummary[],
) {
  const groupLabels = getNotificationGroups(groups)
    .filter((group) => entry.effectiveGroupKeys.includes(group.key))
    .map((group) => group.label)
    .join(' ');

  return `${entry.email} ${entry.label} ${groupLabels}`.toLowerCase();
}

export function createRecipientDirectoryEntry({
  email,
  label,
  isMasterAdmin,
}: {
  email: string;
  label: string;
  isMasterAdmin: boolean;
}): RecipientDirectoryEntry {
  return {
    email: normalizeEmail(email),
    label,
    isMasterAdmin,
    inGlobalDefaults: false,
    directGroupKeys: [],
    inheritedMasterGroupKeys: [],
    effectiveGroupKeys: [],
    activeGroupKeys: [],
  };
}

export function resolveActiveRecipients({
  adminOptions,
  emails,
  enabled,
  globalEmails,
  includeMasterAdmins,
  mode,
}: {
  adminOptions: AdminRecipientOption[];
  emails: string[];
  enabled: boolean;
  globalEmails: string[];
  includeMasterAdmins: boolean;
  mode: RecipientGroupMode;
}) {
  if (!enabled) return [];

  const recipients = new Map<string, ActiveRecipient>();
  const masterAdminByEmail = new Map(
    adminOptions
      .filter((admin) => admin.role === 'master_admin')
      .map((admin) => [normalizeEmail(admin.email), admin] as const),
  );

  if (mode === 'group') {
    for (const email of globalEmails) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) continue;

      const masterAdmin = masterAdminByEmail.get(normalizedEmail);
      recipients.set(normalizedEmail, {
        email: normalizedEmail,
        label: masterAdmin?.label ?? 'Inherited from all notification groups',
        source: masterAdmin ? 'master' : 'global',
        removable: false,
      });
    }
  }

  for (const email of emails) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || recipients.has(normalizedEmail)) continue;

    const masterAdmin = masterAdminByEmail.get(normalizedEmail);
    recipients.set(normalizedEmail, {
      email: normalizedEmail,
      label:
        masterAdmin?.label ?? (mode === 'global' ? 'All notification groups' : 'Custom recipient'),
      source: masterAdmin ? 'master' : mode === 'global' ? 'global' : 'custom',
      removable: !masterAdmin,
    });
  }

  if (includeMasterAdmins && mode === 'group') {
    for (const admin of adminOptions) {
      const normalizedEmail = normalizeEmail(admin.email);
      if (!normalizedEmail || admin.role !== 'master_admin' || recipients.has(normalizedEmail)) {
        continue;
      }

      recipients.set(normalizedEmail, {
        email: normalizedEmail,
        label: admin.label,
        source: 'master',
        removable: false,
      });
    }
  }

  return [...recipients.values()].sort((left, right) => left.email.localeCompare(right.email));
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase().replace(/,$/, '');
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getEffectiveGroupKeys(
  entry: RecipientDirectoryEntry,
  notificationGroups: AdminNotificationRecipientGroupSummary[],
) {
  if (entry.inGlobalDefaults) return notificationGroups.map((group) => group.key);

  return uniqueStrings([...entry.directGroupKeys, ...entry.inheritedMasterGroupKeys]);
}

function addUniqueString(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value];
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}
