'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Form } from '@/components/UI/primitives/form';
import { signInSchema, signInSchemaType } from '@/lib/formSchemas/signInSchema';
import { EmailInput, PasswordInput } from '@/components/UI/Auth/FormFields';
import { SubmitButton } from '@/components/UI/Auth/FormActionButtons';
import { useLogin } from '@/lib/hooks/authHooks/useLogin';
import Link from 'next/link';
import GoogleIcon from '@/components/GoogleIcon';
import AppleIcon from '@/components/AppleIcon';
import GitHubIcon from '@/components/GitHubIcon';
import { useSearchParams } from 'next/navigation';
import { useCustomToast } from '@/lib/hooks/useCustomToast';
import { useEffect } from 'react';

const SignIn = () => {
	const { login, isError, errorMsg, userData, isLoading } = useLogin();

	const { triggerCustomToast } = useCustomToast();

    const searchParams = useSearchParams();
    const email = searchParams.get('email');

	const signInForm = useForm<signInSchemaType>({
		resolver: zodResolver(signInSchema),
		defaultValues: {
			email: email ?? '',
			password: '',
		},
		mode: 'all',
		reValidateMode: 'onBlur',
	});

	//   Signup form submit handler
	const signInFormSubmitHandler: SubmitHandler<signInSchemaType> = async (
		fieldValues,
		event,
	) => {
		// Prevent default first
		event?.preventDefault();

		const { email, password } = fieldValues;

		const userSendData = {
			email,
			password,
		};

		await login(userSendData);
	};

	// useEffects
	useEffect(() => {
		if (isLoading) {
			triggerCustomToast('processs', 'Please wait moment');
		}

		if (isError === true) {
			triggerCustomToast('error', errorMsg);
		}

		if (isError === false && userData !== null) {
			triggerCustomToast('success', 'Login successful.');
		}

		console.log(userData);
	}, [errorMsg, isError, isLoading, triggerCustomToast, userData]);

	// Main JSX
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
				<EmailInput
					currentZodForm={signInForm}
					inputName='email'
				/>

				<PasswordInput
					currentZodForm={signInForm}
					inputName='password'
				/>

				<SubmitButton textValue='Log In' />

				<div className='mt-16 space-y-12 text-center'>
					<div className='space-y-4 lg:w-1/2 lg:mx-auto'>
						<p>or Sign In with</p>

						<div className='flex place-content-center justify-between gap-4 mx-auto'>
							<Link href=''>
								<GoogleIcon />
							</Link>

							<Link href=''>
								<AppleIcon />
							</Link>

							<Link href=''>
								<GitHubIcon />
							</Link>
						</div>
					</div>

					<p className='w-full text-center'>
						Don’t have an account?{' '}
						<Link
							className='text-white font-semibold'
							type='button'
							href='/auth/signup'
						>
							Sign Up
						</Link>
					</p>
				</div>
			</form>
		</Form>
	);
};

export default SignIn;
