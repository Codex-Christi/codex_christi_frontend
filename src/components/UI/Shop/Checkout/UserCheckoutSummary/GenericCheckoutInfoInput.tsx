import type { UseFormReturn } from 'react-hook-form';
import type { BasicCheckoutInfoFormSchema } from './BasicCheckoutInfo';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/UI/primitives/form';
import { Input } from '@/components/UI/primitives/input';
import type { HTMLInputTypeAttribute } from 'react';

export function GenericCheckoutInfoInput({
  inputName,
  labelString,
  autoComplete,
  type,
  className,
  currentZodForm,
}: {
  inputName: keyof BasicCheckoutInfoFormSchema;
  labelString: string;
  autoComplete?: string;
  type?: HTMLInputTypeAttribute;
  className?: string;
  currentZodForm: UseFormReturn<BasicCheckoutInfoFormSchema>;
}) {
  return (
    <FormField
      control={currentZodForm.control}
      name={inputName}
      render={({ field }) => (
        <FormItem className={`min-w-0 ${className ?? ''}`}>
          <FormLabel className='text-sm text-white'>{labelString}</FormLabel>
          <FormControl>
            <Input
              {...field}
              value={field.value ?? ''}
              type={type}
              autoComplete={autoComplete}
              className='min-h-11 min-w-0 rounded-xl border-white/35 bg-transparent text-base focus-visible:ring-white/40'
            />
          </FormControl>
          <FormMessage className='text-rose-300' />
        </FormItem>
      )}
    />
  );
}
