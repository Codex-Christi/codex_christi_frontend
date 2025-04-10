'use server';

import 'server-only';
import { cookies } from 'next/headers';
import { JWTPayload, SignJWT, jwtVerify } from 'jose';
import { jwtDecode } from 'jwt-decode';

// Consts
const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

// Interfaces
interface TokenInterface {
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
function convertIatToDate(iat: number) {
  return new Date(iat * 1000);
}

// Cookie Setter from next/headers
async function setCookie(cookie: string, name: string, expiresAt: Date) {
  const cookieStore = await cookies();

  cookieStore.set(name, cookie, {
    httpOnly: true,
    secure: true,
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });
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
    expiresAt: convertIatToDate(accessExp),
    mainAccessToken: accessToken,
  });
  const encodedRefreshToken = await encrypt({
    expiresAt: convertIatToDate(refreshExp),
    mainRefreshToken: refreshToken,
  });

  setCookie(sessionObj, 'session', convertIatToDate(accessExp));
  setCookie(encodedRefreshToken, 'refreshToken', convertIatToDate(refreshExp));
}
