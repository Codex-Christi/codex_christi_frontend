import { z } from 'zod';

export const signUpFormSchema = z.object({
  fullname: z
    .string({
      required_error: 'Name is required',
      invalid_type_error: 'Name must be a string',
    })
    .min(5, { message: 'Must be 5 or more characters long' })
    .regex(
      /^(?:(?:[A-Za-z]|([,.'-]))(?!(?:.*?\1))){2,} +(?:(?:[A-Za-z]|([,.'-]))(?!(?:.*?\2))){2,}$/gm,
      { message: 'Invalid full name format.' }
    ),
});

export type SignUpFormSchemaType = z.infer<typeof signUpFormSchema>;
