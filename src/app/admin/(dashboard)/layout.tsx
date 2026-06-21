import AdminDashboardShell from '@/components/UI/Admin/shell/AdminDashboardShell';
import {
  isAdminScopeAllowed,
  isMasterAdminRole,
  type AdminRole,
  type AdminScope,
} from '@/lib/admin/admin-config';
import { getAdminAuthContext } from '@/lib/admin/require-admin';

type AdminDashboardLayoutProps = {
  children: React.ReactNode;
};

export default async function AdminDashboardLayout({ children }: AdminDashboardLayoutProps) {
  const adminContext = await getAdminAuthContext();
  const role: AdminRole | undefined = adminContext?.role;
  const scopes: AdminScope[] = adminContext?.scopes ?? [];

  return (
    <AdminDashboardShell
      access={{
        canAccessAdminOps: Boolean(role && isMasterAdminRole(role)),
        canAccessAuditLogs: Boolean(role && isAdminScopeAllowed(scopes, 'audit.view', role)),
        canAccessShopOverview: Boolean(role && isAdminScopeAllowed(scopes, 'shop', role)),
        canAccessShopTools: Boolean(role && isAdminScopeAllowed(scopes, 'shop.view', role)),
      }}
      identity={
        adminContext
          ? {
              email: adminContext.email,
              role: adminContext.role,
              scopes: adminContext.scopes,
              userID: adminContext.userID,
            }
          : null
      }
    >
      {children}
    </AdminDashboardShell>
  );
}
