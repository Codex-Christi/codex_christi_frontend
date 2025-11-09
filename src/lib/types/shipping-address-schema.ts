import { z } from 'zod';
// import { isValidPhoneNumber } from 'react-phone-number-input';

export const shippingAddressSchema = z.object({
//   phone_number: z
//     .string()
//     .min(1, 'Phone number is required')
//     .refine((value) => isValidPhoneNumber(value), {
//       message: 'Invalid phone number',
//     }),

  shipping_state: z
    .string()
    .min(1, 'State is required')
    .min(2, 'State must be at least 2 characters')
    .max(50, 'State must be less than 50 characters'),

  shipping_city: z
    .string()
    .min(1, 'City is required')
    .min(2, 'City must be at least 2 characters')
    .max(50, 'City must be less than 50 characters'),

  shipping_address: z
    .string()
    .min(1, 'Street address is required')
    .min(5, 'Street address must be at least 5 characters')
    .max(200, 'Street address must be less than 200 characters'),

  shipping_country: z
    .string()
    .min(1, 'Country is required')
    .min(2, 'Country must be at least 2 characters')
    .max(50, 'Country must be less than 50 characters'),

//   directions: z.string().max(500, 'Directions must be less than 500 characters').optional(),
});

export type ShippingAddressFormData = z.infer<typeof shippingAddressSchema>;
