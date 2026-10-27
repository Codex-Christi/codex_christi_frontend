import type { UseFormReturn } from 'react-hook-form';
import { GenericCheckoutInfoInput } from './GenericCheckoutInfoInput';
import type { BasicCheckoutInfoFormSchema } from './BasicCheckoutInfo';

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
  return fields.map(({ name, label, autoComplete, ...layout }) => (
    <GenericCheckoutInfoInput
      key={name}
      currentZodForm={currentZodForm}
      inputName={name}
      labelString={label}
      autoComplete={autoComplete}
      className={'fullWidth' in layout ? 'sm:col-span-2' : undefined}
    />
  ));
}
