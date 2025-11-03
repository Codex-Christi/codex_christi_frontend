import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { ArrowLeftIcon } from 'lucide-react';
import { SetStateAction } from 'react';
import { useState } from 'react';
import { Button } from '@/components/UI/primitives/button';
import { cn } from '@/lib/utils';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerOverlay,
  DrawerTitle,
} from '@/components/UI/primitives/drawer';

const ShippingAddressModal = ({
  isActive,
  setIsActive,
}: {
  isActive: boolean;
  setIsActive: React.Dispatch<SetStateAction<boolean>>;
}) => {
  const [phoneValue, setPhoneValue] = useState<string | undefined>('+2348105008304');

  const handlePhoneChange = (newValue: string | undefined) => {
    setPhoneValue(newValue);
  };

  return (
    <>
      <Drawer direction='right' open={isActive} onOpenChange={setIsActive}>
        <DrawerOverlay className='bg-black/[0.01] !backdrop-blur-[10px]'>
          <DrawerContent
            className='!rounded-none h-full bg-black/80 !border-none
                !fixed !bottom-0 !right-0 !z-[500] w-full'
          >
            <DrawerTitle className='!invisible'>
              <DrawerDescription>Shipping Address</DrawerDescription>
            </DrawerTitle>

            <div
              className={cn(
                `bg-[linear-gradient(180deg,_rgba(243,_243,_243,_0.08)_0%,_rgba(141,_141,_141,_0.08)_100%)] backdrop-blur-xl grid gap-4 text-white mx-auto w-[90%] transition-transform md:w-[60%] h-[calc(100dvh-3rem)] md:h-[calc(100dvh-4rem)] overflow-y-auto duration-300 ease-linear rounded-[10px] -translate-y-[200%] shadow-2xl lg:w-2/5 z-[500] max-w-full overflow-x-hidden`,
                { 'md:translate-y-4 translate-y-0': isActive },
              )}
            >
              <div className='sticky top-0 bg-[#3D3D3D] pt-4 pb-3 z-50 px-6'>
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

              <form className='grid gap-4 md:grid-cols-2 pb-8 px-6'>
                <label className='grid gap-2' htmlFor='first_name'>
                  <span className='text-[#F3F3F399] text-sm'>First Name</span>

                  <input
                    className='input rounded-xl'
                    placeholder='Enter first name'
                    id='first_name'
                  />
                </label>

                <label className='grid gap-2' htmlFor='last_name'>
                  <span className='text-[#F3F3F399] text-sm'>Last Name</span>

                  <input
                    className='input rounded-xl'
                    placeholder='Enter last name'
                    id='last_name'
                  />
                </label>

                <label className='grid gap-2 w-full' htmlFor='phone_number'>
                  <span className='text-[#F3F3F399] text-sm'>Phone Number</span>

                  <PhoneInput
                    placeholder='Enter phone number'
                    international
                    defaultCountry={undefined}
                    value={phoneValue}
                    onChange={handlePhoneChange}
                    className='input rounded-xl w-full max-w-full'
                  />
                </label>

                <label className='grid gap-2' htmlFor='state'>
                  <span className='text-[#F3F3F399] text-sm'>State</span>

                  <input className='input rounded-xl' placeholder='Enter state' id='state' />
                </label>

                <label className='grid gap-2' htmlFor='city'>
                  <span className='text-[#F3F3F399] text-sm'>City</span>

                  <input className='input rounded-xl' placeholder='Enter city' id='city' />
                </label>

                <label className='grid gap-2' htmlFor='address'>
                  <span className='text-[#F3F3F399] text-sm'>Street Address</span>

                  <input
                    className='input rounded-xl'
                    placeholder='Enter street address'
                    id='address'
                  />
                </label>

                <label className='grid gap-2 md:col-span-2' htmlFor='directions'>
                  <span className='text-[#F3F3F399] text-sm'>Directions (Optional)</span>

                  <textarea
                    className='input rounded-xl'
                    placeholder='Enter directions (optional)'
                    id='directions'
                    rows={5}
                  ></textarea>
                </label>

                <Button
                  name='Save Changes'
                  id='save-changes'
                  aria-label='Edit Profile'
                  className='bg-[#0085FF] text-white font-semibold rounded pt-1.5 pb-2 px-5 md:mx-auto block md:col-span-2'
                  type='button'
                  onClick={() => setIsActive(false)}
                  //   onClick={submitPatchData}
                  //   disabled={isLoading}
                >
                  Save changes
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
