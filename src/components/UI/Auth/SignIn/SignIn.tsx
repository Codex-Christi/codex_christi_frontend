'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useEffect, useRef } from 'react';
import { Form } from '@/components/UI/primitives/form';
import { signInSchema, signInSchemaType } from '@/lib/formSchemas/signInSchema';
import { EmailInput, PasswordInput } from '@/components/UI/Auth/FormFields';
import { SubmitButton } from '@/components/UI/Auth/FormActionButtons';
import { useLogin } from '@/lib/hooks/authHooks/useLogin';
import Link from 'next/link';
import { useAuthRoutes } from '../AuthRoutesProvider';
import { authFlowUrl, safeAuthReturnPath } from '@/lib/auth/domain-routing';
import { useSearchParams } from 'next/navigation';
import successToast from '@/lib/success-toast';
import errorToast from '@/lib/error-toast';

type AuthNotice = {
  key: string;
  title: string;
  description: string;
  tone?: 'success' | 'message';
};

const AUTH_REDIRECT_NOTICES: AuthNotice[] = [
  {
    key: 'from-password-reset',
    title: 'Password changed',
    description: 'Sign in with your new password.',
    tone: 'success',
  },
  {
    key: 'from-logout',
    title: 'Logged out',
    description: 'You have been signed out.',
    tone: 'success',
  },
  {
    key: 'sessionExp',
    title: 'Sign in required',
    description: 'Your session expired. Sign in to continue.',
  },
  {
    key: 'from-master-transfer',
    title: 'Sign in required',
    description: 'Your admin transfer is complete. Sign in again to continue.',
  },
];

function getAuthRedirectNotice(search: string) {
  const searchParams = new URLSearchParams(search);

  return AUTH_REDIRECT_NOTICES.find(({ key }) => searchParams.get(key) === 'true') ?? null;
}

// Main Component
const SignIn = () => {
  const { login, isLoading } = useLogin();
  const routes = useAuthRoutes();
  const search = useSearchParams();
  const noticeShownRef = useRef(false);
  const next = safeAuthReturnPath(search.get('next'), routes);
  const signupNext =
    routes.shop && next && !next.startsWith('/shop/') ? `/shop${next === '/' ? '' : next}` : next;
  const signUpHref = authFlowUrl(routes.signup, { next: signupNext });

  const signInForm = useForm<signInSchemaType>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: search.get('email') ?? '',
      password: '',
    },
    mode: 'all',
    reValidateMode: 'onBlur',
  });
  const isSubmitting = isLoading || signInForm.formState.isSubmitting;

  useEffect(() => {
    if (noticeShownRef.current) return;

    const notice = getAuthRedirectNotice(window.location.search);
    if (!notice) return;

    noticeShownRef.current = true;
    const toastOptions = {
      header: notice.title,
      message: notice.description,
      duration: 5000,
    };

    if (notice.tone === 'success') {
      successToast(toastOptions);
      return;
    }

    errorToast({ ...toastOptions, tone: 'message' });
  }, []);

  //   Signup form submit handler
  const signInFormSubmitHandler: SubmitHandler<signInSchemaType> = async (fieldValues, event) => {
    // Prevent default first
    event?.preventDefault();
    if (isSubmitting) return;

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
          noValidate
          onSubmit={signInForm.handleSubmit(signInFormSubmitHandler)}
          className={`w-[80%] max-w-[375px] mt-12 !font-inter
                    sm:w-[70%] sm:max-w-[400px]
                    md:w-[50%] md:max-w-[410px]
                    lg:w-full lg:max-w-[425px]
                    mx-auto relative mb-12`}
        >
          <EmailInput currentZodForm={signInForm} inputName='email' />

          <PasswordInput
            currentZodForm={signInForm}
            inputName='password'
            autoComplete='current-password'
          />
          <Link
            className='block text-right text-sm underline'
            href={authFlowUrl(routes.forgot, { next })}
          >
            Forgot password?
          </Link>

          <SubmitButton
            name='Submit Button'
            textValue={isSubmitting ? 'Logging in...' : 'Log In'}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          />
        </form>
      </Form>

      <div className='mt-16 space-y-12 text-center'>
        <p className='w-full text-center'>
          Don’t have an account?{' '}
          <Link className='text-white font-semibold' type='button' href={signUpHref}>
            Sign Up
          </Link>
        </p>
      </div>
    </>
  );
};

export default SignIn;
