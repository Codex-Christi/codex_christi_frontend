import 'server-only';
import CryptoJS from 'crypto-js';

function getCheckoutServerPostProcSecret() {
  const secret = process.env.SHOP_CHECKOUT_SERVER_ACTIONS_POST_PROCESSING_CRYPTO_SECRET;
  if (!secret) {
    throw new Error('SHOP_CHECKOUT_SERVER_ACTIONS_POST_PROCESSING_CRYPTO_SECRET is not configured');
  }
  return secret;
}

export function encryptForPostProcessingServerAction(text: string): string {
  return CryptoJS.AES.encrypt(text, getCheckoutServerPostProcSecret()).toString();
}

export function decryptForPostProcessingServerAction(data: string) {
  const bytes = CryptoJS.AES.decrypt(data, getCheckoutServerPostProcSecret());
  return bytes.toString(CryptoJS.enc.Utf8);
}

// Backward-compatible alias for older imports.
export const deryptForPostProcessingServerAction = decryptForPostProcessingServerAction;
