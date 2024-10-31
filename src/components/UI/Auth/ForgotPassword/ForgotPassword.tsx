'use client';

import { PasswordResetLogo } from '@/components/AuthLogo';
import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Form } from '@/components/UI/primitives/form';
import { signInSchema, signInSchemaType } from '@/lib/formSchemas/signInSchema';
import { EmailInput, PasswordInput } from '@/components/UI/Auth/FormFields';
import { SubmitButton } from '@/components/UI/Auth/FormActionButtons';
import { useLogin } from '@/lib/hooks/authHooks/useLogin';

const ForgotPassword = () => {
  const { login } = useLogin();

  const signInForm = useForm<signInSchemaType>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'all',
    reValidateMode: 'onBlur',
  });

  //   Signup form submit handler
  const signInFormSubmitHandler: SubmitHandler<signInSchemaType> = async (
    fieldValues,
    event
  ) => {
    // Prevent default first
    event?.preventDefault();

    const { email, password } = fieldValues;

    const userSendData = {
      email,
      password,
    };

    const serverResponse = await login(userSendData);

    console.log(serverResponse);
  };

  return (
    <Form {...signInForm}>
      <form
        onSubmit={signInForm.handleSubmit(signInFormSubmitHandler)}
        className={`mt-12 px-4 sm:px-0 !font-montserrat
                    sm:w-[70%] sm:max-w-[400px]
                    md:w-[50%] md:max-w-[410px]
                    lg:w-[100%] lg:max-w-[425px]
                    mx-auto relative`}
      >
        <h1 className='text-bold text-3xl text-center mb-8'>Forgot Password</h1>

        <PasswordResetLogo />

        <EmailInput
          currentZodForm={signInForm}
          inputName='email'
          label='Enter your email address'
        />

        <SubmitButton textValue='Next' />
      </form>
    </Form>
  );
};

export default ForgotPassword;
