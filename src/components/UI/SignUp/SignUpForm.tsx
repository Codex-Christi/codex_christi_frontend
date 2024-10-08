'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import {
  signUpFormSchema,
  SignUpFormSchemaType,
} from '@/lib/formSchemas/signUpFormSchema';
import { Button } from '@/components/ui/button';
import { EmailInput, NameInput } from './FormFields';
import { RxCaretRight } from 'react-icons/rx';

// Styles import
import styles from '@/styles/auth_pages_styles/FormStyles.module.css';
import { useCallback, useRef } from 'react';
import { ContinueButton, SubmitButton } from './FormActionButtons';

const SignUpForm = () => {
  // Define form
  const signupZodForm = useForm<SignUpFormSchemaType>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: { firstname: '', lastname: '' },
    mode: 'all',
    reValidateMode: 'onBlur',
  });

  // Refs
  const firstFormFieldSetRef = useRef<HTMLDivElement>(null);
  const secondFormFieldSetRef = useRef<HTMLDivElement>(null);

  // Funcs
  const moveOutFirstFieldsSetLeft = useCallback(async () => {
    const firstDiv = firstFormFieldSetRef.current;
    const secondDiv = secondFormFieldSetRef.current;

    // perform checks
    const isFirstInputSetValid = await signupZodForm.trigger([
      'firstname',
      'lastname',
    ]);

    // Perfom Animation (Remove First Set and bring in second)
    if (isFirstInputSetValid) {
      if (firstDiv && secondDiv) {
        // Move out first div holding its respective fields
        firstDiv.classList.add(styles.moveOutFirstFieldsSetLeft);
        // Bring in second div holding its respective fields
        secondDiv.classList.add(styles.bringInSecondFieldSetsLeft);
      }
      // Wait till animation is done to execute these below
      setTimeout(() => {
        if (firstDiv && secondDiv) {
          firstDiv.classList.add('hidden');
          firstDiv.classList.remove(styles.moveOutFirstFieldsSetLeft);

          secondDiv.classList.remove(styles.secondFormFieldSetHiddenState);

          // Add permanent class state to second div
          secondDiv.classList.replace(
            styles.bringInSecondFieldSetsLeft,
            styles.secondFormFieldSetVisibleState
          );
        }
      }, 300);
    }
    //
  }, [signupZodForm]);

  //   Signup form submit handler
  const signUpFormSubmitHandler: SubmitHandler<SignUpFormSchemaType> = (
    fieldValues,
    event
  ) => {
    // Prevent default first
    event?.preventDefault();
    const { firstname, lastname, email } = fieldValues;

    alert(firstname.trim());
  };

  // Main JSX
  return (
    <Form {...signupZodForm}>
      <form
        onSubmit={signupZodForm.handleSubmit(signUpFormSubmitHandler)}
        className={`w-[80%] max-w-[375px] mt-12 !font-montserrat
        sm:w-[70%] sm:max-w-[400px]
        md:w-[50%] md:max-w-[410px]
        lg:w-[45%] lg:max-w-[425px]
        mx-auto relative flex`}
      >
        {/* First set of fields */}
        <div
          ref={firstFormFieldSetRef}
          className={`${styles.firstFormFieldSet} `}
        >
          {/* First Name Input*/}
          <NameInput currentZodForm={signupZodForm} inputName='firstname' />

          {/* Last Name Input*/}
          <NameInput currentZodForm={signupZodForm} inputName='lastname' />

          <ContinueButton onClick={() => moveOutFirstFieldsSetLeft()} />
        </div>
        {/*  */}

        {/* Second Set of Fields */}
        <div
          ref={secondFormFieldSetRef}
          className={`${styles.secondFormFieldSetHiddenState} `}
        >
          {/* Email Input*/}
          <EmailInput currentZodForm={signupZodForm} inputName='email' />

          {/* Last Name Input*/}
          {/* <NameInput currentZodForm={signupZodForm} inputName='lastname' /> */}

          <SubmitButton textValue={'Continue'} />
        </div>
        {/*  */}
      </form>
    </Form>
  );
};

export default SignUpForm;
