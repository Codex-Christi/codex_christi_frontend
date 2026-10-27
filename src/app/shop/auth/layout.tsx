import AuthFormLayout from '@/components/UI/Auth/AuthFormLayout';
import type { ReactNode } from 'react';

export default function ShopAuthLayout({ children }: { children: ReactNode }) {
  return <AuthFormLayout shop>{children}</AuthFormLayout>;
}
