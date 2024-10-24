import ForgotPassword from '@/components/UI/Auth/ForgotPassword/ForgotPassword';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Forgot Password | Codex Christi',
    description: 'Sign up as a renonwned Christian Creative',
};

const Index = (): JSX.Element => {
    return (
        <ForgotPassword />
    );
};

export default Index;
