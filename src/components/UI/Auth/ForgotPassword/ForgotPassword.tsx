'use client';

import { PasswordResetLogo } from '@/components/AuthLogo';
import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Form } from '@/components/UI/primitives/form';
import { EmailInput } from '@/components/UI/Auth/FormFields';
import { SubmitButton } from '@/components/UI/Auth/FormActionButtons';
import { useLogin } from '@/lib/hooks/authHooks/useLogin';
import { z } from 'zod';

const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email({
      message: 'Invalid email address.',
    })
    .trim(),
});

export type ForgotPasswordSchemaType = z.infer<typeof forgotPasswordSchema>;

const ForgotPassword = () => {
  const { login } = useLogin();

  const forgotPasswordForm = useForm<ForgotPasswordSchemaType>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
    mode: 'all',
    reValidateMode: 'onBlur',
  });

  //   Signup form submit handler
  const forgotPasswordFormSubmitHandler: SubmitHandler<
    ForgotPasswordSchemaType
  > = async (fieldValues, event) => {
    // Prevent default first
    event?.preventDefault();

    const { email } = fieldValues;

    const userSendData = {
      email,
    };

    console.log(userSendData);
  };

  return (
    <Form {...forgotPasswordForm}>
      <form
        onSubmit={forgotPasswordForm.handleSubmit(
          forgotPasswordFormSubmitHandler
        )}
        className={`mt-12 px-4 sm:px-0 !font-montserrat
                    sm:w-[70%] sm:max-w-[400px]
                    md:w-[50%] md:max-w-[410px]
                    lg:w-[100%] lg:max-w-[425px]
                    mx-auto relative`}
      >
        <h1 className='text-bold text-3xl text-center mb-8'>Forgot Password</h1>

        <PasswordResetLogo />

        <EmailInput
          currentZodForm={forgotPasswordForm}
          inputName='email'
          label='Enter your email address'
        />

        <SubmitButton textValue='Next' />
      </form>
    </Form>
  );
};

export default ForgotPassword;
