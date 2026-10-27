'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { emailSchema, otpSchema } from '@/lib/formSchemas/auth-fields';
import CheckoutAccountPrompt from './CheckoutAccountPrompt';

export default function CheckoutAccessRecovery({
  orderToken,
  onVerified,
}: {
  orderToken: string;
  onVerified: () => void;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      setError('Enter the email address used at checkout.');
      return;
    }
    if (sent && !otpSchema.safeParse(code).success) {
      setError('Enter the six-digit email code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/next-api/shop/checkout/recovery/${sent ? 'verify' : 'start'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: parsedEmail.data,
            orderToken,
            ...(sent ? { otp: code } : {}),
          }),
        },
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        checkouts?: { orderToken: string }[];
        message?: string;
      };
      if (!response.ok || !payload.ok)
        throw new Error(payload.message ?? 'We couldn’t verify access. Please try again.');
      if (!sent) {
        setSent(true);
        return;
      }
      if (!payload.checkouts?.some((checkout) => checkout.orderToken === orderToken)) {
        setError(
          'We couldn’t match this order to that email. Check the address or sign in to the account used at checkout.',
        );
        return;
      }
      onVerified();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'We couldn’t verify access. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className='mt-5 min-w-0 border-t border-white/20 pt-5 text-left'>
      <h2 className='font-semibold'>Verify access to this order</h2>
      <p className='mt-2 text-sm leading-6 text-white/70'>
        Use the email from checkout to view this order. This checks an existing payment and won’t
        create another one.
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className='mt-4 space-y-3'
      >
        <label className='block text-sm'>
          Checkout email
          <input
            type='email'
            autoComplete='email'
            required
            value={email}
            readOnly={sent}
            onChange={(event) => setEmail(event.target.value)}
            className='mt-2 min-h-11 w-full min-w-0 rounded-xl border border-white/35 bg-transparent px-3 text-base'
          />
        </label>
        {sent && (
          <>
            <p className='text-xs leading-5 text-white/65'>
              Check your email for the six-digit recovery code.
            </p>
            <label className='block text-sm'>
              Email verification code
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode='numeric'
                autoComplete='one-time-code'
                maxLength={6}
                className='mt-2 min-h-11 w-full min-w-0 rounded-xl border border-white/35 bg-transparent px-3 text-base tracking-widest'
              />
            </label>
          </>
        )}
        {error && (
          <p role='alert' className='text-sm text-amber-100'>
            {error}
          </p>
        )}
        <button
          type='submit'
          disabled={busy}
          className='inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0085ff] px-4 font-semibold disabled:opacity-50'
        >
          {busy && <Loader2 size={16} className='animate-spin' aria-hidden='true' />}
          {sent ? 'Verify & view order' : 'Send email code'}
        </button>
        {sent && (
          <button
            type='button'
            disabled={busy}
            onClick={() => {
              setSent(false);
              setCode('');
            }}
            className='min-h-11 text-sm text-white/75 underline'
          >
            Use another email or request a new code
          </button>
        )}
      </form>
      <div className='mt-4'>
        <CheckoutAccountPrompt
          returnPath={`/shop/checkout/confirmation/${encodeURIComponent(orderToken)}`}
        />
      </div>
    </section>
  );
}
