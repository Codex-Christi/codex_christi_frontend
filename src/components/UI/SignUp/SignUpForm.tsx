'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitHandler, useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  signUpFormSchema,
  SignUpFormSchemaType,
} from '@/lib/formSchemas/signUpFormSchema';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const SignUpForm = () => {
  // Define form
  const zodForm = useForm<SignUpFormSchemaType>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: { fullname: '' },
    mode: 'all',
    reValidateMode: 'onBlur',
  });

  //   Signup form submit handler
  const signUpFormSubmitHandler: SubmitHandler<SignUpFormSchemaType> = (
    fieldValues,
    event
  ) => {
    // Prevent default first
    event?.preventDefault();
    const { fullname } = fieldValues;

    alert(fullname);
  };

  // Main JSX
  return (
    <Form {...zodForm}>
      <form
        onSubmit={zodForm.handleSubmit(signUpFormSubmitHandler)}
        className={`w-[80%] max-w-[375px] mt-12
        sm:w-[70%] sm:max-w-[400px]
        md:w-[50%] md:max-w-[410px]
        lg:w-[45%] lg:max-w-[425px]
        min-h-[60vh] mx-auto`}
      >
        <FormField
          control={zodForm.control}
          name='fullname'
          render={({ field }) => (
            <FormItem>
              <FormLabel className='text-white'>Full name</FormLabel>
              <FormControl>
                <Input
                  className={`bg-transparent border border-white focus:!border-none focus:!outline-0
                    focus-visible:!ring-0 autofill:!bg-transparent rounded-3xl`}
                  placeholder='Enter your full name...'
                  {...field}
                />
              </FormControl>
              {/* <FormDescription>This is your full name.</FormDescription> */}
              <FormMessage className='text-red-400' />
            </FormItem>
          )}
        />

        <Button type='submit'>Submit</Button>
      </form>
    </Form>
  );
};

export default SignUpForm;
