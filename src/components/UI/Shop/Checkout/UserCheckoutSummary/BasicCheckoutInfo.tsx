'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/UI/primitives/button';
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/components/UI/primitives/form';
import { CountryDropdown } from '@/components/UI/primitives/country-dropdown';
import { SignUpFormSchema } from '@/lib/formSchemas/signUpFormSchema';
import { EmailInput, NameInput } from '@/components/UI/Auth/FormFields';
import { FaAngleDoubleDown } from 'react-icons/fa';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { useShallow } from 'zustand/react/shallow';
import { useCallback, useContext, useEffect, useRef, useState, startTransition } from 'react';
import { CheckoutAccordionContext } from '../ProductCheckout';
import { billingAddressSchema } from '@/lib/formSchemas/shop/paypal-order/billingAddressSchema';
import { DeliveryAddressInputFields } from './DeliveryAddressInputFields';
import errorToast from '@/lib/error-toast';
import successToast from '@/lib/success-toast';
import { useDjangoOrderIntentEmailVerification } from '@/lib/hooks/shopHooks/checkout/useDjangoOrderIntentEmailVerification';
import { useUserShopProfile } from '@/stores/shop_stores/use-user-shop-profile';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';
import dynamic from 'next/dynamic';
import { useCurrencyCookie } from '@/lib/utils/shop/globalFXProductPrice/currencyCookieStore';
import { usePayPalIntentStore } from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import {
  getFreshPaidCheckoutRecoverySessionForEmail,
  getPaidCheckoutRecoverySessionRemainingMinutes,
} from '@/stores/shop_stores/checkoutStore/paidCheckoutRecoveryStore';
import {
  DEFAULT_PAID_CHECKOUT_RECOVERY_PROMPT_STATE,
  getCheckoutValuesFromStore,
  getPaidCheckoutRecoveryExpiryMinutes,
  getRecipientName,
  getRecentVerifiedDjangoOrderIntentForEmail,
  saveBasicCheckoutInfoToStore,
  startPaidCheckoutRecovery,
  toDjangoOrderIntentPayload,
} from './basicCheckoutInfoHelpers';

const DjangoOrderIntentOtpController = dynamic(
  () =>
    import('./DjangoOrderIntentOtpController').then((mod) => mod.DjangoOrderIntentOtpController),
  { ssr: false },
);
const PaidCheckoutRecoveryModal = dynamic(
  () => import('./PaidCheckoutRecoveryModal').then((mod) => mod.PaidCheckoutRecoveryModal),
  { ssr: false },
);

const signupExtSchema = SignUpFormSchema.pick({
  firstname: true,
  lastname: true,
  email: true,
});
const deliveryAddressSchema = billingAddressSchema.pick({
  addressLine1: true,
  addressLine2: true,
  adminArea1: true,
  adminArea2: true,
  postalCode: true,
});

const BasicCheckoutInfoFormSchema = z
  .object({
    country: z.string().min(1, { message: 'Please select a country' }),
  })
  .merge(signupExtSchema)
  .merge(deliveryAddressSchema);

export type BasicCheckoutInfoFormSchema = z.infer<typeof BasicCheckoutInfoFormSchema>;

