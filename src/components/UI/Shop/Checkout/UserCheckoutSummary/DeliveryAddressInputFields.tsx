import { useWatch, type UseFormReturn } from 'react-hook-form';
import { GenericCheckoutInfoInput } from './GenericCheckoutInfoInput';
import type { BasicCheckoutInfoFormSchema } from './BasicCheckoutInfo';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/UI/primitives/form';
import ShippingStateField from '@/components/UI/Shop/Address/ShippingStateField';
import { isUsCountry } from '@/lib/shop/address/usStates';

const fields = [
  { name: 'addressLine1', label: 'Street address', autoComplete: 'address-line1', fullWidth: true },
  {
    name: 'addressLine2',
    label: 'Apartment, suite, etc. (optional)',
    autoComplete: 'address-line2',
    fullWidth: true,
  },
  { name: 'adminArea2', label: 'City / town', autoComplete: 'address-level2' },
  { name: 'adminArea1', label: 'State / province', autoComplete: 'address-level1' },
  { name: 'postalCode', label: 'Postal code', autoComplete: 'postal-code' },
] as const;

export function DeliveryAddressInputFields({
  currentZodForm,
}: {
  currentZodForm: UseFormReturn<BasicCheckoutInfoFormSchema>;
}) {
  const country = useWatch({ control: currentZodForm.control, name: 'country' });
  return fields.map(({ name, label, autoComplete, ...layout }) =>
    name === 'adminArea1' ? (
      <FormField
        key={name}
        control={currentZodForm.control}
        name={name}
        render={({ field }) => (
          <FormItem className='min-w-0'>
            <FormLabel className='text-sm text-white'>
              {isUsCountry(country) ? 'State' : label}
            </FormLabel>
            <FormControl>
              <ShippingStateField
                {...field}
                country={country}
                value={field.value ?? ''}
                className='min-h-11 min-w-0 rounded-xl border-white/35 bg-transparent text-base focus-visible:ring-white/40'
              />
            </FormControl>
            <FormMessage className='text-rose-300' />
          </FormItem>
        )}
      />
    ) : (
      <GenericCheckoutInfoInput
        key={name}
        currentZodForm={currentZodForm}
        inputName={name}
        labelString={label}
        autoComplete={autoComplete}
        className={'fullWidth' in layout ? 'sm:col-span-2' : undefined}
      />
    ),
  );
}
