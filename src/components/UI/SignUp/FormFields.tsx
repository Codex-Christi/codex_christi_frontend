'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { FC } from 'react';
import CustomFormMessage from '../general/auth_pages/forms/CustomFormMessage';
import {
  signUpFormSchema,
  SignUpFormSchemaType,
} from '@/lib/formSchemas/signUpFormSchema';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// General Types
type zodFormType = UseFormReturn<SignUpFormSchemaType>;

// Interfaces
interface NameInputInterface {
  inputName: 'firstname' | 'lastname';
  currentZodForm: zodFormType;
}

interface EmailInputProps {
  inputName: 'email';
  currentZodForm: zodFormType;
}

interface PasswordInputProps {
  inputName: 'password' | 'confirm_password';
  currentZodForm: zodFormType;
}

// Name Input
export const NameInput: FC<NameInputInterface> = (props) => {
  //   Props

  const { inputName, currentZodForm } = props;

  // Hooks

  //   Userful Vars
  const [inPutNamePt1] = inputName.split(/(?=name)/g);

  // Main JSX
  return (
    <FormField
      control={currentZodForm.control}
      name={inputName}
      render={({ field }) => (
        <FormItem>
          <FormLabel className='text-white'>{`${
            inPutNamePt1.charAt(0).toUpperCase() + inPutNamePt1.slice(1)
          }name`}</FormLabel>
          <FormControl>
            <Input
              className={`bg-transparent border border-white focus:!border-none focus:!outline-0
                    focus-visible:!ring-0 autofill:!bg-transparent rounded-3xl !mt-0 placeholder:!text-white/75`}
              placeholder={`Enter your ${inPutNamePt1} name...`}
              {...field}
            />
          </FormControl>
          {/* <FormDescription>This is your full name.</FormDescription> */}
          <CustomFormMessage className='text-red-400' />
        </FormItem>
      )}
    />
  );
};

// Email Input
export const EmailInput: FC<EmailInputProps> = (props) => {
  // Props
  const { inputName, currentZodForm } = props;

  // Main JSX
  return (
    <FormField
      control={currentZodForm.control}
      name={inputName}
      render={({ field }) => (
        <FormItem>
          <FormLabel className='text-white'>Email</FormLabel>
          <FormControl>
            <Input
              className={`bg-transparent border border-white focus:!border-none focus:!outline-0
                    focus-visible:!ring-0 autofill:!bg-transparent rounded-3xl !mt-0 placeholder:!text-white/75`}
              placeholder={`Enter your email`}
              {...field}
            />
          </FormControl>
          <CustomFormMessage className='text-red-400' />
        </FormItem>
      )}
    />
  );
};

// Password Input

export const PasswordInput: FC<PasswordInputProps> = (props) => {
  // Props
  const { currentZodForm, inputName } = props;

  // Bools
  const isConfirmPaswwordField = inputName === 'confirm_password';

  // Main JSX
  return (
    <FormField
      control={currentZodForm.control}
      name={inputName}
      render={({ field }) => (
        <FormItem>
          <FormLabel className='text-white'>
            {isConfirmPaswwordField ? 'Confirm Password' : 'Password'}
          </FormLabel>
          <FormControl>
            <Input
              className={`bg-transparent border border-white focus:!border-none focus:!outline-0
                    focus-visible:!ring-0 autofill:!bg-transparent rounded-3xl !mt-0 placeholder:!text-white/75`}
              placeholder={
                isConfirmPaswwordField
                  ? 'Confirm Password'
                  : 'Enter your password'
              }
              {...field}
              type='password'
            />
          </FormControl>
          <CustomFormMessage className='text-red-400' />
        </FormItem>
      )}
    />
  );
};

// CheckBox Input
