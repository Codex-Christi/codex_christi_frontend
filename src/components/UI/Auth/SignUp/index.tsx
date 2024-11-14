import Link from 'next/link';
import SignUpForm from '@/components/UI/Auth/SignUp/SignUpForm';
import GoogleIcon from '@/components/UI/general/IconComponents/GoogleIcon';
import AppleIcon from '@/components/UI/general/IconComponents/AppleIcon';
import GitHubIcon from '@/components/UI/general/IconComponents/GitHubIcon';
import { FC } from 'react';

const SignUpMainComponent: FC = () => {
  return (
    <>
      <SignUpForm />

      <div className='space-y-8 text-center'>
        <div className='space-y-4 lg:w-4/5 lg:mx-auto'>
          <p>or Sign Up with</p>

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

        <p>
          Already have an account?{' '}
          <Link className='font-bold' href='/auth/sign-in'>
            Login
          </Link>
        </p>
      </div>
    </>
  );
};

export default SignUpMainComponent;
