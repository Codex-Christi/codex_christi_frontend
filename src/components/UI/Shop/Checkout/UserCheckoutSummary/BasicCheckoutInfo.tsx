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
import {
  captureCheckoutAttempt,
  clearCheckoutAttempt,
} from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import { useAuthStore } from '@/stores/authStore';
import { getAuthGeneration } from '@/lib/auth/session-generation';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import { useDjangoOrderIntentStore } from '@/stores/shop_stores/checkoutStore/djangoOrderIntentStore';
import { getCartVerificationIdentity } from '../../Cart/cartAvailability';
import { isPayPalAttemptFinalizing } from '@/lib/hooks/shopHooks/checkout/finalizePayPalAttempt';
import {
  createPaidOrderReviewFence,
  getPaidOrderReviewKey,
  getRecoveryDraftIdentity,
  isReviewedPaidAttempt,
} from './paidCheckoutRecoveryReview';
import {
  getCheckoutValuesFromStore,
  saveBasicCheckoutInfoToStore,
  startPaidCheckoutRecovery,
  toDjangoOrderIntentPayload,
  type PaidCheckoutRecoveryPromptState,
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
  const [paidCheckoutRecoveryPrompt, setPaidCheckoutRecoveryPrompt] =
    useState<PaidCheckoutRecoveryPromptState | null>(null);
  const reviewRequestRef = useRef<AbortController | null>(null);
  const acknowledgedReviewRef = useRef<string | null>(null);
  const submissionRef = useRef(0);
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

  const cancelReviewRequest = useCallback(() => {
    reviewRequestRef.current?.abort();
    reviewRequestRef.current = null;
  }, []);

  const handleDjangoOrderIntentOtpOpenChange = useCallback(
    (open: boolean) => {
      if (!open) cancelReviewRequest();
      setIsDjangoOrderIntentOtpOpen(open);
    },
    [cancelReviewRequest],
  );

  useEffect(() => cancelReviewRequest, [cancelReviewRequest]);

  const currentReviewScope = useCallback(() => {
    const auth = useAuthStore.getState();
    return JSON.stringify([
      getAuthGeneration(),
      auth.status,
      auth.accountOwnerId,
      getRecoveryDraftIdentity(basicCheckoutInfoForm.getValues()),
      getCartVerificationIdentity(useCartStore.getState().variants),
    ]);
  }, [basicCheckoutInfoForm]);

  const reviewEarlierPayments = useCallback(
    async (data: BasicCheckoutInfoFormSchema, phase: PaidCheckoutRecoveryPromptState['phase']) => {
      cancelReviewRequest();
      const controller = new AbortController();
      reviewRequestRef.current = controller;
      const current = createPaidOrderReviewFence(currentReviewScope, controller.signal);
      const scope = currentReviewScope();
      const verification = useDjangoOrderIntentStore.getState();
      const intentUuid =
        phase === 'after-verification' ? verification.djangoOrderIntentUuid : undefined;
      const generation = verification.generation;
      const result = await startPaidCheckoutRecovery(data, {
        intentUuid,
        signal: controller.signal,
      });
      if (
        !current() ||
        getRecoveryDraftIdentity(data) !==
          getRecoveryDraftIdentity(basicCheckoutInfoForm.getValues()) ||
        (intentUuid &&
          (useDjangoOrderIntentStore.getState().djangoOrderIntentUuid !== intentUuid ||
            useDjangoOrderIntentStore.getState().generation !== generation))
      )
        throw new DOMException('Checkout details changed.', 'AbortError');

      if (phase === 'after-verification' && result.recoveryRequired && !result.recoveryVerified)
        throw new Error('We couldn’t check your earlier order. Please continue checkout again.');
      const checkouts = result.recoveryVerified ? (result.checkouts ?? []) : [];
      const reviewKey = getPaidOrderReviewKey(scope, checkouts);
      const needsReview = checkouts.length > 0 && acknowledgedReviewRef.current !== reviewKey;
      if (needsReview) {
        setPaidCheckoutRecoveryPrompt({
          pendingCheckoutData: data,
          checkouts,
          scope,
          reviewKey,
          phase,
        });
        setPaidCheckoutRecoveryPromptVersion((version) => version + 1);
        setIsPaidCheckoutRecoveryOpen(true);
      }
      return { needsReview, checkouts };
    },
    [basicCheckoutInfoForm, cancelReviewRequest, currentReviewScope],
  );

  const handleVerifiedCheckout = useCallback(async () => {
    setSubmitError(null);
    try {
      if (!canContinue) throw new Error('Wait for prices and delivery to finish updating.');
      const { needsReview } = await reviewEarlierPayments(
        basicCheckoutInfoForm.getValues(),
        'after-verification',
      );
      if (!needsReview) handleOpenItem('payment-section');
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        setSubmitError('Your email is verified. Please try continuing checkout again.');
      throw error;
    }
  }, [basicCheckoutInfoForm, canContinue, handleOpenItem, reviewEarlierPayments]);

  const createDjangoOrderIntentFromCheckoutInfo = useCallback(
    async (data: BasicCheckoutInfoFormSchema) => {
      const controller = reviewRequestRef.current ?? new AbortController();
      reviewRequestRef.current = controller;
      const current = createPaidOrderReviewFence(currentReviewScope, controller.signal);
      const intent = await createDjangoOrderIntent(
        toDjangoOrderIntentPayload(data),
        undefined,
        current,
      );
      if (!current()) throw new DOMException('Checkout details changed.', 'AbortError');
      if (!intent)
        throw new Error('We couldn’t verify these details. Please check them and try again.');
      if (intent.data.otp_status === 'verified') await handleVerifiedCheckout();
    },
    [createDjangoOrderIntent, currentReviewScope, handleVerifiedCheckout],
  );

  const handleRecoveryOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        cancelReviewRequest();
        submissionRef.current += 1;
        setIsCheckingPaidCheckoutRecovery(false);
        setPaidCheckoutRecoveryPrompt(null);
      }
      setIsPaidCheckoutRecoveryOpen(open);
    },
    [cancelReviewRequest],
  );

  const startNewOrderAfterPaidCheckoutRecoveryReview = useCallback(async () => {
    const prompt = paidCheckoutRecoveryPrompt;
    if (!prompt || prompt.scope !== currentReviewScope())
      throw new Error('Your cart or details changed. Close this message and continue again.');

    acknowledgedReviewRef.current = prompt.reviewKey;
    try {
      const { needsReview, checkouts } = await reviewEarlierPayments(
        prompt.pendingCheckoutData,
        prompt.phase,
      );
      if (needsReview) throw new Error('Earlier order details changed. Review them again.');
      const attempt = captureCheckoutAttempt();
      if (isReviewedPaidAttempt(attempt, checkouts) && attempt) {
        if (isPayPalAttemptFinalizing(attempt))
          throw new Error('Wait for your earlier payment confirmation to finish.');
        if (!clearCheckoutAttempt(attempt))
          throw new Error('Checkout changed. Please review it again.');
      }
      // An unrelated or uncertain attempt is retained for the existing payment safeguards.
      if (prompt.phase === 'after-verification') handleOpenItem('payment-section');
      else await createDjangoOrderIntentFromCheckoutInfo(prompt.pendingCheckoutData);
    } catch (error) {
      acknowledgedReviewRef.current = null;
      throw error;
    }
  }, [
    createDjangoOrderIntentFromCheckoutInfo,
    currentReviewScope,
    handleOpenItem,
    paidCheckoutRecoveryPrompt,
    reviewEarlierPayments,
  ]);

  async function onSubmit(data: BasicCheckoutInfoFormSchema) {
    if (!canContinue) return;
    const request = ++submissionRef.current;
    setSubmitError(null);
    saveBasicCheckoutInfoToStore(data);
    setIsCheckingPaidCheckoutRecovery(true);
    try {
      if ((await reviewEarlierPayments(data, 'before-verification')).needsReview) return;
      await createDjangoOrderIntentFromCheckoutInfo(data);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        setSubmitError(
          error instanceof Error
            ? error.message
            : 'We couldn’t continue right now. Your details are still here. Please try again.',
        );
    } finally {
      if (submissionRef.current === request) setIsCheckingPaidCheckoutRecovery(false);
    }
  }

  const continueLabel = isCheckingPaidCheckoutRecovery
    ? 'Preparing checkout…'
    : 'Continue to review & payment';

  return (
    <>
      <h2 className='mb-3 text-xl font-semibold'>Contact & delivery</h2>
      <CheckoutAccountPrompt
        onSignIn={() => saveBasicCheckoutInfoToStore(basicCheckoutInfoForm.getValues())}
      />
      <Form {...basicCheckoutInfoForm}>
        <form
          onSubmit={(event) => {
            void basicCheckoutInfoForm.handleSubmit(onSubmit, () => {
              errorToast({
                message: 'Check form and correct errors',
                header: 'Incorrect details!',
              });
            })(event);
          }}
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

      {paidCheckoutRecoveryPrompt && (
        <PaidCheckoutRecoveryModal
          key={paidCheckoutRecoveryPromptVersion}
          isOpen={isPaidCheckoutRecoveryOpen}
          onOpenChange={handleRecoveryOpenChange}
          checkouts={paidCheckoutRecoveryPrompt.checkouts}
          onStartSeparateOrder={startNewOrderAfterPaidCheckoutRecoveryReview}
        />
      )}
      <DjangoOrderIntentOtpController
        isOpen={isDjangoOrderIntentOtpOpen}
        onOpenChange={handleDjangoOrderIntentOtpOpenChange}
        title='Verify your email before proceeding'
        length={6}
        proceedToPaymentTrigger={handleVerifiedCheckout}
        djangoOrderIntentEmailVerification={djangoOrderIntentEmailVerification}
        email={email}
      />
    </>
  );
};
