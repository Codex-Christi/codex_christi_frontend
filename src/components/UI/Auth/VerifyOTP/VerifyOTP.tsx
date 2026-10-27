'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Form } from '@/components/UI/primitives/form';
import { verifyOTPSchema, type verifyOTPSchemaType } from '@/lib/formSchemas/verifyOTPSchema';
import { useVerifyOTP, useResendOTP } from '@/lib/hooks/authHooks/useVerifyOTP';
import { useSearchParams } from 'next/navigation';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/UI/primitives/input-otp';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { SubmitButton } from '../FormActionButtons';
import { EmailInput } from '../FormFields';

export default function VerifyOTP() {
  const verify = useVerifyOTP();
  const resend = useResendOTP();
  const search = useSearchParams();
  const form = useForm<verifyOTPSchemaType>({
    resolver: zodResolver(verifyOTPSchema),
    defaultValues: { email: search.get('email') ?? '', otp: '' },
  });
  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => verify.verifyOTP(values))}
        className='mx-auto my-12 w-4/5 max-w-[425px] space-y-6'
      >
        <h1 className='text-center text-2xl font-semibold'>Verify your email</h1>
        <EmailInput currentZodForm={form} inputName='email' />
        <Controller
          name='otp'
          control={form.control}
          render={({ field }) => (
            <InputOTP
              aria-label='Verification code'
              maxLength={6}
              value={field.value}
              onChange={field.onChange}
              pattern={REGEXP_ONLY_DIGITS}
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }, (_, index) => (
                  <InputOTPSlot index={index} key={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          )}
        />
        {form.formState.errors.otp && (
          <p role='alert' className='text-sm text-red-400'>
            Enter the six-digit code.
          </p>
        )}
        <button
          type='button'
          className='text-sm underline disabled:opacity-50'
          disabled={verify.isLoading || resend.isLoading || resend.retryIn > 0}
          onClick={async () => {
            if (await form.trigger('email'))
              await resend.resendOTP({ email: form.getValues('email') });
          }}
        >
          {resend.retryIn
            ? `Resend in ${resend.retryIn}s`
            : resend.isLoading
              ? 'Sending...'
              : 'Resend code'}
        </button>
        <SubmitButton
          name='Verify'
          textValue={verify.isLoading ? 'Verifying...' : 'Verify'}
          disabled={verify.isLoading || resend.isLoading}
        />
      </form>
    </Form>
  );
}
