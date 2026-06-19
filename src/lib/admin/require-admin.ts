import 'server-only';

import { notFound, redirect } from 'next/navigation';
import { getServerSessionState } from '@/lib/session/server-session';
import {
  buildAdminUnlockPath,
  sanitizeAdminReturnPath,
} from './admin-paths';
import {
  isAdminScopeAllowed,
  isAllowedAdminUser,
  type AdminRole,
  type AdminScope,
} from './admin-config';
import { getServerAdminSessionState } from './admin-session-server';

export type AdminAuthContext = {
  userID: string;
  role: AdminRole;
  scopes: AdminScope[];
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

  if (!isAllowedAdminUser(primarySession.userID)) {
    notFound();
  }

  return {
    userID: primarySession.userID,
  };
}

export async function getAdminAuthContext(): Promise<AdminAuthContext | null> {
  const primarySession = await getServerSessionState();

  if (!primarySession.isAuthenticated || !primarySession.userID) {
    return null;
  }

  if (!isAllowedAdminUser(primarySession.userID)) {
    return null;
  }

  const adminSession = await getServerAdminSessionState();

  if (!adminSession.isAuthenticated || adminSession.userID !== primarySession.userID) {
    return null;
  }

  if (!adminSession.role) {
    return null;
  }

  return {
    userID: primarySession.userID,
    role: adminSession.role,
    scopes: adminSession.scopes,
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

  if (!isAllowedAdminUser(primarySession.userID)) {
    notFound();
  }

  const adminSession = await getServerAdminSessionState();

  if (!adminSession.isAuthenticated || adminSession.userID !== primarySession.userID) {
    redirect(buildAdminUnlockPath(safeReturnPath));
  }

  if (!adminSession.role || !isAdminScopeAllowed(adminSession.scopes, scope)) {
    notFound();
  }

  return {
    userID: primarySession.userID,
    role: adminSession.role,
    scopes: adminSession.scopes,
  };
}

export async function requireAdminAction(scope?: AdminScope) {
  const context = await getAdminAuthContext();

  if (!context || !isAdminScopeAllowed(context.scopes, scope)) {
    throw new Error('Admin authorization required.');
  }

  return context;
}

