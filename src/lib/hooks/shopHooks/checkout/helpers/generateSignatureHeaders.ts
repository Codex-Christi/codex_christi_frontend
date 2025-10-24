'use server';

import { HmacSHA256 } from 'crypto-js';

export async function generateSignatureHeaders() {
  const API_SECRET_KEY = process.env.NEXT_PUBLIC_SHOP_CHECKOUT_OTP_VERIFICATION_API_KEY; // Same as backend
  if (!API_SECRET_KEY) {
    throw new Error('API_SECRET_KEY is not defined');
  }
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = HmacSHA256(timestamp, API_SECRET_KEY).toString();

  return {
    'Content-Type': 'application/json',
    'X-API-Signature': `${signature}3`,
    'X-API-Timestamp': `${timestamp}`,
  };
}
