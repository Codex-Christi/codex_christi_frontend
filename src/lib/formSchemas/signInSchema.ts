import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z
    .string()
    .trim()
    .regex(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/, {
      message: 'Must also contain an uppercase letter, a number, and a symbol',
    }),
});

export type signInSchemaType = z.infer<typeof signInSchema>;
