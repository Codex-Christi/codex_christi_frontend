'use client';

import * as React from 'react';
import { Loader2, X } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
  DrawerOverlay,
} from '@/components/UI/primitives/drawer';
import { checkoutPanelClassName } from '../checkoutStyles';
import { useVisualViewportHeightCssVar } from '@/lib/hooks/useVisualViewportHeightCssVar';

export type DjangoOrderIntentOtpModalHandles = { open: () => void; close: () => void };
export type DjangoOrderIntentOtpModalProps = {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  title?: string;
  length?: number;
  onComplete?: (otp: string) => void | Promise<void>;
  onResendOTP?: () => unknown | Promise<unknown>;
  isResendingOTP?: boolean;
  isVerifyingOTP?: boolean;
  defaultValue?: string;
  email?: string;
};

export const DjangoOrderIntentOtpModal = React.forwardRef<
  DjangoOrderIntentOtpModalHandles,
  DjangoOrderIntentOtpModalProps
>(function DjangoOrderIntentOtpModal(
  {
    isOpen,
    onOpenChange,
    className,
    title = 'Verify your email',
    length = 6,
    onComplete,
    onResendOTP,
    isResendingOTP = false,
    isVerifyingOTP = false,
    defaultValue = '',
    email,
  },
  ref,
) {
  const [value, setValue] = React.useState(defaultValue);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputId = React.useId();
  useVisualViewportHeightCssVar(Boolean(isOpen));
  const busy = submitting || isVerifyingOTP;
  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        setValue('');
        setError(null);
      }
      onOpenChange?.(open);
    },
    [onOpenChange],
  );
  React.useImperativeHandle(
    ref,
    () => ({
      open: () => handleOpenChange(true),
      close: () => handleOpenChange(false),
    }),
    [handleOpenChange],
  );

  return (
    <Drawer open={Boolean(isOpen)} onOpenChange={handleOpenChange}>
      <DrawerOverlay className='!bg-black/70 !backdrop-blur-[5px]' />
      <DrawerContent className='!fixed !inset-0 !z-[520] !m-0 flex !h-[var(--checkout-modal-vh,100dvh)] !max-h-[var(--checkout-modal-vh,100dvh)] !w-full items-center justify-center !rounded-none !border-0 !bg-transparent p-3'>
        <section
          className={`${checkoutPanelClassName} relative max-h-[calc(var(--checkout-modal-vh,100dvh)-1.5rem)] w-full max-w-md overflow-y-auto border border-white/20 p-5 text-white sm:p-6 ${className ?? ''}`}
        >
          <div className='flex items-start justify-between gap-3'>
            <DrawerTitle className='text-xl font-semibold'>{title}</DrawerTitle>
            <DrawerClose
              aria-label='Close email verification'
              className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20'
            >
              <X size={18} aria-hidden='true' />
            </DrawerClose>
          </div>
          <DrawerDescription className='mt-3 break-words text-sm leading-6 text-white/80'>
            Enter the code sent to {email ?? 'your email'} to continue. This confirms where to send
            your order updates.
          </DrawerDescription>
          <form
            className='mt-5 space-y-4'
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy || value.length !== length || !onComplete) return;
              setSubmitting(true);
              setError(null);
              try {
                await onComplete(value);
              } catch {
                setError('We couldn’t verify this code. Please try again.');
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <div>
              <label htmlFor={inputId} className='mb-2 block text-sm font-medium'>
                Verification code
              </label>
              <input
                id={inputId}
                type='text'
                inputMode='numeric'
                autoComplete='one-time-code'
                autoFocus
                maxLength={length}
                value={value}
                onChange={(event) =>
                  setValue(event.target.value.replace(/\D/gu, '').slice(0, length))
                }
                className='min-h-12 w-full min-w-0 rounded-xl border border-white/40 bg-transparent px-4 text-center text-2xl tracking-[0.35em] outline-none focus:ring-2 focus:ring-sky-200/60'
              />
            </div>
            {error && (
              <p role='alert' className='text-sm text-amber-100'>
                {error}
              </p>
            )}
            <button
              type='submit'
              disabled={busy || value.length !== length}
              className='inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0085ff] px-4 font-semibold disabled:opacity-50'
            >
              {busy && <Loader2 size={18} className='animate-spin' aria-hidden='true' />}
              {busy ? 'Verifying…' : 'Verify email'}
            </button>
            {onResendOTP && (
              <button
                type='button'
                disabled={busy || isResendingOTP}
                onClick={() => void onResendOTP()}
                className='min-h-11 w-full text-sm text-white/80 underline underline-offset-4 disabled:opacity-50'
              >
                {isResendingOTP ? 'Sending another code…' : 'Send another code'}
              </button>
            )}
          </form>
        </section>
      </DrawerContent>
    </Drawer>
  );
});