export const BasicCheckoutInfo = () => {
  const hasAppliedHydratedCheckoutValuesRef = useRef(false);
  const [isDjangoOrderIntentOtpOpen, setIsDjangoOrderIntentOtpOpen] = useState(false);
  const [isPaidCheckoutRecoveryOpen, setIsPaidCheckoutRecoveryOpen] = useState(false);
  const [paidCheckoutRecoveryPrompt, setPaidCheckoutRecoveryPrompt] = useState(
    DEFAULT_PAID_CHECKOUT_RECOVERY_PROMPT_STATE,
  );
  const [paidCheckoutRecoveryPromptVersion, setPaidCheckoutRecoveryPromptVersion] = useState(0);
  const [isCheckingPaidCheckoutRecovery, setIsCheckingPaidCheckoutRecovery] = useState(false);

  const { handleOpenItem } = useContext(CheckoutAccordionContext);
  const [checkoutHydrated, setCheckoutHydrated] = useState(false);
  const { delivery_address, email } = useShopCheckoutStore(
    useShallow((s) => ({
      delivery_address: s.delivery_address,
      email: s.email,
    })),
  );
  const setShippingCountryISO3 = useShopCheckoutStore((s) => s.setShippingCountryISO3);
  const hydrateFromShopProfile = useShopCheckoutStore((s) => s.hydrateFromShopProfile);
  const userShopProfile = useUserShopProfile((s) => s.userShopProfile);
  const fallbackEmail = useUserMainProfileStore((s) => s.userMainProfile?.email);
  const selectedCountryISO3 = useCurrencyCookie((s) => s.iso3);
  const changeCookieStoreCountry = useCurrencyCookie((s) => s.changeCountry);
  const openDjangoOrderIntentOtpModal = useCallback(
    () => setIsDjangoOrderIntentOtpOpen(true),
    [],
  );
  const djangoOrderIntentEmailVerification = useDjangoOrderIntentEmailVerification(
    email,
    openDjangoOrderIntentOtpModal,
  );
  const { createDjangoOrderIntent } = djangoOrderIntentEmailVerification;
  const clearActivePayPalCheckout = usePayPalIntentStore((s) => s.clearActiveCheckout);
  const clearPayPalIntent = usePayPalIntentStore((s) => s.clearIntent);

  const basicCheckoutInfoForm = useForm<BasicCheckoutInfoFormSchema>({
    resolver: zodResolver(BasicCheckoutInfoFormSchema),
    defaultValues: getCheckoutValuesFromStore(selectedCountryISO3),
  });
  const {
    formState: { isDirty: isCheckoutFormDirty },
    reset,
    setValue,
  } = basicCheckoutInfoForm;

  const deriveValuesFromStore = useCallback(
    () => getCheckoutValuesFromStore(selectedCountryISO3),
    [selectedCountryISO3],
  );

  const applyHydratedCheckoutValues = useCallback(() => {
    if (hasAppliedHydratedCheckoutValuesRef.current) return;

    hasAppliedHydratedCheckoutValuesRef.current = true;
    reset(deriveValuesFromStore());
    queueMicrotask(() => setCheckoutHydrated(true));
  }, [deriveValuesFromStore, reset]);

  // Ensure form is populated after Zustand persist hydration (full reload case)
  useEffect(() => {
    const hasHydrated = useShopCheckoutStore.persist?.hasHydrated?.();
    if (hasHydrated) {
      applyHydratedCheckoutValues();
    } else {
      const unsub = useShopCheckoutStore.persist?.onFinishHydration?.(() => {
        applyHydratedCheckoutValues();
      });
      return () => {
        if (typeof unsub === 'function') unsub();
      };
    }
  }, [applyHydratedCheckoutValues]);

  useEffect(() => {
    if (!userShopProfile?.data) return;
    if (!checkoutHydrated) return;
    if (isCheckoutFormDirty) return;

    const vals = deriveValuesFromStore();
    if (vals.addressLine1 || vals.adminArea1 || vals.adminArea2) return;

    hydrateFromShopProfile(userShopProfile, fallbackEmail);
    reset(deriveValuesFromStore());
  }, [
    checkoutHydrated,
    deriveValuesFromStore,
    fallbackEmail,
    hydrateFromShopProfile,
    isCheckoutFormDirty,
    reset,
    userShopProfile,
  ]);

  useEffect(() => {
    if (
      !checkoutHydrated ||
      !selectedCountryISO3 ||
      delivery_address?.shipping_country === selectedCountryISO3
    ) {
      return;
    }

    setShippingCountryISO3(selectedCountryISO3);
    setValue('country', selectedCountryISO3, { shouldDirty: false });
  }, [
    checkoutHydrated,
    delivery_address?.shipping_country,
    selectedCountryISO3,
    setShippingCountryISO3,
    setValue,
  ]);

  const createDjangoOrderIntentFromCheckoutInfo = useCallback(
    async (data: BasicCheckoutInfoFormSchema) => {
      const recentVerifiedDjangoOrderIntent = getRecentVerifiedDjangoOrderIntentForEmail(
        data.email,
      );

      if (recentVerifiedDjangoOrderIntent) {
        successToast({
          header: 'Email already verified',
          message: 'Continuing with your recent verified checkout session.',
        });
        handleOpenItem('payment-section');
        return;
      }

      // This creates/reuses the Django backend order intent, not the PayPal ledger intent.
      const djangoOrderIntent = await createDjangoOrderIntent(
        toDjangoOrderIntentPayload(data),
      );

      if (djangoOrderIntent?.data.otp_status === 'verified') {
        handleOpenItem('payment-section');
      }
    },
    [createDjangoOrderIntent, handleOpenItem],
  );

  const startNewOrderAfterPaidCheckoutRecoveryReview = useCallback(async () => {
    if (!paidCheckoutRecoveryPrompt.pendingCheckoutData) {
      errorToast({
        header: 'Checkout details missing',
        message: 'Please submit your checkout details again.',
      });
      return;
    }

    clearActivePayPalCheckout();
    clearPayPalIntent();

    await createDjangoOrderIntentFromCheckoutInfo(
      paidCheckoutRecoveryPrompt.pendingCheckoutData,
    );
  }, [
    clearActivePayPalCheckout,
    clearPayPalIntent,
    createDjangoOrderIntentFromCheckoutInfo,
    paidCheckoutRecoveryPrompt.pendingCheckoutData,
  ]);

  async function onSubmit(data: BasicCheckoutInfoFormSchema) {
    saveBasicCheckoutInfoToStore(data);
    setPaidCheckoutRecoveryPrompt((current) => ({ ...current, pendingCheckoutData: data }));
    setIsCheckingPaidCheckoutRecovery(true);

    try {
      const freshRecoverySession = getFreshPaidCheckoutRecoverySessionForEmail(data.email);

      if (freshRecoverySession) {
        setPaidCheckoutRecoveryPrompt({
          pendingCheckoutData: data,
          email: data.email,
          recipientName: getRecipientName(data),
          expiresInMinutes: getPaidCheckoutRecoverySessionRemainingMinutes(freshRecoverySession),
          resendAvailableInSeconds: 0,
          verifiedCheckouts: freshRecoverySession.checkouts,
        });
        setPaidCheckoutRecoveryPromptVersion((version) => version + 1);
        setIsPaidCheckoutRecoveryOpen(true);
        return;
      }

      const paidCheckoutRecoveryStart = await startPaidCheckoutRecovery(data);

      if (paidCheckoutRecoveryStart.recoveryRequired) {
        setPaidCheckoutRecoveryPrompt({
          pendingCheckoutData: data,
          email: data.email,
          recipientName: getRecipientName(data),
          expiresInMinutes: getPaidCheckoutRecoveryExpiryMinutes(paidCheckoutRecoveryStart),
          resendAvailableInSeconds: paidCheckoutRecoveryStart.resendAvailableInSeconds ?? 0,
          verifiedCheckouts: [],
        });
        setPaidCheckoutRecoveryPromptVersion((version) => version + 1);
        setIsPaidCheckoutRecoveryOpen(true);
        return;
      }

      await createDjangoOrderIntentFromCheckoutInfo(data);
    } catch (error) {
      errorToast({
        header: 'Checkout recovery check failed',
        message:
          (error as Error)?.message ??
          'Unable to check whether this email has a checkout recovery case.',
      });
    } finally {
      setIsCheckingPaidCheckoutRecovery(false);
    }
  }

  return (
    <>
      <h2 className='border-b max-w-fit mb-10 border-white pb-1 text-xl font-bold'>
        Contact and Delivery Information
      </h2>
      <Form {...basicCheckoutInfoForm}>
        <form
          onSubmit={basicCheckoutInfoForm.handleSubmit(onSubmit, () => {
            errorToast({
              message: 'Check form and correct errors',
              header: 'Incorrect details!',
            });
          })}
          className='w-full  grid grid-cols-1 md:grid-cols-2 gap-x-20 gap-3 items-center'
        >
          <NameInput currentZodForm={basicCheckoutInfoForm} inputName='firstname' />

          <NameInput currentZodForm={basicCheckoutInfoForm} inputName='lastname' />

          <EmailInput currentZodForm={basicCheckoutInfoForm} inputName='email' />

          <DeliveryAddressInputFields currentZodForm={basicCheckoutInfoForm} />

          <FormField
            control={basicCheckoutInfoForm.control}
            name='country'
            render={({ field }) => (
              <FormItem className='self-baseline'>
                <FormLabel>Country</FormLabel>
                <CountryDropdown
                  placeholder='Country'
                  defaultValue={field.value}
                  onChange={(country) => {
                    field.onChange(country.alpha3);
                    startTransition(() => {
                      changeCookieStoreCountry(country.alpha3);
                    });
                    setShippingCountryISO3(country.alpha3);
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            name='Checkout Summary Submit'
            type='submit'
            disabled={isCheckingPaidCheckoutRecovery}
            className=' col-span-1 md:col-span-2 w-full max-w-[400px] mt-5 mx-auto rounded-3xl
            !font-bold px-4 sm:px-6 py-2 sm:py-3 text-lg sm:text-base
            bg-stone-500 hover:bg-stone-100 hover:bg-opacity-10 bg-opacity-10 
            backdrop-blur-md shadow-md shadow-gray-400 flex gap-6'
          >
            <h4 className='[word-spacing:0.25rem]'>
              {isCheckingPaidCheckoutRecovery
                ? 'Checking Checkout Status'
                : 'Choose Payment Method'}
            </h4>
            <FaAngleDoubleDown size={22.5} />
          </Button>
        </form>
      </Form>

      <PaidCheckoutRecoveryModal
        key={`${paidCheckoutRecoveryPromptVersion}-${paidCheckoutRecoveryPrompt.email}-${paidCheckoutRecoveryPrompt.expiresInMinutes}-${paidCheckoutRecoveryPrompt.resendAvailableInSeconds}-${paidCheckoutRecoveryPrompt.verifiedCheckouts.map((checkout) => checkout.orderToken).join('|')}`}
        isOpen={isPaidCheckoutRecoveryOpen}
        onOpenChange={setIsPaidCheckoutRecoveryOpen}
        email={paidCheckoutRecoveryPrompt.email}
        recipientName={paidCheckoutRecoveryPrompt.recipientName}
        expiresInMinutes={paidCheckoutRecoveryPrompt.expiresInMinutes}
        resendAvailableInSeconds={paidCheckoutRecoveryPrompt.resendAvailableInSeconds}
        initialVerifiedCheckouts={paidCheckoutRecoveryPrompt.verifiedCheckouts}
        onStartSeparateOrder={startNewOrderAfterPaidCheckoutRecoveryReview}
      />
      <DjangoOrderIntentOtpController
        isOpen={isDjangoOrderIntentOtpOpen}
        onOpenChange={setIsDjangoOrderIntentOtpOpen}
        title='Verify your email before proceeding'
        length={6}
        proceedToPaymentTrigger={handleOpenItem}
        djangoOrderIntentEmailVerification={djangoOrderIntentEmailVerification}
        email={email}
      />
    </>
  );
};
