import DefaultPageWrapper from '@/components/UI/general/DefaultPageWrapper';
import '../route-utilities.css';
import AuthFormLayout from '@/components/UI/Auth/AuthFormLayout';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <DefaultPageWrapper>
      <AuthFormLayout>{children}</AuthFormLayout>
    </DefaultPageWrapper>
  );
}
