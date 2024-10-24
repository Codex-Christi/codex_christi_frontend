'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/UI/primitives/form';
import { InputWithIcon } from '@/components/UI/auth_pages/forms/InputWithIcon';
import { FC, ReactNode } from 'react';
import CustomFormMessage from '../auth_pages/forms/CustomFormMessage';
import { SignUpFormSchemaType } from '@/lib/formSchemas/signUpFormSchema';
import { signInSchemeType } from '@/lib/formSchemas/signInSchema';
import { UseFormReturn } from 'react-hook-form';
import { Checkbox } from '@/components/UI/primitives/checkbox';
import { IconType } from 'react-icons/lib';

// Styles
import styles from '@/styles/auth_pages_styles/FormStyles.module.css';

// General Types
type zodFormType = UseFormReturn<signInSchemeType | SignUpFormSchemaType>;

// Interfaces
interface NameInputInterface {
  inputName: 'firstname' | 'lastname';
  currentZodForm: zodFormType;
}

interface EmailInputProps {
  inputName: 'email';
    currentZodForm: zodFormType;
    label?: string
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

/*
    SVG Icon Components for inputs:
*/

// User Icon
const UserIcon: IconType = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width='14'
    height='14.093'
    viewBox='-247 -7284.51 14 14.093'
    style={{ WebkitPrintColorAdjust: 'exact' }}
    fill='none'
    version='1.1'
  >
    <g data-testid='Group-148' opacity='1'>
      <g data-testid='Vector-2273'>
        <g data-testid='svg-path-1470' opacity='1'>
          <path
            fill='#fff'
            d='M-242.219-7277.651a3.738 3.738 0 004.438 0 3.753 3.753 0 001.575-3.065 3.794 3.794 0 10-7.588 0 3.753 3.753 0 001.575 3.065z'
            className='0'
          ></path>
        </g>
        <g data-testid='svg-path-1471' opacity='1'>
          <path
            fill='#fff'
            d='M-242.219-7277.651a3.738 3.738 0 004.438 0 3.753 3.753 0 001.575-3.065 3.794 3.794 0 10-7.588 0 3.753 3.753 0 001.575 3.065z'
            className='0'
          ></path>
        </g>
      </g>
      <g data-testid='Vector-2274' opacity='1'>
        <path
          fill='#fff'
          d='M-233.011-7271.841a7.031 7.031 0 00-3.657-5.327 4.446 4.446 0 01-.99.723 4.87 4.87 0 01-4.684 0 4.446 4.446 0 01-.99-.723 7.031 7.031 0 00-3.657 5.327c-.048.358.062.72.304.99.241.275.588.433.954.433h11.462c.366 0 .713-.158.954-.433.242-.27.352-.632.304-.99z'
          className='0'
        ></path>
      </g>
    </g>
  </svg>
);

const EmailIcon: IconType = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width='14'
    height='10'
    viewBox='-247 -7187.464 14 10'
    style={{ WebkitPrintColorAdjust: 'exact' }}
    fill='none'
    version='1.1'
  >
    <g data-testid='Vector-2275' opacity='1'>
      <path
        fill='#fff'
        fillRule='evenodd'
        d='M-246.916-7186.666a1.25 1.25 0 011.166-.798h11.5a1.25 1.25 0 011.166.799l-6.777 4.742a.249.249 0 01-.241.003l-6.814-4.746zm13.916 1.162v6.79a1.248 1.248 0 01-1.25 1.25h-11.5a1.25 1.25 0 01-1.25-1.25v-6.792l6.337 4.415.024.015c.403.248.91.247 1.312-.001l.024-.015 6.303-4.412z'
        className='0'
      ></path>
    </g>
  </svg>
);

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
              startIcon={UserIcon}
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
  const { inputName, currentZodForm, label = "Email" } = props;

  // Main JSX
  return (
    <FormField
      control={currentZodForm.control}
      name={inputName}
      render={({ field }) => (
        <FormItem>
          <FormLabel className='text-white'>{label}</FormLabel>
          <FormControl>
            <InputWithIcon
              startIcon={EmailIcon}
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
