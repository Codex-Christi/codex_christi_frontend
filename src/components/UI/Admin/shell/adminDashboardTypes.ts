import type { ComponentType, ReactNode } from 'react';
import type { AdminRole, AdminScope } from '@/lib/admin/admin-config';

export type AdminDashboardSection =
  | 'admin'
  | 'admin-audit-logs'
  | 'admin-notification-recipients'
  | 'admin-ops'
  | 'shop'
  | 'shop-catalog-snapshots'
  | 'shop-paid-order-recovery'
  | 'shop-payment-reconciliation';

export type AdminDashboardIcon = ComponentType<{
  size?: number;
  className?: string;
}>;

export type AdminDashboardAccess = {
  canAccessAdminOps: boolean;
  canAccessAuditLogs: boolean;
  canAccessShopOverview: boolean;
  canAccessShopTools: boolean;
};

export type AdminDashboardIdentity = {
  email: string | null;
  role: AdminRole;
  scopes: AdminScope[];
  userID: string;
};

export type AdminDashboardNavigationGroup = {
  id: string;
  label: string;
  items: AdminDashboardNavigationItem[];
};

export type AdminDashboardNavigationItem = {
  count?: string;
  description?: string;
  href?: string;
  icon: AdminDashboardIcon;
  requiredAccess?: keyof AdminDashboardAccess;
  section: AdminDashboardSection | 'external';
  status?: string;
  title: string;
};

export type AdminDashboardPageConfig = {
  searchPlaceholder: string;
  section: AdminDashboardSection;
  subtitle: string;
  title: string;
};

export type AdminDashboardShellProps = {
  access: AdminDashboardAccess;
  children: ReactNode;
  identity: AdminDashboardIdentity | null;
};
