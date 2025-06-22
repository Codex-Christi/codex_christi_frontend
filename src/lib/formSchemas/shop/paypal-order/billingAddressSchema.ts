// lib/validators/billingAddress.ts
import { z } from 'zod';

export const billingAddressSchema = z.object({
  addressLine1: z
    .string()
    .min(1, 'Address Line 1 is required')
    .max(100, 'Too long'),
  addressLine2: z.string().max(100, 'Too long').optional(),
  adminArea1: z
    .string()
    .min(1, 'State/Province is required')
    .max(50, 'Too long'),
  adminArea2: z.string().min(1, 'City/Town is required').max(50, 'Too long'),
  countryCode: z
    .string()
    .length(2, 'Must be a valid 2-letter country code (e.g., US)'),
  postalCode: z.string().min(3, 'Postal Code is required').max(20, 'Too long'),
});

export type BillingAddress = z.infer<typeof billingAddressSchema>;
