export const ADMIN_ROOT_PATH = '/admin';
export const ADMIN_UNLOCK_PATH = '/admin/unlock';
export const ADMIN_LOGOUT_PATH = '/admin/logout';

export function getSafeAdminReturnPath(value: string | null | undefined) {
  if (!value) return null;

  const trimmed = value.trim();

  if (!trimmed.startsWith(ADMIN_ROOT_PATH) || trimmed.startsWith('//')) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, 'https://codexchristi.local');

    if (parsed.origin !== 'https://codexchristi.local') {
      return null;
    }

    if (!parsed.pathname.startsWith(ADMIN_ROOT_PATH)) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

export function sanitizeAdminReturnPath(
  value: string | null | undefined,
  fallback = ADMIN_ROOT_PATH,
) {
  return getSafeAdminReturnPath(value) ?? fallback;
}

export function buildAdminUnlockPath(returnPath: string | null | undefined) {
  const safeReturnPath = sanitizeAdminReturnPath(returnPath);
  return `${ADMIN_UNLOCK_PATH}?next=${encodeURIComponent(safeReturnPath)}`;
}

export function buildAdminLogoutPath(returnPath: string | null | undefined) {
  const safeReturnPath = sanitizeAdminReturnPath(returnPath);
  return `${ADMIN_LOGOUT_PATH}?next=${encodeURIComponent(safeReturnPath)}`;
}
