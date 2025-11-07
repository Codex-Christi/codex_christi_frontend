// lib/crypto/cookieCipher.ts
import CryptoJS from 'crypto-js';

// Cookie is client-readable anyway; this key provides obfuscation.
// Use NEXT_PUBLIC_ so both server and client can read it.
const KEY = process.env.NEXT_PUBLIC_CART_KEY || 'dev-insecure-key';

export function encryptCookieJSON(obj: unknown): string {
  const json = JSON.stringify(obj);
  return CryptoJS.AES.encrypt(json, KEY).toString();
}

export function decryptCookieJSON<T = unknown>(cipher: string): T | null {
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, KEY);
    const json = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
