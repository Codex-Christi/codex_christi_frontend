import 'server-only';

import { notFound, redirect } from 'next/navigation';
import { getServerSessionState } from '@/lib/session/server-session';
import { getActiveAdminUserByCodexUserId } from './admin-auth-ledger';
import { buildAdminLogoutPath, buildAdminUnlockPath, sanitizeAdminReturnPath } from './admin-paths';
import {
  isAdminScopeAllowed,
  isMasterAdminRole,
  type AdminRole,
  type AdminScope,
} from './admin-config';
import { getServerAdminSessionState } from './admin-session-server';

export type AdminAuthContext = {
  adminUserId: string;
  userID: string;
  email: string | null;
  displayName: string | null;
  role: AdminRole;
  scopes: AdminScope[];
  sessionVersion: number;
};

export type AdminActionAuthErrorCode =
  | 'admin_session_expired'
  | 'admin_permission_denied'
  | 'primary_session_expired';

export class AdminActionAuthError extends Error {
  code: AdminActionAuthErrorCode;

  constructor(code: AdminActionAuthErrorCode, message: string) {
    super(message);
    this.name = 'AdminActionAuthError';
    this.code = code;
  }
}

export function isAdminActionAuthError(error: unknown): error is AdminActionAuthError {
  return error instanceof AdminActionAuthError;
}

export function getAdminActionErrorMessage(error: unknown, fallback: string) {
  if (isAdminActionAuthError(error)) return error.message;
  if (error instanceof Error) return error.message;

  return fallback;
}

export async function requirePrimaryAdminCandidate({
  returnPath = '/admin',
}: {
  returnPath?: string;
} = {}) {
  const primarySession = await getServerSessionState();
  const safeReturnPath = sanitizeAdminReturnPath(returnPath);

  if (!primarySession.isAuthenticated || !primarySession.userID) {
    redirect(`/auth/sign-in?next=${encodeURIComponent(safeReturnPath)}`);
  }

  const adminUser = await getActiveAdminUserByCodexUserId(primarySession.userID);

  if (!adminUser) {
    notFound();
  }

  return adminUser;
}

export async function getAdminAuthContext(): Promise<AdminAuthContext | null> {
  const primarySession = await getServerSessionState();

  if (!primarySession.isAuthenticated || !primarySession.userID) {
    return null;
  }

  const adminSession = await getServerAdminSessionState();

  if (!adminSession.isAuthenticated || adminSession.userID !== primarySession.userID) {
    return null;
  }

  const adminUser = await getActiveAdminUserByCodexUserId(primarySession.userID);

  if (!adminUser || adminSession.sessionVersion !== adminUser.sessionVersion) {
    return null;
  }

  return {
    adminUserId: adminUser.id,
    userID: primarySession.userID,
    email: adminUser.email,
    displayName: adminUser.displayName,
    role: adminUser.role,
    scopes: adminUser.scopes,
    sessionVersion: adminUser.sessionVersion,
  };
}

export async function requireAdminPage({
  scope,
  returnPath = '/admin',
}: {
  scope?: AdminScope;
  returnPath?: string;
} = {}) {
  const primarySession = await getServerSessionState();
  const safeReturnPath = sanitizeAdminReturnPath(returnPath);

  if (!primarySession.isAuthenticated || !primarySession.userID) {
    redirect(`/auth/sign-in?next=${encodeURIComponent(safeReturnPath)}`);
  }

  const adminUser = await getActiveAdminUserByCodexUserId(primarySession.userID);

  if (!adminUser) {
    notFound();
  }

  const adminSession = await getServerAdminSessionState();

  if (
    !adminSession.isAuthenticated ||
    adminSession.userID !== primarySession.userID ||
    adminSession.sessionVersion !== adminUser.sessionVersion
  ) {
    const shouldClearAdminCookie =
      adminSession.shouldClearCookie ||
      (adminSession.isAuthenticated &&
        (adminSession.userID !== primarySession.userID ||
          adminSession.sessionVersion !== adminUser.sessionVersion));

    redirect(
      shouldClearAdminCookie
        ? buildAdminLogoutPath(safeReturnPath)
        : buildAdminUnlockPath(safeReturnPath),
    );
  }

  if (!isAdminScopeAllowed(adminUser.scopes, scope, adminUser.role)) {
    notFound();
  }

  return {
    adminUserId: adminUser.id,
    userID: primarySession.userID,
    email: adminUser.email,
    displayName: adminUser.displayName,
    role: adminUser.role,
    scopes: adminUser.scopes,
    sessionVersion: adminUser.sessionVersion,
  };
}

export async function requireAdminAction(scope?: AdminScope) {
  const primarySession = await getServerSessionState();

  if (!primarySession.isAuthenticated || !primarySession.userID) {
    throw new AdminActionAuthError(
      'primary_session_expired',
      'Your sign-in session expired. Sign in again before running this admin action.',
    );
  }

  const adminUser = await getActiveAdminUserByCodexUserId(primarySession.userID);

  if (!adminUser) {
    throw new AdminActionAuthError(
      'admin_permission_denied',
      'This account no longer has admin access.',
    );
  }

  const adminSession = await getServerAdminSessionState();

  if (
    !adminSession.isAuthenticated ||
    adminSession.userID !== primarySession.userID ||
    adminSession.sessionVersion !== adminUser.sessionVersion
  ) {
    throw new AdminActionAuthError(
      'admin_session_expired',
      'Your admin session expired. Unlock the admin dashboard and try again.',
    );
  }

  if (!isAdminScopeAllowed(adminUser.scopes, scope, adminUser.role)) {
    throw new AdminActionAuthError(
      'admin_permission_denied',
      'Your admin role does not allow this action.',
    );
  }

  return {
    adminUserId: adminUser.id,
    userID: primarySession.userID,
    email: adminUser.email,
    displayName: adminUser.displayName,
    role: adminUser.role,
    scopes: adminUser.scopes,
    sessionVersion: adminUser.sessionVersion,
  };
}

export async function requireMasterAdminAction() {
  const context = await requireAdminAction();

  if (!context || !isMasterAdminRole(context.role)) {
    throw new AdminActionAuthError(
      'admin_permission_denied',
      'Master admin authorization is required for this action.',
    );
  }

  return context;
}
