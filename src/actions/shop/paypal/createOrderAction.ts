'use server';
import { billingAddressSchema } from '@/lib/formSchemas/shop/paypal-order/billingAddressSchema';
import { CartVariant } from '@/stores/shop_stores/cartStore';
import { headers } from 'next/headers';
import { cache } from 'react';
import 'server-only';

export interface BillingAddressInterface {
  addressLine1: string;
  addressLine2: string;
  adminArea1: string;
  adminArea2: string;
  countryCode: string;
  postalCode: string;
}

type OptionalBillingConfig<T extends boolean> = T extends true
  ? { billingAddress: BillingAddressInterface }
  : null | object;

export const createOrderAction = cache(
  async <T extends boolean>(
    acceptBilling: T,
    cart: CartVariant[],
    billingAddress: OptionalBillingConfig<T>,
    customer?: { name: string; email: string }
  ) => {
    // Validate Cart
    if (!cart) {
      throw new Error('Missing cart');
    } else if (!Array.isArray(cart)) {
      throw new Error('Cart must be an array');
    } else if (cart.length === 0) {
      throw new Error('Cart cannot be empty');
    } else if (
      !cart.every(
        (item) =>
          item && typeof item === 'object' && 'id' in item && 'quantity' in item
      )
    ) {
      throw new Error(
        'Each cart item must be a valid CartVariant with id and quantity'
      );
    }

    // Validate Billing Address
    if (acceptBilling) {
      if (!billingAddress) {
        throw new Error('Missing billingAddress');
      }
      const parseResult = billingAddressSchema.safeParse(billingAddress);
      if (!parseResult.success) {
        const errorObj = parseResult.error.flatten().fieldErrors;
        const errorMessages = Object.entries(errorObj)
          .map(([key, value]) => `${key}: ${(value || []).join(', ')}`)
          .join('; ');
        throw new Error(errorMessages);
      }
    }
    //   if (!customer) {
    //     throw new Error('Missing customer');
    //   }

    //   Main Fetcher

    const headersList = await headers();
    const protocol = headersList.get('x-forwarded-proto') || 'http'; // Default to http if header is missing
    const host = headersList.get('host');

    try {
      const response = await fetch(
        `${protocol}://${host}/next-api/paypal/orders/create-order`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cart,
            billingAddress: acceptBilling ? billingAddress : undefined,
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
    } catch (err) {
      throw err;
    }
  }
);
