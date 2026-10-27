import EditCountry from '@/components/UI/profile/Edit/EditCountry';
import loadingToast from '@/lib/loading-toast';
import errorToast from '@/lib/error-toast';
import successToast from '@/lib/success-toast';
import { toast } from 'sonner';
import { ArrowLeftIcon } from 'lucide-react';
import { type SetStateAction, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/UI/primitives/button';
import { cn } from '@/lib/utils';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerOverlay,
  DrawerTitle,
} from '@/components/UI/primitives/drawer';
import { useUserShopProfile } from '@/stores/shop_stores/use-user-shop-profile';
import {
  type ShippingAddressFormData,
  shippingAddressSchema,
} from '@/lib/types/shipping-address-schema';
import { updateMyShippingAddress } from '@/actions/account/profile';
import { normalizeCountryToIso2 } from '@/lib/utils/shop/checkout/normalizeCountryToIso3';
import { getAuthGeneration } from '@/lib/auth/session-generation';
import { useAccountAccess } from '@/components/UI/Auth/AccountAccessContext';

const ADDRESS_FIELDS = [
  { name: 'shipping_state', label: 'State', placeholder: 'Enter state' },
  { name: 'shipping_city', label: 'City', placeholder: 'Enter city' },
  { name: 'shipping_address', label: 'Street address', placeholder: 'Enter street address' },
] as const;

const ShippingAddressModal = ({
  isActive,
  setIsActive,
}: {
  isActive: boolean;
  setIsActive: React.Dispatch<SetStateAction<boolean>>;
}) => {
  const accountAccessible = useAccountAccess();
  const initialized = useRef(false);
  const userShopProfile = useUserShopProfile((state) => state.userShopProfile);

  const setUserShopProfile = useUserShopProfile((state) => state.setUserShopProfile);

  const {
    register,
    handleSubmit,
    control,
    reset,
    trigger,
    formState: { errors, isSubmitting, isValid, isDirty },
  } = useForm<ShippingAddressFormData>({
    resolver: zodResolver(shippingAddressSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      shipping_state: '',
      shipping_city: '',
      shipping_address: '',
      shipping_country: '',
    },
  });

  // Rechecking the account must not replace an open, unsaved draft.
  useEffect(() => {
    if (!isActive) {
      if (initialized.current || isDirty) reset();
      initialized.current = false;
      return;
    }
    if (initialized.current) return;
    if (isDirty) {
      initialized.current = true;
      return;
    }
    if (userShopProfile?.data) {
      initialized.current = true;
      reset({
        shipping_state: userShopProfile.data.shipping_state || '',
        shipping_city: userShopProfile.data.shipping_city || '',
        shipping_address: userShopProfile.data.shipping_address || '',
        shipping_country: normalizeCountryToIso2(userShopProfile.data.shipping_country) ?? '',
      });

      void trigger();
    }
  }, [isActive, userShopProfile, reset, trigger, isDirty]);

  const onSubmit = async (data: ShippingAddressFormData) => {
    const generation = getAuthGeneration();
    const loadingToastID = loadingToast({
      message: 'Updating shipping address details...',
    });

    try {
      const result = await updateMyShippingAddress(data);
      if (generation !== getAuthGeneration()) return;
      if (!result.success) throw new Error(result.error);

      setUserShopProfile(result.data);

      setIsActive(false);

      successToast({
        message: 'Shipping address updated successfully.',
        header: 'Shipping Address Updated',
      });
    } catch (error) {
      if (generation !== getAuthGeneration()) return;

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Error updating shipping address. Please try again.';

      errorToast({
        message: errorMessage,
      });
    } finally {
      toast.dismiss(loadingToastID);
    }
  };

  return (
    <>
      <Drawer direction='right' open={isActive && accountAccessible} onOpenChange={setIsActive}>
        <DrawerOverlay className='bg-black/[0.01] !backdrop-blur-[10px]'>
          <DrawerContent
            className='!rounded-none h-full bg-black/80 !border-none
                !fixed !bottom-0 !right-0 !z-[500] w-full flex flex-col place-content-center'
          >
            <DrawerTitle className='sr-only'>Shipping address</DrawerTitle>
            <DrawerDescription className='sr-only'>Edit your delivery address.</DrawerDescription>

            <div
              className={cn(
                `bg-[linear-gradient(180deg,_rgba(243,_243,_243,_0.08)_0%,_rgba(141,_141,_141,_0.08)_100%)] backdrop-blur-xl gap-4 text-white mx-auto w-[90%] transition-transform md:w-[60%] max-h-[calc(100dvh-3rem)] md:max-h-[calc(100dvh-4rem)] overflow-y-auto duration-300 ease-linear rounded-[10px] -translate-y-[200%] shadow-2xl lg:w-2/5 z-[500] max-w-full overflow-x-hidden flex flex-col items-start`,
                { 'md:translate-y-4 translate-y-0': isActive },
              )}
            >
              <div className='sticky top-0 bg-[#3D3D3D] pt-4 pb-3 z-50 px-6 w-full'>
                <div className='inline-block w-auto'>
                  <button
                    className='inline-flex items-center gap-4 transition-all ease-linear duration-200 hover:gap-6 w-auto'
                    type='button'
                    onClick={() => setIsActive(false)}
                  >
                    <ArrowLeftIcon strokeWidth={1.2} />
                    Edit Delivery Address
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleSubmit(onSubmit)}
                className='grid gap-4 md:grid-cols-2 pb-8 px-6 w-full'
              >
                <label className='grid gap-2' htmlFor='shipping_country'>
                  <span className='text-[#F3F3F399] text-sm'>Country</span>
                  <Controller
                    name='shipping_country'
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <EditCountry
                        value={value ?? null}
                        onChange={onChange}
                        showLabel={false}
                        className='rounded-xl'
                      />
                    )}
                  />

                  {errors?.shipping_country && (
                    <span className='text-red-500 text-xs'>{errors?.shipping_country.message}</span>
                  )}
                </label>

                {ADDRESS_FIELDS.map(({ name, label, placeholder }) => (
                  <label key={name} className='grid gap-2' htmlFor={name}>
                    <span className='text-[#F3F3F399] text-sm'>{label}</span>
                    <input
                      {...register(name)}
                      className='input rounded-xl'
                      placeholder={placeholder}
                      id={name}
                      aria-invalid={Boolean(errors[name])}
                      aria-describedby={errors[name] ? `${name}-error` : undefined}
                    />
                    {errors[name] && (
                      <span id={`${name}-error`} className='text-red-500 text-xs'>
                        {errors[name].message}
                      </span>
                    )}
                  </label>
                ))}

                <Button
                  name='Save Changes'
                  id='save-changes'
                  className={cn(
                    'bg-[#0085FF] text-white font-semibold rounded pt-1.5 pb-2 px-5 md:mx-auto block md:col-span-2',
                    {
                      'cursor-not-allowed bg-red-500/50': !isValid,
                    },
                  )}
                  type='submit'
                  disabled={isSubmitting || !isValid}
                >
                  {isSubmitting ? 'Saving...' : 'Save changes'}
                </Button>
              </form>
            </div>
          </DrawerContent>
        </DrawerOverlay>
      </Drawer>
    </>
  );
};

export default ShippingAddressModal;
