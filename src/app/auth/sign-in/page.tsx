import SignIn from '@/components/UI/Auth/SignIn/SignIn';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In | Codex Christi',
  description: 'Sign in to connect with other Christian Creatives',
};

const SignInPage = (): JSX.Element => {
  return <SignIn />;
};

export default SignInPage;
