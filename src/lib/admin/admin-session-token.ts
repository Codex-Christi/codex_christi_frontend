import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import {
  getAdminSessionSecret,
  normalizeAdminRole,
  normalizeAdminScopes,
  type AdminRole,
  type AdminScope,
} from './admin-config';

export type AdminSessionState = {
  isAuthenticated: boolean;
  userID: string | null;
  role: AdminRole | null;
  scopes: AdminScope[];
  sessionVersion: number | null;
  expiresAt: Date | null;
  shouldClearCookie: boolean;
};

type AdminSessionPayload = JWTPayload & {
  userID?: string;
  role?: AdminRole;
  scopes?: AdminScope[];
  sessionVersion?: number;
};

const emptyAdminSessionState: AdminSessionState = {
  isAuthenticated: false,
  userID: null,
  role: null,
  scopes: [],
  sessionVersion: null,
  expiresAt: null,
  shouldClearCookie: false,
};

function getEncodedAdminSessionSecret() {
  const secret = getAdminSessionSecret();

  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET is not configured.');
  }

  return new TextEncoder().encode(secret);
}

export async function signAdminSessionToken({
  userID,
  role,
  scopes,
  sessionVersion,
  expiresAt,
}: {
  userID: string;
  role: AdminRole;
  scopes: AdminScope[];
  sessionVersion: number;
  expiresAt: Date;
}) {
  return new SignJWT({ userID, role, scopes, sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getEncodedAdminSessionSecret());
}

export async function verifyAdminSessionToken(
  token: string | undefined,
): Promise<AdminSessionState> {
  if (!token) {
    return emptyAdminSessionState;
  }

  try {
    const { payload } = await jwtVerify(token, getEncodedAdminSessionSecret(), {
      algorithms: ['HS256'],
    });
    const adminPayload = payload as AdminSessionPayload;
    const userID = typeof adminPayload.userID === 'string' ? adminPayload.userID : null;
    const role = normalizeAdminRole(adminPayload.role);
    const scopes = normalizeAdminScopes(adminPayload.scopes);
    const sessionVersion =
      typeof adminPayload.sessionVersion === 'number' ? adminPayload.sessionVersion : null;
    const expiresAt = typeof adminPayload.exp === 'number'
      ? new Date(adminPayload.exp * 1000)
      : null;

    if (
      !userID ||
      !role ||
      !scopes.length ||
      !sessionVersion ||
      !expiresAt ||
      expiresAt <= new Date()
    ) {
      return {
        ...emptyAdminSessionState,
        shouldClearCookie: true,
      };
    }

    return {
      isAuthenticated: true,
      userID,
      role,
      scopes,
      sessionVersion,
      expiresAt,
      shouldClearCookie: false,
    };
  } catch {
    return {
      ...emptyAdminSessionState,
      shouldClearCookie: true,
    };
  }
}
