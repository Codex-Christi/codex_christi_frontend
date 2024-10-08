import { z } from 'zod';

export const signUpFormSchema = z.object({
  firstname: z
    .string({
      required_error: 'First name is required',
      invalid_type_error: 'First name must be a string',
    })
    .min(3, { message: 'Must be 3 or more characters long' })
    .trim()
    .regex(/^[A-Za-zÀ-ÿ]+(?:[.'-]?[A-Za-zÀ-ÿ]+)*\s?$/gm, {
      message: 'Invalid first name format.',
    }),
  lastname: z
    .string({
      required_error: 'Last name is required',
      invalid_type_error: 'Last name must be a string',
    })
    .min(3, { message: 'Must be 3 or more characters long' })
    .trim()
    .regex(/^[A-Za-zÀ-ÿ]+(?:[.'-]?[A-Za-zÀ-ÿ]+)*\s?$/gm, {
      message: 'Invalid last name format.',
    }),
  email: z
    .string({ required_error: 'Email is required' })
    .email({
      message: 'Invalid email address.',
    })
    .trim(),
});

export type SignUpFormSchemaType = z.infer<typeof signUpFormSchema>;
