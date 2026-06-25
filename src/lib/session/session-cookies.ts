import { JWTPayload, SignJWT, jwtVerify } from 'jose';
import { jwtDecode } from 'jwt-decode';

export const SESSION_COOKIE_NAME = 'session';
export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
export const SESSION_REFRESH_GUARD_PARAM = '__session_refreshed';

export interface TokenInterface {
  token_type: 'access' | 'refresh';
  exp: number;
  iat: number;
  user_id?: string;
}

export interface AuthSessionPayload extends JWTPayload {
  version?: 1;
  userID?: string;
  mainAccessToken?: string | null;
  mainRefreshToken?: string | null;
}

export interface AuthCookieOptions {
  httpOnly: true;
  secure: boolean;
  expires: Date;
  sameSite: 'lax';
  path: '/';
  maxAge?: number;
}

export interface AuthCookieDefinition {
  name: typeof SESSION_COOKIE_NAME | typeof REFRESH_TOKEN_COOKIE_NAME;
  value: string;
  options: AuthCookieOptions;
}

export interface BuiltAuthSessionCookies {
  userID: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
  cookies: [AuthCookieDefinition, AuthCookieDefinition];
}

type CookieRequestHeaders = Pick<Headers, 'get'>;

function getEncodedSessionSecret() {
  const secretKey = process.env.SESSION_SECRET;

  if (!secretKey) {
    throw new Error('SESSION_SECRET is not configured.');
  }

  return new TextEncoder().encode(secretKey);
}

export function convertIatToDate(iat: number) {
  return new Date(iat * 1000);
}

function getFirstHeaderValue(value: string | null) {
  return value?.split(',')[0]?.trim().toLowerCase() ?? null;
}

function getForwardedProto(value: string | null) {
  const protoMatch = value?.match(/(?:^|[;,]\s*)proto="?([^";,\s]+)"?/i);

  return protoMatch?.[1]?.toLowerCase() ?? null;
}

export function shouldUseSecureCookie(requestHeaders?: CookieRequestHeaders) {
  const forwardedProto = requestHeaders
    ? (getFirstHeaderValue(requestHeaders.get('x-forwarded-proto')) ??
      getForwardedProto(requestHeaders.get('forwarded')))
    : null;

  if (forwardedProto) {
    return forwardedProto === 'https';
  }

  return process.env.NODE_ENV !== 'development';
}

export function getAuthCookieOptions(
  expiresAt: Date,
  requestHeaders?: CookieRequestHeaders,
): AuthCookieOptions {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookie(requestHeaders),
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  };
}

export function getExpiredAuthCookieOptions(
  requestHeaders?: CookieRequestHeaders,
): AuthCookieOptions {
  return {
    ...getAuthCookieOptions(new Date(0), requestHeaders),
    maxAge: 0,
  };
}

export async function encryptSessionPayload(
  payload: AuthSessionPayload,
  expiresAt: Date,
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getEncodedSessionSecret());
}

export async function decryptSessionToken(session: string | undefined = '') {
  if (!session) {
    return undefined;
  }

  try {
    const { payload } = await jwtVerify(session, getEncodedSessionSecret(), {
      algorithms: ['HS256'],
    });

    return payload as AuthSessionPayload;
  } catch (error: Error | unknown) {
    console.log(`Failed to verify session. Reason: ${error}`);
    return undefined;
  }
}

function decodeDjangoToken(token: string, label: 'access' | 'refresh') {
  if (!token) {
    throw new Error(`Missing ${label} token.`);
  }

  return jwtDecode<TokenInterface>(token);
}

export async function buildAuthSessionCookies({
  accessToken,
  refreshToken,
  requestHeaders,
}: {
  accessToken: string;
  refreshToken: string;
  requestHeaders?: CookieRequestHeaders;
}): Promise<BuiltAuthSessionCookies> {
  const decryptedAccessToken = decodeDjangoToken(accessToken, 'access');
  const decryptedRefreshToken = decodeDjangoToken(refreshToken, 'refresh');

  const { exp: accessExp, user_id } = decryptedAccessToken;
  const { exp: refreshExp } = decryptedRefreshToken;

  if (!user_id) {
    throw new Error('Access token is missing user_id.');
  }

  const accessExpiresAt = convertIatToDate(accessExp);
  const refreshExpiresAt = convertIatToDate(refreshExp);

  const sessionObj = await encryptSessionPayload(
    {
      version: 1,
      userID: user_id,
      mainAccessToken: accessToken,
    },
    accessExpiresAt,
  );
  const encodedRefreshToken = await encryptSessionPayload(
    {
      version: 1,
      mainRefreshToken: refreshToken,
    },
    refreshExpiresAt,
  );

  return {
    userID: user_id,
    accessExpiresAt,
    refreshExpiresAt,
    cookies: [
      {
        name: SESSION_COOKIE_NAME,
        value: sessionObj,
        options: getAuthCookieOptions(accessExpiresAt, requestHeaders),
      },
      {
        name: REFRESH_TOKEN_COOKIE_NAME,
        value: encodedRefreshToken,
        options: getAuthCookieOptions(refreshExpiresAt, requestHeaders),
      },
    ],
  };
}

export function buildExpiredAuthCookies(
  requestHeaders?: CookieRequestHeaders,
): [AuthCookieDefinition, AuthCookieDefinition] {
  const options = getExpiredAuthCookieOptions(requestHeaders);

  return [
    {
      name: SESSION_COOKIE_NAME,
      value: '',
      options,
    },
    {
      name: REFRESH_TOKEN_COOKIE_NAME,
      value: '',
      options,
    },
  ];
}

export async function getMainAccessTokenFromCookieValue(cookieValue?: string) {
  const payload = await decryptSessionToken(cookieValue);

  return typeof payload?.mainAccessToken === 'string' ? payload.mainAccessToken : null;
}

export async function getMainRefreshTokenFromCookieValue(cookieValue?: string) {
  const payload = await decryptSessionToken(cookieValue);

  return typeof payload?.mainRefreshToken === 'string' ? payload.mainRefreshToken : null;
}
