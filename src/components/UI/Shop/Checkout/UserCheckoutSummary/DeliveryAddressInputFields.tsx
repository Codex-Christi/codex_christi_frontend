import { FieldValues, UseFormReturn } from 'react-hook-form';
import { GenericCheckoutInfoInput } from './GenericCheckoutInfoInput';
import { BasicCheckoutInfoFormSchema } from './BasicCheckoutInfo';

interface DeliveryInputFieldsProps<T extends FieldValues> {
  //   billingAddress: BillingAddress;
  //   handleBillingAddressChange: (
  //     field: keyof BillingAddress,
  //     value: string
  //   ) => void;
  currentZodForm: UseFormReturn<T>;
}

// Main Component
export const DeliveryAddressInputFields = ({
  currentZodForm,
}: DeliveryInputFieldsProps<BasicCheckoutInfoFormSchema>) => {
  // Main JSX
  return (
    <>
      {/* Delivery Details Inputs */}
      {(
        [
          { placeholder: 'Address Line 1', strName: 'addressLine1' },
          { placeholder: 'Apt. Number (Address Line 2) ', strName: 'addressLine2' },
          { placeholder: 'State / Province', strName: 'adminArea1' },
          { placeholder: 'City / Town', strName: 'adminArea2' },
          { placeholder: 'Postal Code', strName: 'postalCode' },
        ] as {
          placeholder: string;
          strName: string;
        }[]
      ).map((each) => {
        const { strName, placeholder } = each;
        return (
          <GenericCheckoutInfoInput
            currentZodForm={currentZodForm}
            key={strName as string}
            inputName={strName as string}
            placeholder={placeholder}
            labelString={placeholder}
          />
        );
      })}
    </>
  );
};
