'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import errorToast from '@/lib/error-toast';
import loadingToast from '@/lib/loading-toast';
import successToast from '@/lib/success-toast';
import { savePaidOrderFulfillmentAddressOverrideAction } from '@/app/admin/shop/paid-order-recovery/actions';
import type { PaidOrderRecoveryAddress } from './adminShopDashboardTypes';

type PaidOrderRecoveryAddressOverrideFormProps = {
  orderToken: string;
  initialAddress: PaidOrderRecoveryAddress | null;
  hasExistingOverride: boolean;
};

export default function PaidOrderRecoveryAddressOverrideForm({
  orderToken,
  initialAddress,
  hasExistingOverride,
}: PaidOrderRecoveryAddressOverrideFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    line1: initialAddress?.line1 ?? '',
    line2: initialAddress?.line2 ?? '',
    city: initialAddress?.city ?? '',
    state: initialAddress?.state ?? '',
    postalCode: initialAddress?.postalCode ?? '',
    country: initialAddress?.country ?? '',
    reason: '',
  });

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const toastId = loadingToast({
        header: 'Saving address override',
        message: 'Updating the fulfillment address used by retry actions.',
      });

      try {
        const result = await savePaidOrderFulfillmentAddressOverrideAction({
          orderToken,
          address: {
            line1: form.line1,
            line2: form.line2,
            city: form.city,
            state: form.state,
            postalCode: form.postalCode,
            country: form.country,
          },
          reason: form.reason,
        });

        toast.dismiss(toastId);

        if (!result.ok) {
          errorToast({
            header: 'Override not saved',
            message: result.error,
          });
          return;
        }

        successToast({
          header: 'Override saved',
          message: result.message,
        });
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.dismiss(toastId);
        errorToast({
          header: 'Override not saved',
          message: error instanceof Error ? error.message : 'Address override could not be saved.',
        });
      }
    });
  };

  return (
    <div className='rounded-lg border border-white/10 bg-slate-950/18'>
      <button
        type='button'
        onClick={() => setOpen((current) => !current)}
        className='flex w-full items-center justify-between gap-3 px-3 py-3 text-left'
      >
        <div>
          <p className='text-sm font-medium text-slate-100'>
            {hasExistingOverride ? 'Edit fulfillment override' : 'Override fulfillment address'}
          </p>
          <p className='mt-1 text-xs text-slate-500'>
            Save a corrected address before retrying this order.
          </p>
        </div>
        {open ? <ChevronUp size={16} className='text-slate-400' /> : <ChevronDown size={16} className='text-slate-400' />}
      </button>

      {open ? (
        <div className='grid gap-3 border-t border-white/10 p-3'>
          <Field label='Address line 1' value={form.line1} onChange={(value) => updateField('line1', value)} />
          <Field label='Address line 2' value={form.line2} onChange={(value) => updateField('line2', value)} />
          <div className='grid gap-3 sm:grid-cols-2'>
            <Field label='City' value={form.city} onChange={(value) => updateField('city', value)} />
            <Field label='State / province' value={form.state} onChange={(value) => updateField('state', value)} />
          </div>
          <div className='grid gap-3 sm:grid-cols-2'>
            <Field label='Postal code' value={form.postalCode} onChange={(value) => updateField('postalCode', value)} />
            <Field label='Country' value={form.country} onChange={(value) => updateField('country', value)} />
          </div>
          <label className='grid gap-1.5'>
            <span className='text-xs uppercase tracking-[0.08em] text-slate-500'>Reason for override</span>
            <textarea
              value={form.reason}
              onChange={(event) => updateField('reason', event.target.value)}
              rows={3}
              placeholder='Example: Customer confirmed corrected postal code by email.'
              className='resize-none rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35'
            />
          </label>
          <div className='flex justify-end'>
            <button
              type='button'
              disabled={isPending}
              onClick={handleSubmit}
              className='inline-flex items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-200/40 hover:bg-cyan-300/14 disabled:cursor-not-allowed disabled:opacity-50'
            >
              <Save size={15} />
              {isPending ? 'Saving...' : 'Save override'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className='grid gap-1.5'>
      <span className='text-xs uppercase tracking-[0.08em] text-slate-500'>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className='rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35'
      />
    </label>
  );
}
