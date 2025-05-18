'use server';

import { cookies, headers } from 'next/headers';
import { JWTPayload, SignJWT, jwtVerify } from 'jose';
import { jwtDecode } from 'jwt-decode';

// Consts
const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

// Interfaces
export interface TokenInterface {
  token_type: 'access' | 'refresh';
  exp: number;
  iat: number;
  user_id: string;
}

interface PayloadInterface extends JWTPayload {
  userID?: string;
  expiresAt: Date;
  mainAccessToken?: string | null;
  mainRefreshToken?: string | null;
}

// Util funcs
// Conver IAT to Date
export async function convertIatToDate(iat: number) {
  return new Date(iat * 1000);
}

// Cookie Setter from next/headers
export async function setCookie(cookie: string, name: string, expiresAt: Date) {
  const host = (await headers()).get('host');
  const isMobileDevPhone =
    host?.includes('192.168.1.231:3000') ||
    host?.includes('192.168.207.195:3000');
  const isDevelopment = process.env.NODE_ENV === 'development';
  const cookieStore = await cookies();

  cookieStore.set(name, cookie, {
    httpOnly: true,
    secure: isDevelopment && isMobileDevPhone ? false : true,
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });
}

// Delete Cookie
export async function deleteCookie(name: string) {
  const cookieStore = await cookies();
  cookieStore.delete(name);
}

// Use 'jose' to encrypt session details
export async function encrypt(payload: PayloadInterface) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(payload.expiresAt)
    .sign(encodedKey);
}

// Use 'jose' to decrypt session details
export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error: Error | unknown) {
    console.log(`Failed to verify session. Reason: ${error}`);
  }
}

// Create the session
export async function createSession(accessToken: string, refreshToken: string) {
  const decryptedAccessToken = jwtDecode<TokenInterface>(
    accessToken ? accessToken : ''
  );
  const decryptedRefreshToken = jwtDecode<TokenInterface>(
    refreshToken ? refreshToken : ''
  );

  const { exp: accessExp, user_id } = decryptedAccessToken;
  const { exp: refreshExp } = decryptedRefreshToken;

  const sessionObj = await encrypt({
    userID: user_id,
    expiresAt: await convertIatToDate(accessExp),
    mainAccessToken: accessToken,
  });
  const encodedRefreshToken = await encrypt({
    expiresAt: await convertIatToDate(refreshExp),
    mainRefreshToken: refreshToken,
  });

  await setCookie(sessionObj, 'session', await convertIatToDate(accessExp));
  await setCookie(
    encodedRefreshToken,
    'refreshToken',
    await convertIatToDate(refreshExp)
  );
}

// Update Session

// Delete Session
export async function deleteSession() {
  await deleteCookie('session');
  await deleteCookie('refreshToken');
}

// Get cookie from server
export const getCookie = async (name: string) => {
  const cookieStore = await cookies();

  return cookieStore.get(name);
};
