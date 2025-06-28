import { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { BasicCheckoutInfoFormSchema } from './BasicCheckoutInfo';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/UI/primitives/form';
import { Input } from '@/components/UI/primitives/input';
import CustomFormMessage from '@/components/UI/auth_pages/forms/CustomFormMessage';

// Interfaces
interface GenericCheckoutInfoInputInterface<T extends FieldValues> {
  inputName: keyof BasicCheckoutInfoFormSchema | string;
  placeholder: keyof BasicCheckoutInfoFormSchema | string;
  labelString: keyof BasicCheckoutInfoFormSchema | string;
  currentZodForm: UseFormReturn<T>;
}

export const GenericCheckoutInfoInput = <T extends FieldValues>(
  props: GenericCheckoutInfoInputInterface<T>
) => {
  //   Props

  const { inputName, currentZodForm, placeholder, labelString } = props;

  // Main JSX
  return (
    <FormField
      control={currentZodForm.control}
      name={inputName as Path<T>}
      render={({ field }) => (
        <FormItem className='w-full flex flex-col'>
          <FormLabel className='text-white pb-[0.5rem]'>{`${labelString}`}</FormLabel>
          <FormControl>
            <Input
              className={`bg-transparent border border-white focus:!outline-0 focus-visible:!ring-0 autofill:!bg-transparent rounded-3xl !mt-0 placeholder:!text-white/75`}
              placeholder={`${placeholder}`}
              {...field}
            />
          </FormControl>
          {/* <FormDescription>This is your full name.</FormDescription> */}
          <CustomFormMessage className='text-red-400 !mt-0' />
        </FormItem>
      )}
    />
  );
};
