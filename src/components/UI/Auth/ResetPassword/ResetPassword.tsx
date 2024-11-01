'use client';

import { ResetPasswordLogo } from '@/components/AuthLogo';
import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Form } from '@/components/UI/primitives/form';
import {
  resetPasswordSchema,
  resetPasswordSchemaType,
} from '@/lib/formSchemas/resetPasswordSchema';
import { PasswordInput } from '@/components/UI/Auth/FormFields';
import { SubmitButton } from '@/components/UI/Auth/FormActionButtons';
import { useLogin } from '@/lib/hooks/authHooks/useLogin';

const ForgotPassword = () => {
  const { login } = useLogin();

  const resetPasswordZodForm = useForm<resetPasswordSchemaType>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'all',
    reValidateMode: 'onBlur',
  });

  //   Signup form submit handler
  const resetPasswordSubmitHandler: SubmitHandler<
    resetPasswordSchemaType
  > = async (fieldValues, event) => {
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
    <Form {...resetPasswordZodForm}>
      <form
        onSubmit={resetPasswordZodForm.handleSubmit(resetPasswordSubmitHandler)}
        className={`mt-12 px-4 sm:px-0 !font-montserrat
                    sm:w-[70%] sm:max-w-[400px]
                    md:w-[50%] md:max-w-[410px]
                    lg:w-[100%] lg:max-w-[425px]
                    mx-auto relative`}
      >
        <h1 className='text-bold text-3xl text-center mb-8'>Password Change</h1>

        <ResetPasswordLogo />

        <PasswordInput
          currentZodForm={resetPasswordZodForm}
          inputName='password'
        />

        <PasswordInput
          currentZodForm={resetPasswordZodForm}
          inputName='confirm_password'
        />

        <SubmitButton textValue='Confirm Password' />
      </form>
    </Form>
  );
};

export default ForgotPassword;
