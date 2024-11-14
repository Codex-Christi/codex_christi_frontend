import SignIn from '@/components/UI/Auth/SignIn/SignIn';
import { Metadata } from 'next';
import LoggedinProvider from '@/components/UI/Providers/LoggedinProvider';

export const metadata: Metadata = {
  title: 'Sign In | Codex Christi',
  description: 'Sign in to connect with other Christian Creatives',
};

const SignInPage = (): JSX.Element => {
  return (
    <LoggedinProvider>
      <SignIn />
    </LoggedinProvider>
  );
};

export default SignInPage;
