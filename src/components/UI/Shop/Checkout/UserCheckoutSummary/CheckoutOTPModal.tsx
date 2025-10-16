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
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';

// Public imperative API (names kept the same for compatibility)
export type CheckoutOTPModalHandles = { open: () => void; close: () => void };

// Prop names kept the same
export type CheckoutOTPModalProps = {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  title?: string;
  length?: number;
  onComplete?: (otp: string) => void;
  defaultValue?: string;
};

export const CheckoutOTPModal = React.forwardRef<CheckoutOTPModalHandles, CheckoutOTPModalProps>(
  (props, ref) => {
    // Destructure props with defaults
    const {
      isOpen,
      onOpenChange,
      title = 'Enter verification code',
      length = 6,
      onComplete,
      defaultValue,
    } = props;

    const [value, setValue] = React.useState<string>(defaultValue ?? '');
    const [isComplete, setIsComplete] = React.useState(false);
    const email = useShopCheckoutStore((s) => s.email);

    // Fire onComplete only when fully entered
    React.useEffect(() => {
      if (value.length === length && onComplete && !isComplete) {
        setIsComplete(true);
        onComplete(value);
      } else if (value.length !== length && isComplete) {
        setIsComplete(false);
      }
    }, [value, length, onComplete, isComplete]);

    // Clear OTP before closing
    const handleOpenChange = React.useCallback(
      (open: boolean) => {
        if (!open) setValue('');
        onOpenChange?.(open);
      },
      [onOpenChange],
    );

    // Imperative control forwards to parent-controlled handler
    React.useImperativeHandle(
      ref,
      () => ({ open: () => handleOpenChange(true), close: () => handleOpenChange(false) }),
      [handleOpenChange],
    );

    return (
      <Drawer open={!!isOpen} onOpenChange={handleOpenChange}>
        <DrawerOverlay className={`!bg-black/[0.7] !backdrop-blur-[5px]`}>
          <DrawerContent
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            className='!rounded-none h-full -mt-6 bg-black/[0.4] !border-none !fixed !bottom-0 flex items-center justify-center !right-0 !z-[500] w-full'
          >
            <div className='mx-auto w-full sm:w-[92vw] max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl p-6 sm:rounded-2xl text-white supports-[backdrop-filter]:backdrop-blur-lg !backdrop-blur-[5px] border border-white/20 shadow-2xl relative'>
              <div className='flex items-center justify-between mb-4 py-2'>
                <DrawerTitle className='text-lg font-semibold tracking-tight'>{title}</DrawerTitle>
                <DrawerClose className='text-white/70 hover:text-white text-4xl' aria-label='Close'>
                  <IoMdClose />
                </DrawerClose>
              </div>

              {/* a11y description for screen readers */}
              <DrawerDescription className='sr-only'>
                Enter the one-time verification code sent to your email.
              </DrawerDescription>

              <h6>Enter the OTP sent to your email: {email}</h6>

              <section className='flex flex-col lg:flex-row justify-center items-center lg:justify-between pt-6 lg:pt-8'>
                {/* OTP */}
                <InputOTP maxLength={length} value={value} onChange={setValue} className='font-otp'>
                  <InputOTPGroup className='gap-4'>
                    {Array.from({ length }).map((_, i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className='w-12 h-14 rounded-xl bg-white/5 border border-white/55 text-white text-2xl text-center tracking-widest outline-none ring-offset-transparent focus:ring-2 focus:ring-white/40 focus:bg-white/10 transition-all hover:scale-105 duration-200'
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>

                {/* Paste from clipboard */}
                <div className='mt-10 lg:mt-0'>
                  <button
                    type='button'
                    className='group flex items-center gap-2 text-md text-white/70 hover:text-white border p-3 rounded-lg transition-all hover:scale-105 hover:bg-white/10 duration-200'
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
                    <FiClipboard className='w-5 h-5 group-hover:animate-bounce' />
                  </button>
                </div>
              </section>

              <div className='mt-14 flex gap-10 justify-between'>
                <button
                  name='Clear OTP Input'
                  type='button'
                  onClick={() => setValue('')}
                  className='px-3 py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/15'
                >
                  Clear
                </button>

                <button
                  name='Proceed to Payment Button'
                  type='button'
                  onClick={() => onComplete?.(value)}
                  className='px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white'
                >
                  Proceed to Payment
                </button>
              </div>
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
          </DrawerContent>
        </DrawerOverlay>
      </Drawer>
    );
  },
);

CheckoutOTPModal.displayName = 'CheckoutOTPModal';
