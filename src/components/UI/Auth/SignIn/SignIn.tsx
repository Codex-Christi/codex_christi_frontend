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
import GoogleIcon from '@/components/UI/general/IconComponents/GoogleIcon';
import AppleIcon from '@/components/UI/general/IconComponents/AppleIcon';
import GitHubIcon from '@/components/UI/general/IconComponents/GitHubIcon';
import { useHasMounted } from '@/lib/hooks/useHasMounted';
import { getMainSiteUrl, isShopSiteHostname } from '@/lib/siteBaseUrls';
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
  const hasMounted = useHasMounted();
  const noticeShownRef = useRef(false);
  const isCodexChristiShop =
    hasMounted && isShopSiteHostname(window.location.hostname);
  const signUpHref =
    isCodexChristiShop && hasMounted
      ? `${getMainSiteUrl('/auth/signup')}?redirect=${encodeURIComponent(window.location.href)}`
      : '/auth/signup';

  const signInForm = useForm<signInSchemaType>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
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
          onSubmit={signInForm.handleSubmit(signInFormSubmitHandler)}
          className={`w-[80%] max-w-[375px] mt-12 !font-inter
                    sm:w-[70%] sm:max-w-[400px]
                    md:w-[50%] md:max-w-[410px]
                    lg:w-full lg:max-w-[425px]
                    mx-auto relative mb-12`}
        >
          <EmailInput currentZodForm={signInForm} inputName='email' />

          <PasswordInput currentZodForm={signInForm} inputName='password' />

          <SubmitButton
            name='Submit Button'
            textValue={isSubmitting ? 'Logging in...' : 'Log In'}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          />
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
            href={signUpHref}
          >
            Sign Up
          </Link>
        </p>
      </div>
    </>
  );
};

export default SignIn;
