'use client';

import { useMemo, useState } from 'react';
import { MapPin, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import errorToast from '@/lib/error-toast';
import loadingToast from '@/lib/loading-toast';
import successToast from '@/lib/success-toast';
import { savePaidOrderFulfillmentAddressOverrideAction } from '@/app/admin/(dashboard)/shop/paid-order-recovery/actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/primitives/popover';
import { cn } from '@/lib/utils';
import type { PaidOrderRecoveryAddress } from './adminShopDashboardTypes';
import type { ShopOpsDataTargetView } from '@/lib/prisma/shop/shopOpsDataTarget';

type PaidOrderRecoveryAddressOverrideFormProps = {
  orderToken: string;
  initialAddress: PaidOrderRecoveryAddress | null;
  hasExistingOverride: boolean;
  shopOpsDataTarget: ShopOpsDataTargetView;
  className?: string;
};

export default function PaidOrderRecoveryAddressOverrideForm({
  orderToken,
  initialAddress,
  hasExistingOverride,
  shopOpsDataTarget,
  className,
}: PaidOrderRecoveryAddressOverrideFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const initialForm = useMemo(
    () => ({
      line1: initialAddress?.line1 ?? '',
      line2: initialAddress?.line2 ?? '',
      city: initialAddress?.city ?? '',
      state: initialAddress?.state ?? '',
      postalCode: initialAddress?.postalCode ?? '',
      country: initialAddress?.country ?? '',
      reason: '',
      password: '',
    }),
    [initialAddress],
  );
  const [form, setForm] = useState(initialForm);
  const hasUnsavedChanges =
    form.line1 !== initialForm.line1 ||
    form.line2 !== initialForm.line2 ||
    form.city !== initialForm.city ||
    form.state !== initialForm.state ||
    form.postalCode !== initialForm.postalCode ||
    form.country !== initialForm.country ||
    form.reason !== initialForm.reason ||
    form.password !== initialForm.password;

  const requestClose = () => {
    const message = isSaving
      ? 'The address override is still saving. Close this popover anyway?'
      : hasUnsavedChanges
        ? 'Discard unsaved fulfillment address changes?'
        : null;

    if (message && !window.confirm(message)) {
      return;
    }

    setOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setOpen(true);
      return;
    }

    requestClose();
  };

  const handleSubmit = async () => {
    if (isSaving) {
      return;
    }

    if (shopOpsDataTarget.isLocalProductionTarget && !form.password.trim()) {
      errorToast({
        header: 'Master confirmation required',
        message: 'Enter the master admin password before changing a production order.',
      });
      return;
    }

    setIsSaving(true);
    const toastId = loadingToast({
      header: 'Applying address correction',
      message: 'Updating the ledger, imported Merchize order, and corrected receipt.',
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
        password: form.password || undefined,
      });

      toast.dismiss(toastId);

      if (!result.ok) {
        errorToast({
          header: 'Override not saved',
          message: result.error,
        });
        return;
      }

      if (result.tone === 'warning') {
        toast.warning('Address updated; review still required', { description: result.message });
      } else {
        successToast({
          header: 'Address correction applied',
          message: result.message,
        });
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.dismiss(toastId);
      errorToast({
        header: 'Override not saved',
        message: error instanceof Error ? error.message : 'Address override could not be saved.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type='button'
          disabled={
            !shopOpsDataTarget.aligned ||
            (shopOpsDataTarget.isLocalProductionTarget &&
              !shopOpsDataTarget.localProductionMutationsEnabled)
          }
          title={
            !shopOpsDataTarget.aligned
              ? (shopOpsDataTarget.configurationError ?? 'Shop Ops data target is unavailable.')
              : shopOpsDataTarget.isLocalProductionTarget &&
                  !shopOpsDataTarget.localProductionMutationsEnabled
                ? 'Local production mutations are locked by configuration.'
                : undefined
          }
          className={cn(
            'group flex h-full min-h-[132px] w-full items-start gap-3 rounded-lg border border-cyan-300/18 bg-cyan-300/[0.045] p-3 text-left transition hover:border-cyan-200/35 hover:bg-cyan-300/[0.07]',
            'disabled:cursor-not-allowed disabled:opacity-45',
            className,
          )}
        >
          <span className='grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-cyan-300/18 bg-cyan-300/10 text-cyan-100'>
            <MapPin size={16} />
          </span>
          <span className='min-w-0 flex-1'>
            <span className='block text-sm font-medium text-slate-100'>
              {hasExistingOverride ? 'Edit address correction' : 'Correct fulfillment address'}
            </span>
            <span className='mt-1 block text-xs leading-5 text-slate-500'>
              {hasExistingOverride
                ? 'Apply a revised address to the ledger, provider order, and receipt.'
                : 'Correct the address before this paid order is released to production.'}
            </span>
            <span className='mt-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-slate-950/26 px-2.5 py-1.5 text-xs font-medium text-cyan-100 transition group-hover:border-cyan-200/35'>
              {hasExistingOverride ? 'Open editor' : 'Add override'}
            </span>
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align='end'
        side='bottom'
        sideOffset={8}
        className='z-[650] w-[calc(100vw-2rem)] max-w-[640px] overflow-hidden border-white/10 bg-slate-950/95 p-0 text-slate-100 shadow-2xl shadow-black/60 backdrop-blur-xl'
      >
        <div className='flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3'>
          <div>
            <h4 className='text-sm font-semibold text-white'>
              {hasExistingOverride ? 'Edit address correction' : 'Correct fulfillment address'}
            </h4>
            <p className='mt-1 text-xs text-slate-500'>
              Applies to the imported Merchize order and regenerated receipt. Django payment save is
              not replayed.
            </p>
          </div>
          <button
            type='button'
            aria-label='Close fulfillment address override'
            onClick={requestClose}
            className='rounded-md p-1 text-slate-500 transition hover:bg-white/10 hover:text-white'
          >
            <X size={16} />
          </button>
        </div>

        <form
          className='grid max-h-[76vh] gap-3 overflow-y-auto p-4'
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <Field
            label='Address line 1'
            value={form.line1}
            onChange={(value) => updateField('line1', value)}
          />
          <Field
            label='Address line 2'
            value={form.line2}
            onChange={(value) => updateField('line2', value)}
          />
          <div className='grid gap-3 sm:grid-cols-2'>
            <Field
              label='City'
              value={form.city}
              onChange={(value) => updateField('city', value)}
            />
            <Field
              label='State / province'
              value={form.state}
              onChange={(value) => updateField('state', value)}
            />
          </div>
          <div className='grid gap-3 sm:grid-cols-2'>
            <Field
              label='Postal code'
              value={form.postalCode}
              onChange={(value) => updateField('postalCode', value)}
            />
            <Field
              label='Country'
              value={form.country}
              onChange={(value) => updateField('country', value)}
            />
          </div>
          <label className='grid gap-1.5'>
            <span className='text-xs uppercase tracking-[0.08em] text-slate-500'>
              Reason for override
            </span>
            <textarea
              value={form.reason}
              onChange={(event) => updateField('reason', event.target.value)}
              rows={3}
              placeholder='Example: Customer confirmed corrected postal code by email.'
              className='resize-none rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35'
            />
          </label>
          {shopOpsDataTarget.isLocalProductionTarget ? (
            <label className='grid gap-1.5 rounded-lg border border-rose-300/20 bg-rose-300/[0.06] p-3'>
              <span className='text-xs font-medium text-rose-50'>Master admin password</span>
              <span className='text-xs leading-5 text-rose-100/65'>
                Required because this localhost session is modifying production order data.
              </span>
              <input
                type='password'
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                autoComplete='current-password'
                className='h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-rose-200/45'
              />
            </label>
          ) : null}
          <div className='flex flex-wrap justify-end gap-2 pt-1'>
            <button
              type='button'
              onClick={requestClose}
              className='inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={isSaving}
              className='inline-flex items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-200/40 hover:bg-cyan-300/14 disabled:cursor-not-allowed disabled:opacity-50'
            >
              <Save size={15} />
              {isSaving ? 'Applying...' : 'Apply correction'}
            </button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
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
