import VerifyOTP from '@/components/UI/Auth/VerifyOTP/VerifyOTP';
import { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Verify OTP | Codex Christi',
  description: 'Verify registration OTP',
};

const VerifyOTPPage = (): JSX.Element => {
  return (
    <Suspense>
      <VerifyOTP />
    </Suspense>
  );
};

export default VerifyOTPPage;
