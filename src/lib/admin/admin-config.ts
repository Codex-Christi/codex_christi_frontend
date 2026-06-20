export type AdminRole = 'master_admin' | 'admin' | 'support' | 'viewer';
export type AdminScope =
  | 'audit.view'
  | 'settings.manage'
  | 'shop'
  | 'shop.view'
  | 'shop.recovery.run'
  | 'shop.catalog.refresh';
export type AdminStatus = 'active' | 'disabled';

export const ADMIN_SESSION_COOKIE_NAME = 'admin_session';
export const ADMIN_SESSION_COOKIE_PATH = '/admin';
export const ADMIN_SESSION_TTL_SECONDS = 30 * 60;

export const MASTER_ADMIN_ROLE: AdminRole = 'master_admin';

const ADMIN_ROLE_VALUES = [MASTER_ADMIN_ROLE, 'admin', 'support', 'viewer'] as const;
const ADMIN_SCOPE_VALUES = [
  'audit.view',
  'settings.manage',
  'shop',
  'shop.view',
  'shop.recovery.run',
  'shop.catalog.refresh',
] as const;

export function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || null;
}

export function getDefaultAdminRole(): AdminRole {
  return MASTER_ADMIN_ROLE;
}

export function getDefaultAdminScopes(): AdminScope[] {
  return [...ADMIN_SCOPE_VALUES];
}

export function getDefaultOperationalAdminScopes(): AdminScope[] {
  return ['shop', 'shop.view'];
}

export function isMasterAdminRole(role: AdminRole | null | undefined) {
  return role === MASTER_ADMIN_ROLE;
}

export function isAdminScopeAllowed(scopes: AdminScope[], scope?: AdminScope, role?: AdminRole) {
  if (!scope) return true;
  if (isMasterAdminRole(role)) return true;
  if (scopes.includes(scope)) return true;

  if (scope === 'shop.view') {
    return scopes.includes('shop');
  }

  return false;
}

export function normalizeAdminRole(value: string | null | undefined): AdminRole | null {
  return ADMIN_ROLE_VALUES.includes(value as AdminRole) ? (value as AdminRole) : null;
}

export function normalizeAdminScopes(values: string[] | null | undefined): AdminScope[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter((value): value is AdminScope =>
    ADMIN_SCOPE_VALUES.includes(value as AdminScope),
  );
}

export function parseAdminScopes(value: string | null | undefined): AdminScope[] {
  if (!value?.trim()) {
    return getDefaultAdminScopes();
  }

  return normalizeAdminScopes(
    value
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean),
  );
}

export function isActiveAdminStatus(value: string | null | undefined) {
  return value === 'active';
}
