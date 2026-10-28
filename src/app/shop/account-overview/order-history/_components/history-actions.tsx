'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Link2, Loader2, RefreshCw } from 'lucide-react';
import { getAuthGeneration } from '@/lib/auth/session-generation';
import styles from '../orderHistory.module.css';

export function CopyReference({ value }: { value: string }) {
  const [message, setMessage] = useState('');
  return (
    <>
      <button
        type='button'
        className={styles.iconButton}
        title='Copy full order reference'
        aria-label='Copy full order reference'
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setMessage('Reference copied');
          } catch {
            setMessage('Select the order reference to copy it.');
          }
        }}
      >
        {message === 'Reference copied' ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <span className={styles.srOnly} role='status'>
        {message}
      </span>
    </>
  );
}

export function RefreshTracking({ orderToken }: { orderToken: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  return (
    <div className={styles.trackingAction}>
      <button
        type='button'
        className={styles.command}
        disabled={pending}
        aria-busy={pending}
        onClick={async () => {
          if (abort.current) return;
          const controller = new AbortController();
          abort.current = controller;
          const generation = getAuthGeneration();
          setPending(true);
          setMessage('Checking tracking…');
          try {
            const response = await fetch(
              `/next-api/shop/account/orders/${encodeURIComponent(orderToken)}/tracking`,
              { method: 'POST', signal: controller.signal },
            );
            const result = await response.json();
            if (controller.signal.aborted || getAuthGeneration() !== generation) return;
            setMessage(
              typeof result.message === 'string'
                ? result.message
                : 'Tracking is temporarily unavailable.',
            );
            if (response.ok) router.refresh();
          } catch {
            if (!controller.signal.aborted)
              setMessage('Tracking could not be checked. Your saved order is unchanged.');
          } finally {
            if (!controller.signal.aborted) setPending(false);
            abort.current = null;
          }
        }}
      >
        {pending ? <Loader2 size={16} className={styles.spin} /> : <RefreshCw size={16} />} Check
        tracking
      </button>
      <p role='status' className={styles.muted}>
        {message}
      </p>
    </div>
  );
}

export function LinkGuestOrder() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const submit = async (action: 'start' | 'verify') => {
    if (!form.current?.reportValidity() || abort.current) return;
    const controller = new AbortController();
    abort.current = controller;
    const generation = getAuthGeneration();
    setPending(true);
    setMessage('');
    try {
      const data = Object.fromEntries(new FormData(form.current));
      const response = await fetch('/next-api/shop/account/orders/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, action }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (controller.signal.aborted || generation !== getAuthGeneration()) return;
      setMessage(
        typeof result.message === 'string'
          ? result.message
          : 'Order linking is temporarily unavailable.',
      );
      if (response.ok && action === 'start') setSent(true);
      if (response.ok && typeof result.orderToken === 'string') {
        router.push(
          `/shop/account-overview/order-history/${encodeURIComponent(result.orderToken)}`,
        );
        router.refresh();
      }
    } catch {
      if (!controller.signal.aborted)
        setMessage('Order linking is temporarily unavailable. Please try again.');
    } finally {
      if (!controller.signal.aborted) setPending(false);
      abort.current = null;
    }
  };
  return (
    <details className={styles.guestLink}>
      <summary>
        <Link2 size={17} /> Link a guest order
      </summary>
      <form
        ref={form}
        className={styles.linkForm}
        onSubmit={(event) => {
          event.preventDefault();
          void submit(sent ? 'verify' : 'start');
        }}
      >
        <label>
          Order reference
          <input
            name='reference'
            required
            maxLength={128}
            pattern='[A-Za-z0-9_-]+'
            readOnly={sent || pending}
            autoComplete='off'
          />
        </label>
        <label>
          Checkout email
          <input
            name='email'
            type='email'
            required
            maxLength={254}
            readOnly={sent || pending}
            autoComplete='email'
          />
        </label>
        {sent && (
          <label>
            Email code
            <input
              name='code'
              required
              pattern='[0-9]{6}'
              minLength={6}
              maxLength={6}
              inputMode='numeric'
              autoComplete='one-time-code'
            />
          </label>
        )}
        <div className={styles.actions}>
          <button type='submit' className={styles.command} disabled={pending}>
            {pending ? <Loader2 size={16} className={styles.spin} /> : <Link2 size={16} />}
            {sent ? 'Verify and link order' : 'Send verification code'}
          </button>
          {sent && (
            <button
              type='button'
              className={styles.action}
              disabled={pending}
              onClick={() => {
                setSent(false);
                setMessage('');
              }}
            >
              Change details or resend
            </button>
          )}
        </div>
        <p role='status' className={styles.muted}>
          {message}
        </p>
      </form>
    </details>
  );
}
