'use client';
import React from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';

import { Button } from '@/components/UI/primitives/button';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/UI/primitives/form';

import {
  Country,
  CountryDropdown,
} from '@/components/UI/primitives/country-dropdown';

const FormSchema = z.object({
  country: z.string({
    required_error: 'Please select a country',
  }),
});

type FormSchema = z.infer<typeof FormSchema>;

export const UserCheckoutSummary = () => {
  const [selectedCountry, ,] = React.useState<Country | null>(null);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    console.log(data);

    toast.success(`${selectedCountry?.name} ${selectedCountry?.emoji} `);
  }

  return (
    <>
      <h2 className='border-b max-w-fit mb-10 border-white pb-1 text-xl font-bold'>
        User Information
      </h2>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className='w-full max-w-[200px] space-y-6'
        >
          <FormField
            control={form.control}
            name='country'
            render={({ field }) => (
              <FormItem>
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
          <Button name='Checkout Summary Submit' type='submit'>
            Submit
          </Button>
        </form>
      </Form>
    </>
  );
};
