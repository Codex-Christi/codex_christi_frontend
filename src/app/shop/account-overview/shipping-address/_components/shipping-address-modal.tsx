// import PhoneInput from 'react-phone-number-input';
// import 'react-phone-number-input/style.css';
import EditCountry from '@/components/UI/profile/Edit/EditCountry';
import loadingToast from '@/lib/loading-toast';
import errorToast from '@/lib/error-toast';
import successToast from '@/lib/success-toast';
import en from 'react-phone-number-input/locale/en';
import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';
import { ArrowLeftIcon } from 'lucide-react';
import { SetStateAction, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/UI/primitives/button';
import { getCountries } from 'react-phone-number-input/input';
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
  ShippingAddressFormData,
  shippingAddressSchema,
} from '@/lib/types/shipping-address-schema';
import { getCookie, decrypt } from '@/lib/session/main-session';
import { IUserShopProfile } from '@/lib/types/user-shop-interface';

const updateShippingAddress = async (formData: ShippingAddressFormData) => {
  const sessionCookie = await getCookie('session');

  const decryptedSessionCookie = await decrypt(sessionCookie?.value);

  const mainAccessToken = decryptedSessionCookie
    ? (decryptedSessionCookie.mainAccessToken as string)
    : ('' as string);

  const client = axios.create({
    baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
  });

  try {
    const response = await client.patch<IUserShopProfile>('/shop/shop-profile-update', formData, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mainAccessToken}`,
      },
    });
    return response.data;
  } catch (error: unknown) {
    throw error;
  }
};

const ShippingAddressModal = ({
  isActive,
  setIsActive,
}: {
  isActive: boolean;
  setIsActive: React.Dispatch<SetStateAction<boolean>>;
}) => {
  const userShopProfile = useUserShopProfile((state) => state.userShopProfile);

  const setUserShopProfile = useUserShopProfile((state) => state.setUserShopProfile);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    trigger,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ShippingAddressFormData>({
    resolver: zodResolver(shippingAddressSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      //   phone_number: '',
      shipping_state: '',
      shipping_city: '',
      shipping_address: '',
      shipping_country: '',
      //   directions: '',
    },
  });

  // Populate form with existing data when modal opens
  useEffect(() => {
    if (isActive && userShopProfile?.data) {
      reset({
        // phone_number: userShopProfile.data.phone_number || '',
        shipping_state: userShopProfile.data.shipping_state || '',
        shipping_city: userShopProfile.data.shipping_city || '',
        shipping_address: userShopProfile.data.shipping_address || '',
        shipping_country: userShopProfile.data.shipping_country || '',
        // directions: userShopProfile.data.directions || '',
      });

      trigger();
    }
  }, [isActive, userShopProfile, reset, trigger]);

  const onSubmit = async (data: ShippingAddressFormData) => {
    const loadingToastID = loadingToast({
      message: 'Updating shipping address details...',
    });

    try {
      toast.dismiss(loadingToastID);

      const countries = getCountries()
        .map((code) => ({
          code,
          name: en[code as keyof typeof en],
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const selectedCountry = countries.find((c) => c.code === watch('shipping_country'));

      const payload = {
        ...data,
        shipping_country: selectedCountry?.name ?? 'United States',
      };

      const response = await updateShippingAddress(payload);

      toast.dismiss(loadingToastID);

      if (userShopProfile && response) {
        setUserShopProfile(response);
      }

      setIsActive(false);

      successToast({
        message: 'Shipping address updated successfully.',
        header: 'Shipping Address Updated',
      });
    } catch (error) {
      toast.dismiss(loadingToastID);

      const axiosError = error as AxiosError<{
        errors?: Array<{ message: string }>;
        message?: string;
      }>;

      const errorMessage =
        axiosError.response?.data?.errors?.[0]?.message ||
        axiosError.response?.data?.message ||
        axiosError.message ||
        'Error updating shipping address. Please try again.';

      errorToast({
        message: errorMessage,
      });
    }
  };

  return (
    <>
      <Drawer direction='right' open={isActive} onOpenChange={setIsActive}>
        <DrawerOverlay className='bg-black/[0.01] !backdrop-blur-[10px]'>
          <DrawerContent
            className='!rounded-none h-full bg-black/80 !border-none
                !fixed !bottom-0 !right-0 !z-[500] w-full flex flex-col place-content-center'
          >
            <DrawerTitle className='!invisible'>
              <DrawerDescription>Shipping Address</DrawerDescription>
            </DrawerTitle>

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
                {/* <label className='grid gap-2 w-full' htmlFor='phone_number'>
                  <span className='text-[#F3F3F399] text-sm'>Phone Number</span>

                  <Controller
                    name='phone_number'
                    control={control}
                    render={({ field }) => (
                      <PhoneInput
                        placeholder='Enter phone number'
                        international
                        defaultCountry={undefined}
                        value={field.value}
                        onChange={field.onChange}
                        className='input rounded-xl w-full max-w-full'
                      />
                    )}
                                  />

                  {errors?.phone_number && (
                    <span className='text-red-500 text-xs'>{errors?.phone_number.message}</span>
                  )}
                </label> */}

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

                <label className='grid gap-2' htmlFor='shipping_state'>
                  <span className='text-[#F3F3F399] text-sm'>State</span>

                  <input
                    {...register('shipping_state')}
                    className='input rounded-xl'
                    placeholder='Enter state'
                    id='shipping_state'
                  />

                  {errors?.shipping_state && (
                    <span className='text-red-500 text-xs'>{errors?.shipping_state.message}</span>
                  )}
                </label>

                <label className='grid gap-2' htmlFor='shipping_city'>
                  <span className='text-[#F3F3F399] text-sm'>City</span>

                  <input
                    {...register('shipping_city')}
                    className='input rounded-xl'
                    placeholder='Enter city'
                    id='shipping_city'
                  />

                  {errors?.shipping_city && (
                    <span className='text-red-500 text-xs'>{errors?.shipping_city.message}</span>
                  )}
                </label>

                <label className='grid gap-2' htmlFor='shipping_address'>
                  <span className='text-[#F3F3F399] text-sm'>Street Address</span>

                  <input
                    {...register('shipping_address')}
                    className='input rounded-xl'
                    placeholder='Enter street address'
                    id='shipping_address'
                  />

                  {errors?.shipping_address && (
                    <span className='text-red-500 text-xs'>{errors?.shipping_address.message}</span>
                  )}
                </label>

                {/* <label className='grid gap-2 md:col-span-2' htmlFor='directions'>
                  <span className='text-[#F3F3F399] text-sm'>Directions (Optional)</span>

                  <textarea
                    {...register('directions')}
                    className='input rounded-xl'
                    placeholder='Enter directions (optional)'
                    id='directions'
                    rows={5}
                  ></textarea>

                  {errors?.directions && (
                    <span className='text-red-500 text-xs'>{errors?.directions.message}</span>
                  )}
                </label> */}

                <Button
                  name='Save Changes'
                  id='save-changes'
                  aria-label='Edit Profile'
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
