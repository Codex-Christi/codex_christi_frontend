import { z } from 'zod';
import type { ShopCheckoutStoreInterface } from '@/stores/shop_stores/checkoutStore';
import type { BillingAddressInterface } from '@/lib/paypal/createPayPalOrder';

const requiredText = (label: string, maximum: number) =>
  z.string().trim().min(1, `${label} is required.`).max(maximum, `${label} is too long.`);

export const checkoutDeliveryAddressSchema = z.object({
  addressLine1: requiredText('Street address', 100),
  addressLine2: z.string().trim().max(100, 'Address line 2 is too long.').optional(),
  adminArea1: requiredText('State / province', 50),
  adminArea2: requiredText('City / town', 50),
  postalCode: requiredText('Postal code', 20),
});

export const checkoutBillingAddressSchema = checkoutDeliveryAddressSchema.extend({
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Choose a billing country.'),
});

export function billingAddressFromDelivery(
  address: ShopCheckoutStoreInterface['delivery_address'],
  countryCode: string,
): BillingAddressInterface {
  return {
    addressLine1: address.shipping_address_line_1?.trim() ?? '',
    addressLine2: address.shipping_address_line_2?.trim() ?? '',
    adminArea1: address.shipping_state?.trim() ?? '',
    adminArea2: address.shipping_city?.trim() ?? '',
    countryCode,
    postalCode: address.zip_code?.trim() ?? '',
  };
}
