import { z } from 'zod';

const stringField = (requiredMessage: string, invalidTypeMessage = requiredMessage) =>
  z.string({
    error: (issue) => (issue.input === undefined ? requiredMessage : invalidTypeMessage),
  });

export const SignUpFormSchema = z.object({
  firstname: stringField('First name is required', 'First name must be a string')
    .min(3, { message: 'Must be 3 or more characters long' })
    .trim()
    .regex(/^[A-Za-zÀ-ÖØ-öø-ÿ'\- ]{1,50}( [A-Za-zÀ-ÖØ-öø-ÿ'\- ]{1,50})?$/gm, {
      message: 'Invalid first name format.',
    }),
  lastname: stringField('Last name is required', 'Last name must be a string')
    .min(3, { message: 'Must be 3 or more characters long' })
    .trim()
    .regex(/^[A-Za-zÀ-ÖØ-öø-ÿ'\- ]{1,50}( [A-Za-zÀ-ÖØ-öø-ÿ'\- ]{1,50})?$/gm, {
      message: 'Invalid last name format.',
    }),
  email: stringField('Email is required')
    .email({
      message: 'Invalid email address.',
    })
    .trim(),
  password: stringField('Password is required', 'Password must be a string')
    .min(8, {
      message: `Must be at least 8 characters`,
    })
    .trim()
    .regex(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/, {
      message: 'Must also contain an uppercase letter, a number, and a symbol',
    }),
  confirm_password: stringField('Please repeat passowrd', 'Password must be a string')
    .min(8, {
      message: `Must be at least 8 characters`,
    })
    .trim()
    .regex(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/, {
      message: 'Must also contain an uppercase letter, a number, and a symbol',
    }),
  terms_and_policy: z.literal(true).refine((val) => val === true, {
    message: 'Accept terms and conditions to proceed',
  }),
});

export const SignUpFormSchemaWithRefine = SignUpFormSchema.refine(
  (data) => data.password === data.confirm_password,
  {
    message: "Passwords don't match",
    path: ['confirm_password'],
  }
);

export type SignUpFormSchemaWithRefineType = z.infer<
  typeof SignUpFormSchemaWithRefine
>;
