'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/UI/primitives/button';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/UI/primitives/form';
import { CountryDropdown } from '@/components/UI/primitives/country-dropdown';
import { SignUpFormSchema } from '@/lib/formSchemas/signUpFormSchema';
import { EmailInput, NameInput } from '@/components/UI/Auth/FormFields';
import { FaAngleDoubleDown } from 'react-icons/fa';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { useContext } from 'react';
import { CheckoutAccordionContext } from '../ProductCheckout';

const signupExtSchema = SignUpFormSchema.pick({
  firstname: true,
  lastname: true,
  email: true,
});
const FormSchema = z
  .object({
    country: z.string({
      required_error: 'Please select a country',
    }),
  })
  .merge(signupExtSchema);

type FormSchema = z.infer<typeof FormSchema>;

export const BasicCheckoutInfo = () => {
  // Hooks
  const { handleOpenItem } = useContext(CheckoutAccordionContext);

  const basicCheckoutInfoForm = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: useShopCheckoutStore((state) => {
      const { delivery_address, first_name, last_name, email } = state;

      const { shipping_country } = delivery_address;

      return {
        country: shipping_country ?? undefined,
        firstname: first_name,
        lastname: last_name,
        email,
      };
    }),
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    console.log(data);
    // Only spread the rest of the data except country
    const { country, firstname, lastname, ...rest } = data;
    useShopCheckoutStore.setState((state) => ({
      ...state,
      first_name: firstname,
      last_name: lastname,
      delivery_address: {
        ...state.delivery_address,
        shipping_country: country,
      },
      ...rest,
    }));
    // Move Accordion to Delivery Details
    handleOpenItem('delivery-details');
  }

  return (
    <>
      <h2 className='border-b max-w-fit mb-10 border-white pb-1 text-xl font-bold'>
        User Information
      </h2>
      <Form {...basicCheckoutInfoForm}>
        <form
          onSubmit={basicCheckoutInfoForm.handleSubmit(onSubmit)}
          className='w-full  grid grid-cols-1 md:grid-cols-2 gap-x-20 gap-y-1 md:gap-y-4 items-center'
        >
          {/* First Name Input*/}
          <NameInput
            currentZodForm={basicCheckoutInfoForm}
            inputName='firstname'
          />

          {/* Last Name Input*/}
          <NameInput
            currentZodForm={basicCheckoutInfoForm}
            inputName='lastname'
          />

          {/* Email Input */}
          <EmailInput
            currentZodForm={basicCheckoutInfoForm}
            inputName='email'
          />

          {/* Country Input */}
          <FormField
            control={basicCheckoutInfoForm.control}
            name='country'
            render={({ field }) => (
              <FormItem className='self-baseline'>
                <FormLabel>Country</FormLabel>
                <CountryDropdown
                  placeholder='Country'
                  defaultValue={field.value}
                  onChange={(country) => {
                    field.onChange(country.alpha3);
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            name='Checkout Summary Submit'
            type='submit'
            className=' col-span-1 md:col-span-2 w-full max-w-[400px] mt-5 mx-auto rounded-3xl
            !font-bold px-4 sm:px-6 py-2 sm:py-3 text-lg sm:text-base
            bg-stone-500 hover:bg-stone-100 hover:bg-opacity-10 bg-opacity-10 
            backdrop-blur-md shadow-md shadow-gray-400 flex gap-6'
            // border-[#0085FF] text-white bg-[#0085FF] hover:bg-[#0085FF]/70 hover:text-white
          >
            <h4>Choose Delivery Address</h4>
            <FaAngleDoubleDown size={22.5} />
            <style jsx>
              {`
                h4 {
                  word-spacing: 0.25rem;
                }
              `}
            </style>
          </Button>
        </form>
      </Form>
    </>
  );
};
