'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Form } from '@/components/UI/primitives/form';
import {
  resetPasswordSchema,
  type resetPasswordSchemaType,
} from '@/lib/formSchemas/resetPasswordSchema';
import { EmailInput, PasswordInput } from '../FormFields';
import { SubmitButton } from '../FormActionButtons';
import { usePasswordReset } from '@/lib/hooks/authHooks/usePasswordReset';
import { useSearchParams } from 'next/navigation';
import { useResendOTP } from '@/lib/hooks/authHooks/useVerifyOTP';

export default function ResetPassword() {
  const reset = usePasswordReset();
  const resend = useResendOTP('password-reset');
  const search = useSearchParams();
  const form = useForm<resetPasswordSchemaType>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: search.get('email') ?? '',
      otp: '',
      password: '',
      confirm_password: '',
    },
    mode: 'onBlur',
  });
  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(({ email, password, otp }) =>
          reset.resetPassword({ email, password, otp }),
        )}
        className='mx-auto my-12 w-4/5 max-w-[425px] space-y-6'
      >
        <h1 className='text-center text-2xl font-semibold'>Change password</h1>
        <EmailInput currentZodForm={form} inputName='email' />
        <PasswordInput currentZodForm={form} inputName='otp' />
        <PasswordInput currentZodForm={form} inputName='password' />
        <PasswordInput currentZodForm={form} inputName='confirm_password' />
        <button
          type='button'
          className='text-sm underline disabled:opacity-50'
          disabled={reset.isLoading || resend.isLoading || resend.retryIn > 0}
          onClick={async () => {
            if (await form.trigger('email'))
              await resend.resendOTP({ email: form.getValues('email') });
          }}
        >
          {resend.retryIn
            ? `Resend in ${resend.retryIn}s`
            : resend.isLoading
              ? 'Sending...'
              : 'Resend reset code'}
        </button>
        <SubmitButton
          name='Change Password'
          textValue={reset.isLoading ? 'Saving...' : 'Change Password'}
          disabled={reset.isLoading || resend.isLoading}
        />
      </form>
    </Form>
  );
}
