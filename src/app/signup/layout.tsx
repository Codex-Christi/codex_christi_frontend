import { Metadata } from 'next';
import DefaultPageWrapper from '@/components/UI/general/DefaultPageWrapper';
import { FC, ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Sign Up | Codex Christi',
  description: 'Sign up as a renonwned Christian Creative',
};

const SignupLayout: FC<{ children: ReactNode }> = ({ children }) => {
  return <DefaultPageWrapper>{children}</DefaultPageWrapper>;
};

export default SignupLayout;
