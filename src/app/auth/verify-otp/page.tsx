import VerifyOTP from '@/components/UI/Auth/VerifyOTP/VerifyOTP';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Verify OTP | Codex Christi',
    description: 'Verify registration OTP',
};

const VerifyOTPPage = (): JSX.Element => {
    return (
        <VerifyOTP />
    );
};

export default VerifyOTPPage;
