import ForgotPassword from '@/components/UI/Auth/ForgotPassword/ForgotPassword';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Forgot Password | Codex Christi',
    description: 'Enter your email to reset your password',
};

const Index = (): JSX.Element => {
    return (
        <ForgotPassword />
    );
};

export default Index;
