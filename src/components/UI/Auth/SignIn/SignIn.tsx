'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Form } from '@/components/UI/primitives/form';
import { signInSchema, signInSchemaType } from '@/lib/formSchemas/signInSchema';
import { EmailInput, PasswordInput } from '@/components/UI/Auth/FormFields';
import { SubmitButton } from '@/components/UI/Auth/FormActionButtons';
import { useLogin } from '@/lib/hooks/authHooks/useLogin';

const SignIn = () => {
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
        <EmailInput currentZodForm={signInForm} inputName='email' />

        <PasswordInput currentZodForm={signInForm} inputName='password' />

        <SubmitButton textValue='Log In' />
      </form>
    </Form>
  );
};

export default SignIn;
