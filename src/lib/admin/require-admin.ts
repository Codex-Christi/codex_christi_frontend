import 'server-only';

import { notFound, redirect } from 'next/navigation';
import { getServerSessionState } from '@/lib/session/server-session';
import { getActiveAdminUserByCodexUserId } from './admin-auth-ledger';
import {
  buildAdminLogoutPath,
  buildAdminUnlockPath,
  sanitizeAdminReturnPath,
} from './admin-paths';
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
  const context = await getAdminAuthContext();

  if (!context || !isAdminScopeAllowed(context.scopes, scope, context.role)) {
    throw new Error('Admin authorization required.');
  }

  return context;
}

export async function requireMasterAdminAction() {
  const context = await getAdminAuthContext();

  if (!context || !isMasterAdminRole(context.role)) {
    throw new Error('Master admin authorization required.');
  }

  return context;
}
