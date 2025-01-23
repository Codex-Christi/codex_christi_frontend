import { ReactNode } from 'react';

export default function ShopRootLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <h1>Hello</h1>
      {children}
    </div>
  );
}
