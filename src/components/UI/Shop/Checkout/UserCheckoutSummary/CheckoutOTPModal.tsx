'use client';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/UI/primitives/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/UI/primitives/input-otp';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';

// Public imperative API (kept the same name for compatibility)
export type CheckoutOTPModalHandles = {
  open: () => void;
  close: () => void;
};

// Kept prop names the same to avoid downstream changes
export type CheckoutOTPModalProps = {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  title?: string;
  length?: number;
  onComplete?: (otp: string) => void;
  defaultValue?: string;
};

// Main component
export const CheckoutOTPModal = forwardRef<CheckoutOTPModalHandles, CheckoutOTPModalProps>(
  (
    {
      isOpen,
      onOpenChange,
      className,
      title = 'Enter verification code',
      length = 6,
      onComplete,
      defaultValue,
    },
    ref,
  ) => {
    const [value, setValue] = useState<string>(defaultValue ?? '');

    // Call onComplete exactly when filled
    useEffect(() => {
      if (value.length === length && onComplete) onComplete(value);
    }, [value, length, onComplete]);

    // Clear value before closing to avoid stale OTP on re-open
    const handleOpenChange = useCallback(
      (open: boolean) => {
        if (!open) setValue('');
        onOpenChange?.(open);
      },
      [onOpenChange],
    );

    // Imperative API forwards to the controlled setter
    useImperativeHandle(
      ref,
      () => ({
        open: () => handleOpenChange(true),
        close: () => handleOpenChange(false),
      }),
      [handleOpenChange],
    );

    // Glassy, dark panel base (overlay styling comes from your primitives/dialog overlay)
    const base =
      'relative overflow-hidden rounded-2xl bg-black/45 border border-white/20 text-white backdrop-blur-xl shadow-2xl';

    return (
      <Dialog open={!!isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className='border-0 bg-transparent p-0 shadow-none'
        >
          <div
            className={`${base} ${className ?? ''} z-[60] w-[92vw] max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl mx-auto`}
            role='dialog'
            aria-modal='true'
          >
            {/* glossy glare */}
            <div className='pointer-events-none absolute -top-8 left-1/2 h-32 w-[220%] -translate-x-1/2 rotate-[14deg] bg-gradient-to-b from-transparent via-white/12 to-transparent' />

            <div className='relative z-10 p-6 w-full'>
              <div className='flex items-start justify-between mb-4'>
                <DialogTitle className='text-lg font-semibold tracking-tight'>{title}</DialogTitle>
                <button
                  type='button'
                  onClick={() => handleOpenChange(false)}
                  className='rounded-lg px-2 py-1 text-white/80 hover:text-white hover:bg-white/10'
                  aria-label='Close'
                >
                  ✕
                </button>
              </div>

              {/* Screen-reader description to satisfy a11y */}
              <DialogDescription className='sr-only'>
                Enter the one-time verification code sent to your email.
              </DialogDescription>

              {/* Paste from clipboard */}
              <div className='mb-4 text-right'>
                <button
                  type='button'
                  className='text-sm text-white/70 hover:text-white underline'
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) {
                        const digits = text.replace(/\D/g, '').slice(0, length);
                        setValue(digits);
                      }
                    } catch (e) {
                      console.error('Clipboard read failed:', e);
                    }
                  }}
                >
                  Paste from clipboard
                </button>
              </div>

              {/* OTP */}
              <InputOTP maxLength={length} value={value} onChange={setValue} className='font-otp'>
                <InputOTPGroup className='gap-2'>
                  {Array.from({ length }).map((_, i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className='w-12 h-14 rounded-xl bg-white/5 border border-white/25 text-white text-2xl text-center tracking-widest outline-none ring-offset-transparent focus:ring-2 focus:ring-white/40 focus:bg-white/10 transition'
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              <div className='mt-4 flex gap-2'>
                <button
                  type='button'
                  onClick={() => setValue('')}
                  className='px-3 py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/15'
                >
                  Clear
                </button>
                <button
                  type='button'
                  onClick={() => handleOpenChange(false)}
                  className='px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white'
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </DialogContent>

        {/* Keep autofill neutralizer inline and global */}
        <style jsx global>{`
          input:-webkit-autofill,
          input:-webkit-autofill:hover,
          input:-webkit-autofill:focus,
          input:-webkit-autofill:active {
            -webkit-text-fill-color: #ffffff !important;
            caret-color: #ffffff !important;
            transition: background-color 9999s ease-in-out 0s !important;
            -webkit-box-shadow: 0 0 0px 1000px transparent inset !important;
            background-clip: content-box !important;
          }
          input::-webkit-contacts-auto-fill-button,
          input::-webkit-credentials-auto-fill-button {
            visibility: hidden !important;
            display: none !important;
            pointer-events: none !important;
            position: absolute !important;
            right: 0 !important;
          }
        `}</style>
      </Dialog>
    );
  },
);

CheckoutOTPModal.displayName = 'CheckoutOTPModal';
