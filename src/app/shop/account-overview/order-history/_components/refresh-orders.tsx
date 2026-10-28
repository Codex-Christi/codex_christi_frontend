'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import styles from '../orderHistory.module.css';

export default function RefreshOrders() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type='button'
      className={styles.iconButton}
      disabled={pending}
      title='Refresh saved order data'
      aria-label='Refresh saved order data'
      aria-busy={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw size={18} />
    </button>
  );
}
