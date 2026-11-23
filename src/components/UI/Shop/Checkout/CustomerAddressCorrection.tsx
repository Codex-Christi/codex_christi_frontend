'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import ShippingStateField from '@/components/UI/Shop/Address/ShippingStateField';
import type { CustomerAddressCorrectionState } from '@/lib/shop/checkout/customerAddressCorrection';

const fieldStyle = 'min-h-11 w-full min-w-0 rounded-md border border-white/30 bg-black/25 px-3 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

export default function CustomerAddressCorrection({ orderToken, state, onRefresh }: {
  orderToken: string;
  state: CustomerAddressCorrectionState;
  onRefresh: () => void;
}) {
  const saving = useRef(false);
  const stateId = useId();
  const [stateCode, setStateCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state === 'review') {
    return <p role='status' className='text-sm leading-6'>Our team needs to review your delivery address before your order can continue. No new payment is needed.</p>;
  }
  if (state === 'checking') return null;
  if (submitted) {
    return <p role='status' className='text-sm leading-6'>We received your address correction and will check it before preparing your order. No action is needed right now.</p>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    if (!stateCode) {
      setError('Choose the destination state or territory.');
      return;
    }
    const values = new FormData(event.currentTarget);
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/next-api/shop/checkout/${encodeURIComponent(orderToken)}/correct-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line1: values.get('line1'), line2: values.get('line2'), city: values.get('city'),
          state: values.get('state'), postalCode: values.get('postalCode'),
          confirmed: values.get('confirmed') === 'on',
        }),
      });
      if (response.status === 403) {
        onRefresh();
        setError('Verify access to this order again before submitting your address.');
      } else if (response.status === 409) {
        onRefresh();
        setError('This order changed. Check its current status before submitting again.');
      } else if (!response.ok) {
        setError(response.status === 400
          ? 'Check each address field and confirm the address before submitting.'
          : 'We couldn\'t save the correction. Try again later or contact support with your order reference.');
      } else {
        setSubmitted(true);
        onRefresh();
      }
    } catch {
      setError('We couldn\'t confirm the correction was saved. Refresh your order status before trying again.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <details className='border-y border-white/20 py-1'>
      <summary className='min-h-11 cursor-pointer py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white'>
        Correct delivery address
      </summary>
      <p className='pb-3 text-sm text-white/75'>Enter the corrected U.S. address for this order. Your account and payment will not change.</p>
      <form onSubmit={submit} aria-busy={busy} className='pb-3'>
        <fieldset disabled={busy} className='grid min-w-0 gap-3 sm:grid-cols-2'>
          <label className='grid min-w-0 gap-1 text-sm sm:col-span-2'>Street address
            <input className={fieldStyle} name='line1' autoComplete='shipping address-line1' maxLength={200} required />
          </label>
          <label className='grid min-w-0 gap-1 text-sm sm:col-span-2'>Apartment or unit (optional)
            <input className={fieldStyle} name='line2' autoComplete='shipping address-line2' maxLength={200} />
          </label>
          <label className='grid min-w-0 gap-1 text-sm'>City
            <input className={fieldStyle} name='city' autoComplete='shipping address-level2' maxLength={80} required />
          </label>
          <div className='grid min-w-0 gap-1 text-sm'>
            <label htmlFor={stateId}>State or territory</label>
            <ShippingStateField id={stateId} country='US' name='state' value={stateCode} onChange={setStateCode} disabled={busy} required />
          </div>
          <label className='grid min-w-0 gap-1 text-sm'>ZIP code
            <input className={fieldStyle} name='postalCode' autoComplete='shipping postal-code' inputMode='numeric' pattern='\d{5}(-\d{4})?' maxLength={10} required />
          </label>
          <label className='flex min-h-11 items-start gap-2 py-2 text-sm sm:col-span-2'>
            <input type='checkbox' name='confirmed' required className='mt-0.5 size-4 shrink-0' />
            <span>I confirm this is the correct delivery address for this order.</span>
          </label>
          <button type='submit' className='min-h-11 w-fit rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-50'>
            {busy ? 'Submitting...' : 'Submit corrected address'}
          </button>
        </fieldset>
        {error && <p role='alert' className='mt-3 text-sm text-amber-100'>{error}</p>}
      </form>
    </details>
  );
}
