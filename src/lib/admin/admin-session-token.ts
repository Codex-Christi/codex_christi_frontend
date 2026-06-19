import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import {
  getAdminSessionSecret,
  type AdminRole,
  type AdminScope,
} from './admin-config';

export type AdminSessionState = {
  isAuthenticated: boolean;
  userID: string | null;
  role: AdminRole | null;
  scopes: AdminScope[];
  expiresAt: Date | null;
  shouldClearCookie: boolean;
};

type AdminSessionPayload = JWTPayload & {
  userID?: string;
  role?: AdminRole;
  scopes?: AdminScope[];
};

const emptyAdminSessionState: AdminSessionState = {
  isAuthenticated: false,
  userID: null,
  role: null,
  scopes: [],
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
  expiresAt,
}: {
  userID: string;
  role: AdminRole;
  scopes: AdminScope[];
  expiresAt: Date;
}) {
  return new SignJWT({ userID, role, scopes })
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
    const role = adminPayload.role === 'super_admin' ? adminPayload.role : null;
    const scopes = Array.isArray(adminPayload.scopes)
      ? adminPayload.scopes.filter((scope): scope is AdminScope => scope === 'shop')
      : [];
    const expiresAt = typeof adminPayload.exp === 'number'
      ? new Date(adminPayload.exp * 1000)
      : null;

    if (!userID || !role || !scopes.length || !expiresAt || expiresAt <= new Date()) {
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

