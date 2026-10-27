'use client';

import Link from 'next/link';
import SignUpForm from '@/components/UI/Auth/SignUp/SignUpForm';
import { useAuthRoutes } from '../AuthRoutesProvider';
import { useSearchParams } from 'next/navigation';
import { authFlowUrl, safeAuthReturnPath } from '@/lib/auth/domain-routing';
import { FC } from 'react';

const SignUpMainComponent: FC = () => {
  const routes = useAuthRoutes();
  const search = useSearchParams();
  return (
    <>
      <aside
        aria-label='Shop alpha notice'
        className='mx-auto mt-8 w-[80%] max-w-[425px] rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-center text-sm leading-6 text-amber-50 sm:w-[70%] md:w-[50%] lg:w-full'
      >
        <span className='font-semibold text-amber-200'>Shop alpha:</span> Creating your Codex
        Christi account also joins the shop alpha waitlist. Some shop features are still being
        completed and may not work fully.
      </aside>

      <SignUpForm />

      <div className='space-y-8 text-center'>
        <p>
          Already have an account?{' '}
          <Link
            className='font-bold'
            href={authFlowUrl(routes.login, {
              next: safeAuthReturnPath(search.get('next'), routes),
            })}
          >
            Login
          </Link>
        </p>
      </div>
    </>
  );
};

export default SignUpMainComponent;
