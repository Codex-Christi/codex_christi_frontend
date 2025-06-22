'use server';
import { CartVariant } from '@/stores/shop_stores/cartStore';
import { headers } from 'next/headers';
import { cache } from 'react';
import 'server-only';

interface BillingAddressInterfacebillingAddress {
  addressLine1: string;
  addressLine2: string;
  adminArea1: string;
  adminArea2: string;
  countryCode: string;
  postalCode: string;
}

export const createOrderAction = cache(
  async (
    cart: CartVariant[],
    billingAddress: BillingAddressInterfacebillingAddress,
    customer?: { name: string; email: string }
  ) => {
    if (!cart) {
      throw new Error('Missing cart');
    } else if (!Array.isArray(cart)) {
      throw new Error('Cart must be an array');
    }
    if (!billingAddress) {
      throw new Error('Missing billingAddress');
    }
    //   if (!customer) {
    //     throw new Error('Missing customer');
    //   }

    //   Main Fetcher

    const headersList = await headers();
    const protocol = headersList.get('x-forwarded-proto') || 'http'; // Default to http if header is missing
    const host = headersList.get('host');

    console.log(`${protocol}://${host}/next-api/paypal/orders/create-order`);

    const response = await fetch(
      `${protocol}://${host}/next-api/paypal/orders/create-order`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart,
          billingAddress,
          customer: { name: 'Saint', email: 'derer@wee.com' },
        }),
      }
    );

    if (!response.ok) {
      console.log(response);

      const errorText = await response.text();
      throw new Error(
        `Request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  }
);
