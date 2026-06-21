import type { AdminNotificationRecipientGroupSummary } from '@/lib/admin/admin-notification-recipients';

export const ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY = 'all_notification_groups';

export type AdminRecipientOption = {
  id: string;
  label: string;
  email: string;
  role: string | null;
  status: string;
};

export type ActiveRecipient = {
  email: string;
  label: string;
  source: 'custom' | 'global' | 'master';
  removable: boolean;
};

export type RecipientDirectoryEntry = {
  email: string;
  label: string;
  isMasterAdmin: boolean;
  inGlobalDefaults: boolean;
  directGroupKeys: string[];
  inheritedMasterGroupKeys: string[];
  effectiveGroupKeys: string[];
  activeGroupKeys: string[];
};

export type AdminNotificationRecipientSettingsProps = {
  groups: AdminNotificationRecipientGroupSummary[];
  adminOptions: AdminRecipientOption[];
};

export type RecipientGroupMode = 'global' | 'group';
