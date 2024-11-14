import { FC } from 'react';
import SignUpMainComponent from '@/components/UI/Auth/SignUp';
import { Metadata } from 'next';
import LoggedinProvider from '@/components/UI/Providers/LoggedinProvider';

export const metadata: Metadata = {
  title: 'Sign Up | Codex Christi',
  description: 'Sign up as a renonwned Christian Creative',
};

const SignUpPage: FC = () => {
  return (
    <LoggedinProvider>
      <SignUpMainComponent />
    </LoggedinProvider>
  );
};

export default SignUpPage;
