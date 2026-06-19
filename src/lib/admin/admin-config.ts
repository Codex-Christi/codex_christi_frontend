export type AdminRole = 'super_admin';
export type AdminScope = 'shop';

export const ADMIN_SESSION_COOKIE_NAME = 'admin_session';
export const ADMIN_SESSION_COOKIE_PATH = '/admin';
export const ADMIN_SESSION_TTL_SECONDS = 30 * 60;

export function getAllowedAdminUserIds() {
  const rawValue = process.env.ADMIN_ALLOWED_USER_IDS ?? '';
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return [];
  }

  if (trimmedValue.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmedValue) as unknown;

      if (Array.isArray(parsed)) {
        return parsed
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  return trimmedValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isAllowedAdminUser(userID: string | null | undefined) {
  if (!userID) return false;

  const allowedUserIds = getAllowedAdminUserIds();

  return allowedUserIds.includes(userID);
}

export function getAdminPasswordHash() {
  return process.env.ADMIN_PASSWORD_HASH?.trim() || null;
}

export function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || null;
}

export function getDefaultAdminRole(): AdminRole {
  return 'super_admin';
}

export function getDefaultAdminScopes(): AdminScope[] {
  return ['shop'];
}

export function isAdminScopeAllowed(scopes: AdminScope[], scope?: AdminScope) {
  return !scope || scopes.includes(scope);
}
