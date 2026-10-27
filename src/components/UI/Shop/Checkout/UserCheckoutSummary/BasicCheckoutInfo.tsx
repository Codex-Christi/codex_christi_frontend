'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/UI/primitives/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/UI/primitives/form';
import { CountryDropdown } from '@/components/UI/primitives/country-dropdown';
import { SignUpFormSchema } from '@/lib/formSchemas/signUpFormSchema';
import { FaAngleDoubleDown } from 'react-icons/fa';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { useShallow } from 'zustand/react/shallow';
import { useCallback, useContext, useEffect, useRef, useState, startTransition } from 'react';
import { CheckoutAccordionContext } from '../ProductCheckout';
import { checkoutDeliveryAddressSchema } from '../checkoutAddress';
import CheckoutAccountPrompt from '../CheckoutAccountPrompt';
import { GenericCheckoutInfoInput } from './GenericCheckoutInfoInput';
import { DeliveryAddressInputFields } from './DeliveryAddressInputFields';
import errorToast from '@/lib/error-toast';
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
const BasicCheckoutInfoFormSchema = z
  .object({
    country: z.string().trim().length(3, { message: 'Please select a country.' }),
  })
  .merge(signupExtSchema)
  .merge(checkoutDeliveryAddressSchema);

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
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { handleOpenItem, canContinue } = useContext(CheckoutAccordionContext);
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
  const openDjangoOrderIntentOtpModal = useCallback(() => setIsDjangoOrderIntentOtpOpen(true), []);
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
      // This creates/reuses the Django backend order intent, not the PayPal ledger intent.
      const djangoOrderIntent = await createDjangoOrderIntent(toDjangoOrderIntentPayload(data));

      if (djangoOrderIntent?.data.otp_status === 'verified') {
        handleOpenItem('payment-section');
      }
      if (!djangoOrderIntent)
        setSubmitError('We couldn’t verify these details. Please check them and try again.');
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

    await createDjangoOrderIntentFromCheckoutInfo(paidCheckoutRecoveryPrompt.pendingCheckoutData);
  }, [
    clearActivePayPalCheckout,
    clearPayPalIntent,
    createDjangoOrderIntentFromCheckoutInfo,
    paidCheckoutRecoveryPrompt.pendingCheckoutData,
  ]);

  async function onSubmit(data: BasicCheckoutInfoFormSchema) {
    if (!canContinue) return;
    setSubmitError(null);
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
      console.warn('[checkout] Contact verification unavailable', error);
      setSubmitError(
        'We couldn’t continue right now. Your details are still here. Please try again.',
      );
    } finally {
      setIsCheckingPaidCheckoutRecovery(false);
    }
  }

  const continueLabel = isCheckingPaidCheckoutRecovery
    ? 'Checking your email…'
    : 'Continue to review & payment';

  return (
    <>
      <h2 className='mb-3 text-xl font-semibold'>Contact & delivery</h2>
      <CheckoutAccountPrompt
        onSignIn={() => saveBasicCheckoutInfoToStore(basicCheckoutInfoForm.getValues())}
      />
      <Form {...basicCheckoutInfoForm}>
        <form
          onSubmit={basicCheckoutInfoForm.handleSubmit(onSubmit, () => {
            errorToast({
              message: 'Check form and correct errors',
              header: 'Incorrect details!',
            });
          })}
          className='grid w-full min-w-0 grid-cols-1 items-start gap-x-4 gap-y-5 sm:grid-cols-2'
          noValidate
        >
          <GenericCheckoutInfoInput
            currentZodForm={basicCheckoutInfoForm}
            inputName='firstname'
            labelString='First name'
            autoComplete='given-name'
          />
          <GenericCheckoutInfoInput
            currentZodForm={basicCheckoutInfoForm}
            inputName='lastname'
            labelString='Last name'
            autoComplete='family-name'
          />
          <GenericCheckoutInfoInput
            currentZodForm={basicCheckoutInfoForm}
            inputName='email'
            labelString='Email address'
            type='email'
            autoComplete='email'
            className='sm:col-span-2'
          />
          <p className='-mt-3 text-xs leading-5 text-white/60 sm:col-span-2'>
            We’ll send your checkout verification code and order updates here.
          </p>

          <FormField
            control={basicCheckoutInfoForm.control}
            name='country'
            render={({ field }) => (
              <FormItem className='min-w-0 self-baseline sm:col-span-2'>
                <FormLabel>Delivery country</FormLabel>
                <FormControl>
                  <CountryDropdown
                    aria-label='Delivery country'
                    placeholder='Choose a country'
                    value={field.value}
                    classNames={{ trigger: 'min-h-11 rounded-xl border-white/35 text-base' }}
                    onChange={(country) => {
                      field.onChange(country.alpha3);
                      startTransition(() => {
                        changeCookieStoreCountry(country.alpha3);
                      });
                      setShippingCountryISO3(country.alpha3);
                    }}
                  />
                </FormControl>
                <FormMessage className='text-rose-300' />
              </FormItem>
            )}
          />
          <DeliveryAddressInputFields currentZodForm={basicCheckoutInfoForm} />

          {submitError && (
            <p
              role='alert'
              className='rounded-xl border border-amber-200/30 p-3 text-sm text-amber-100 sm:col-span-2'
            >
              {submitError}
            </p>
          )}

          <Button
            name={continueLabel}
            type='submit'
            disabled={isCheckingPaidCheckoutRecovery || !canContinue}
            className='mt-2 min-h-12 w-full gap-3 whitespace-normal rounded-xl bg-[#0085ff] px-4 text-base font-semibold text-white hover:bg-[#0085ff]/85 sm:col-span-2'
          >
            <span>{continueLabel}</span>
            <FaAngleDoubleDown size={18} className='shrink-0' aria-hidden='true' />
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
