'use client';

import * as React from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
  DrawerOverlay,
} from '@/components/UI/primitives/drawer';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/UI/primitives/input-otp';
import { IoMdClose } from 'react-icons/io';
import errorToast from '@/lib/error-toast';
import { FiClipboard } from 'react-icons/fi';

// Public imperative API for the Django order-intent email OTP modal.
export type DjangoOrderIntentOtpModalHandles = { open: () => void; close: () => void };

export type DjangoOrderIntentOtpModalProps = {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  title?: string;
  length?: number;
  onComplete?: (otp: string) => void;
  onResendOTP?: () => void;
  isResendingOTP?: boolean;
  defaultValue?: string;
  email?: string;
};

export const DjangoOrderIntentOtpModal = React.forwardRef<
  DjangoOrderIntentOtpModalHandles,
  DjangoOrderIntentOtpModalProps
>(
  (props, ref) => {
    // Destructure props with defaults
    const {
      isOpen,
      onOpenChange,
      title = 'Enter verification code',
      length = 6,
      onComplete,
      onResendOTP,
      isResendingOTP = false,
      defaultValue,
      email,
    } = props;

    const [value, setValue] = React.useState<string>(defaultValue ?? '');
    const [isComplete, setIsComplete] = React.useState(false);

    const clearValue = React.useCallback(() => {
      setValue('');
      setIsComplete(false);
    }, []);

    const submitOtp = React.useCallback(
      (otp: string) => {
        if (otp.length !== length || !onComplete) return;

        setIsComplete(true);
        onComplete(otp);
        clearValue();
      },
      [clearValue, length, onComplete],
    );

    // Fire onComplete only when fully entered
    React.useEffect(() => {
      if (value.length === length && onComplete && !isComplete) {
        submitOtp(value);
      } else if (value.length !== length && isComplete) {
        setIsComplete(false);
      }
    }, [value, length, onComplete, isComplete, submitOtp]);

    React.useEffect(() => {
      if (!isOpen) clearValue();
    }, [clearValue, isOpen]);

    // Clear OTP before closing
    const handleOpenChange = React.useCallback(
      (open: boolean) => {
        if (!open) clearValue();
        onOpenChange?.(open);
      },
      [clearValue, onOpenChange],
    );

    // Imperative control forwards to parent-controlled handler
    React.useImperativeHandle(
      ref,
      () => ({ open: () => handleOpenChange(true), close: () => handleOpenChange(false) }),
      [handleOpenChange],
    );

    return (
      <Drawer open={!!isOpen} onOpenChange={handleOpenChange}>
        <DrawerOverlay className='!bg-[linear-gradient(135deg,rgba(0,0,0,0.28),rgba(8,47,73,0.16),rgba(6,78,59,0.12),rgba(0,0,0,0.3))] !backdrop-blur-[4px]' />
        <DrawerContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className='!rounded-none h-full -mt-6 bg-transparent !border-none !fixed !bottom-0 flex items-center justify-center !right-0 !z-[500] w-full overflow-hidden'
        >
          <div className='relative mx-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-md overflow-y-auto rounded-[1.65rem] border border-white/20 bg-[linear-gradient(145deg,rgba(15,23,42,0.78),rgba(2,6,23,0.68)_55%,rgba(8,47,73,0.24))] p-5 text-white shadow-[0_26px_90px_rgba(8,47,73,0.32),0_0_0_1px_rgba(255,255,255,0.06)_inset] supports-[backdrop-filter]:backdrop-blur-xl sm:w-[92vw] sm:max-w-lg sm:rounded-[1.8rem] sm:p-6 md:max-w-xl lg:max-w-2xl'>
            <div
              aria-hidden='true'
              className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-200/80 to-transparent'
            />

            <div className='flex items-start justify-between gap-4 pb-4'>
              <div>
                <DrawerTitle className='text-lg font-semibold tracking-tight'>{title}</DrawerTitle>
                <p className='mt-2 text-sm leading-6 text-white/68'>
                  Enter the code sent to{' '}
                  <span className='font-semibold text-white'>{email ?? 'your email'}</span>.
                </p>
              </div>
              <DrawerClose
                className='rounded-full border border-white/15 bg-white/[0.04] p-2 text-3xl text-white/70 transition hover:bg-white/12 hover:text-white'
                aria-label='Close'
              >
                <IoMdClose />
              </DrawerClose>
            </div>

            {/* a11y description for screen readers */}
            <DrawerDescription className='sr-only'>
              Enter the one-time verification code sent to your email.
            </DrawerDescription>

            <section className='flex flex-col items-center justify-center gap-5 rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-inner shadow-white/[0.03] lg:flex-row lg:justify-between lg:p-5'>
              {/* OTP */}
              <InputOTP maxLength={length} value={value} onChange={setValue} className='font-otp'>
                <InputOTPGroup className='gap-2 sm:gap-3'>
                  {Array.from({ length }).map((_, i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className='w-10 h-12 rounded-xl bg-white/5 border border-white/45 text-white text-xl text-center tracking-widest outline-none ring-offset-transparent focus:ring-2 focus:ring-sky-200/40 focus:bg-white/10 transition-all sm:w-12 sm:h-14 sm:text-2xl'
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              {/* Paste from clipboard */}
              <div>
                <button
                  type='button'
                  className='group flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/72 transition hover:bg-white/10 hover:text-white'
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) {
                        const digits = text.replace(/\D/g, '').slice(0, length);
                        setValue(digits);
                      }
                    } catch {
                      errorToast({ message: `Clipboard access denied` });
                    }
                  }}
                >
                  <span>Paste OTP</span>
                  <FiClipboard className='w-4 h-4' />
                </button>
              </div>
            </section>

            <div className='mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3'>
              <button
                name='Clear OTP Input'
                type='button'
                onClick={() => setValue('')}
                className='rounded-2xl border border-white/15 bg-white/[0.04] px-3 py-2 font-semibold text-white/78 transition hover:bg-white/10 hover:text-white'
              >
                Clear
              </button>

              <button
                name='Resend OTP'
                type='button'
                onClick={onResendOTP}
                disabled={!onResendOTP || isResendingOTP}
                className='rounded-2xl border border-white/15 bg-white/[0.04] px-3 py-2 font-semibold text-white/78 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'
              >
                {isResendingOTP ? 'Resending...' : 'Resend'}
              </button>

              <button
                name='Proceed to Payment Button'
                type='button'
                onClick={() => submitOtp(value)}
                disabled={value.length !== length}
                className='col-span-2 rounded-2xl bg-white px-3 py-2 font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-1'
              >
                Verify
              </button>
            </div>

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
          </div>
        </DrawerContent>
      </Drawer>
    );
  },
);

DjangoOrderIntentOtpModal.displayName = 'DjangoOrderIntentOtpModal';
