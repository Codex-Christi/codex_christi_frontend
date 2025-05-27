'use client';

import LoggedinProvider from '@/components/UI/Providers/LoggedinProvider';
import SignIn from '@/components/UI/Auth/SignIn/SignIn';
import { useEffect } from 'react';
import { toast } from 'sonner';

export default function Launcher() {
  useEffect(() => {
    const toastID = toast.message('INFO', {
      description: 'Please sign in to continue.',
      duration: 5000,
      icon: '🔑',
      action: {
        label: 'Close',
        onClick: () => toast.dismiss(toastID),
      },
      position: 'top-right',
    });
  }, []);

  // Main Component
  return (
    <LoggedinProvider>
      <SignIn />;
    </LoggedinProvider>
  );
}
