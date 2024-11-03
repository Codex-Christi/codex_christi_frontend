'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Form } from '@/components/UI/primitives/form';
import {
	SignUpFormSchemaWithRefine,
	SignUpFormSchemaWithRefineType,
} from '@/lib/formSchemas/signUpFormSchema';
import { useCallback, useRef } from 'react';
import { ContinueButton, SubmitButton } from '../FormActionButtons';
import {
	CheckBoxInput,
	EmailInput,
	NameInput,
	PasswordInput,
} from '../FormFields';
import { useRegularSignUp } from '@/lib/hooks/authHooks/useSignUp';
import { useRouter } from 'next/navigation';

// Styles import
import styles from '@/styles/auth_pages_styles/FormStyles.module.css';
import { useCustomToast } from '@/lib/hooks/useCustomToast';

const SignUpForm = () => {
	const router = useRouter();

	// Hooks
	const { signUp, userData, isError, errorMsg } = useRegularSignUp();

	const { triggerCustomToast } = useCustomToast();

	// Define form
	const signupZodForm = useForm<SignUpFormSchemaWithRefineType>({
		resolver: zodResolver(SignUpFormSchemaWithRefine),
		defaultValues: {
			firstname: '',
			lastname: '',
			email: '',
			password: '',
			confirm_password: '',
			terms_and_policy: undefined,
		},
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

					secondDiv.classList.remove(
						styles.secondFormFieldSetHiddenState,
					);

					// Add permanent class state to second div
					secondDiv.classList.replace(
						styles.bringInSecondFieldSetsLeft,
						styles.secondFormFieldSetVisibleState,
					);
				}
			}, 300);
		}
		//
	}, [signupZodForm]);

	//   Signup form submit handler
	const signUpFormSubmitHandler: SubmitHandler<
		SignUpFormSchemaWithRefineType
	> = async (fieldValues, event) => {
		// Prevent default first
		event?.preventDefault();
		const { firstname, lastname, email, password } = fieldValues;

		// Format names well

		const userSendData = {
			name: `${firstname.trim()} ${lastname.trim()}`,
			email,
			password,
		};

		await signUp(userSendData);

		if (isError) {
			triggerCustomToast('error', errorMsg);
		}

		if (!isError) {
			triggerCustomToast('success', 'Account creation successful.');
		}

		if (userData?.email === email) {
			router.replace(`/auth/verify-otp?email=${userData?.email}`);
		}
	};

	// Main JSX
	return (
		<Form {...signupZodForm}>
			<form
				onSubmit={signupZodForm.handleSubmit(signUpFormSubmitHandler)}
				className={`mt-12 !font-montserrat
                    sm:w-[70%] sm:max-w-[400px]
                    md:w-[50%] md:max-w-[410px]
                    lg:w-full lg:max-w-[425px]
                    mx-auto relative flex -mb-12`}
			>
				{/* First set of fields */}
				<div
					ref={firstFormFieldSetRef}
					className={`${styles.firstFormFieldSet}`}
				>
					{/* First Name Input*/}
					<NameInput
						currentZodForm={signupZodForm}
						inputName='firstname'
					/>

					{/* Last Name Input*/}
					<NameInput
						currentZodForm={signupZodForm}
						inputName='lastname'
					/>

					<ContinueButton
						onClick={() => moveOutFirstFieldsSetLeft()}
					/>
				</div>
				{/*  */}

				{/* Second Set of Fields */}
				<div
					ref={secondFormFieldSetRef}
					className={`${styles.secondFormFieldSetHiddenState}`}
				>
					{/* Email Input*/}
					<EmailInput
						currentZodForm={signupZodForm}
						inputName='email'
					/>

					{/* First Password Input*/}
					<PasswordInput
						currentZodForm={signupZodForm}
						inputName='password'
					/>

					{/* Confirm Password Input*/}
					<PasswordInput
						currentZodForm={signupZodForm}
						inputName='confirm_password'
					/>

					{/* Terms and Provacy Part */}
					<CheckBoxInput
						currentZodForm={signupZodForm}
						name='terms_and_policy'
					>
						I agree with the Terms and Privacy Policy
					</CheckBoxInput>

					<SubmitButton textValue={'Continue'} />
				</div>
				{/*  */}
			</form>
		</Form>
	);
};

export default SignUpForm;
