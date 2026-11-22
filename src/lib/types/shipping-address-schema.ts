import { z } from 'zod';
import { isUsCountry, normalizeUsState } from '@/lib/shop/address/usStates';

export const shippingAddressSchema = z
  .object({
    shipping_state: z
      .string()
      .trim()
      .min(1, 'State is required')
      .min(2, 'State must be at least 2 characters')
      .max(50, 'State must be less than 50 characters'),

    shipping_city: z
      .string()
      .trim()
      .min(1, 'City is required')
      .min(2, 'City must be at least 2 characters')
      .max(50, 'City must be less than 50 characters'),

    shipping_address: z
      .string()
      .trim()
      .min(1, 'Street address is required')
      .min(5, 'Street address must be at least 5 characters')
      .max(200, 'Street address must be less than 200 characters'),

    shipping_country: z
      .string()
      .trim()
      .min(1, 'Country is required')
      .min(2, 'Country must be at least 2 characters')
      .max(50, 'Country must be less than 50 characters'),
  })
  .superRefine((address, context) => {
    if (isUsCountry(address.shipping_country) && !normalizeUsState(address.shipping_state)) {
      context.addIssue({
        code: 'custom',
        path: ['shipping_state'],
        message: 'Choose a valid US state or territory.',
      });
    }
  });

export type ShippingAddressFormData = z.infer<typeof shippingAddressSchema>;
