import { z } from 'zod';

export const signUpFormSchema = z
  .object({
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
    password: z
      .string({
        required_error: 'Password is required',
        invalid_type_error: 'Password must be a string',
      })
      .min(8, {
        message: `Must be at least 8 characters`,
      })
      .trim()
      .regex(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/, {
        message:
          'Must also contain an uppercase letter, a number, and a symbol',
      }),
    confirm_password: z
      .string({
        required_error: 'Please repeat passowrd',
        invalid_type_error: 'Password must be a string',
      })
      .min(8, {
        message: `Must be at least 8 characters`,
      })
      .trim()
      .regex(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/, {
        message:
          'Must also contain an uppercase letter, a number, and a symbol',
      }),
    terms_and_policy: z
      .boolean({
        required_error: 'Accept terms and conditions to proceed',
        invalid_type_error: 'Terms and Policy Must be a boolean',
      })
      .default(false),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
  });

export type SignUpFormSchemaType = z.infer<typeof signUpFormSchema>;
