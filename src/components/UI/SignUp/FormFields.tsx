'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { InputWithIcon } from '@/components/UI/auth_pages/forms/InputWithIcon';
import { FC, ReactNode } from 'react';
import CustomFormMessage from '../auth_pages/forms/CustomFormMessage';
import { SignUpFormSchemaType } from '@/lib/formSchemas/signUpFormSchema';
import { UseFormReturn } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';

// Styles
import styles from '@/styles/auth_pages_styles/FormStyles.module.css';

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

interface CheckBoxInputProps {
  name: 'terms_and_policy';
  currentZodForm: zodFormType;
  children?: ReactNode;
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
            <InputWithIcon
              className={`bg-transparent border border-white focus:!outline-0 
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
            <InputWithIcon
              className={`bg-transparent border border-white focus:!outline-0
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
            <InputWithIcon
              className={`bg-transparent border border-white focus:!outline-0
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

export const CheckBoxInput: FC<CheckBoxInputProps> = (props) => {
  // Props
  const { currentZodForm, name, children } = props;
  const {
    formState: { errors },
  } = currentZodForm;
  const { terms_and_policy: isThereError } = errors;

  return (
    <FormField
      control={currentZodForm.control}
      name={name}
      render={({ field }) => (
        <FormItem
          className={`flex flex-row items-center gap-4 space-y-0 rounded-md py-1 ${
            isThereError ? `${styles.shakeAnimation}` : ''
          }`}
        >
          <FormControl>
            <Checkbox
              className={`w-[1.15rem] h-[1.15rem] ${
                isThereError ? `border-red-400` : 'border-white'
              }`}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </FormControl>
          <FormLabel className={`${isThereError && `text-red-400 `}`}>
            {children}
          </FormLabel>
        </FormItem>
      )}
    />
  );
};
