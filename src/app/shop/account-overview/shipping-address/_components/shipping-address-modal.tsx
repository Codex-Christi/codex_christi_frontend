import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { ArrowLeftIcon } from 'lucide-react';
import { SetStateAction } from 'react';
import { useState } from 'react';
import { Button } from '@/components/UI/primitives/button';
import { cn } from '@/lib/utils';

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
    <div
      className={cn(
        'fixed w-full grid items-start gap-8 px-4 pb-4 bg-[#0D0D0D] rounded-lg backdrop-blur-xl md:px-6 md:pb-6 z-[1024] max-h-[calc(100dvh-2rem)] overflow-y-auto md:max-h-[calc(100dvh-3rem)] transition-transform ease-in-out duration-500 translate-x-[200%]',
        {
          'translate-x-0': isActive,
        },
      )}
    >
      <div className='inline-block w-auto sticky top-0 bg-inherit pt-4 pb-2 md:pt-6 md:pb-4 z-50'>
        <button
          className='inline-flex items-center gap-4 transition-all ease-linear duration-200 hover:gap-6 w-auto'
          type='button'
          onClick={() => setIsActive(false)}
        >
          <ArrowLeftIcon strokeWidth={1.2} />
          Edit Delivery Address
        </button>
      </div>

      <form className='grid gap-4 md:grid-cols-2'>
        <label className='grid gap-2' htmlFor='first_name'>
          <span className='text-[#F3F3F399] text-sm'>First Name</span>

          <input className='input rounded-xl' placeholder='Enter first name' id='first_name' />
        </label>

        <label className='grid gap-2' htmlFor='last_name'>
          <span className='text-[#F3F3F399] text-sm'>Last Name</span>

          <input className='input rounded-xl' placeholder='Enter last name' id='last_name' />
        </label>

        <label className='grid gap-2' htmlFor='phone_number'>
          <span className='text-[#F3F3F399] text-sm'>Phone Number</span>

          <PhoneInput
            placeholder='Enter phone number'
            international
            defaultCountry={undefined}
            value={phoneValue}
            onChange={handlePhoneChange}
            className='input rounded-xl'
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

          <input className='input rounded-xl' placeholder='Enter street address' id='address' />
        </label>

        <label className='grid gap-2 md:col-span-2' htmlFor='directions'>
          <span className='text-[#F3F3F399] text-sm'>Directions (Optional)</span>

          <textarea
            className='input rounded-xl'
            placeholder='Enter directions (optional)'
            id='directions'
            rows={3}
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
  );
};

export default ShippingAddressModal;
