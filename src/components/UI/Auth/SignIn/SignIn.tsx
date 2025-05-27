'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Form } from '@/components/UI/primitives/form';
import { signInSchema, signInSchemaType } from '@/lib/formSchemas/signInSchema';
import { EmailInput, PasswordInput } from '@/components/UI/Auth/FormFields';
import { SubmitButton } from '@/components/UI/Auth/FormActionButtons';
import { useLogin } from '@/lib/hooks/authHooks/useLogin';
import Link from 'next/link';
import GoogleIcon from '@/components/UI/general/IconComponents/GoogleIcon';
import AppleIcon from '@/components/UI/general/IconComponents/AppleIcon';
import GitHubIcon from '@/components/UI/general/IconComponents/GitHubIcon';
import { useEffect, useState } from 'react';

// Main Component
const SignIn = () => {
  const { login } = useLogin();
  const [isClient, setIsClient] = useState(false);
  const isCodexChristiShop = isClient
    ? window.location.hostname.includes('localhost')
    : false;

  useEffect(() => {
    setIsClient(true);
  }, []);

  const signInForm = useForm<signInSchemaType>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'all',
    reValidateMode: 'onBlur',
  });

  //   Signup form submit handler
  const signInFormSubmitHandler: SubmitHandler<signInSchemaType> = async (
    fieldValues,
    event
  ) => {
    // Prevent default first
    event?.preventDefault();

    const { email, password } = fieldValues;

    const userSendData = {
      email,
      password,
    };

    await login(userSendData);
  };

  // Main JSX
  return (
    <>
      <Form {...signInForm}>
        <form
          onSubmit={signInForm.handleSubmit(signInFormSubmitHandler)}
          className={`w-[80%] max-w-[375px] mt-12 !font-inter
                    sm:w-[70%] sm:max-w-[400px]
                    md:w-[50%] md:max-w-[410px]
                    lg:w-full lg:max-w-[425px]
                    mx-auto relative mb-12`}
        >
          <EmailInput currentZodForm={signInForm} inputName='email' />

          <PasswordInput currentZodForm={signInForm} inputName='password' />

          <SubmitButton name='Submit Button' textValue='Log In' />
        </form>
      </Form>

      <div className='mt-16 space-y-12 text-center'>
        <div className='space-y-4 lg:w-1/2 lg:mx-auto'>
          <p>or Sign In with</p>

          <div className='flex place-content-center justify-between gap-4 mx-auto'>
            <Link href=''>
              <GoogleIcon />
            </Link>

            <Link href=''>
              <AppleIcon />
            </Link>

            <Link href=''>
              <GitHubIcon />
            </Link>
          </div>
        </div>

        <p className='w-full text-center'>
          Don’t have an account?{' '}
          <Link
            className='text-white font-semibold'
            type='button'
            href={
              isCodexChristiShop
                ? `https://codexchristi.org/auth/signup?redirect=${window.location.href}`
                : '/auth/signup'
            }
          >
            Sign Up
          </Link>
        </p>
      </div>
    </>
  );
};

export default SignIn;
