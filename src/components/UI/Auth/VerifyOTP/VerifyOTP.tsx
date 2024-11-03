'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Form } from '@/components/UI/primitives/form';
import {
	verifyOTPSchema,
	verifyOTPSchemaType,
} from '@/lib/formSchemas/verifyOTPSchema';
import { useVerifyOTP, useResendOTP } from '@/lib/hooks/authHooks/useVerifyOTP';
import { useSearchParams } from 'next/navigation';
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from '@/components/UI/primitives/input-otp';
import { SubmitButton } from '@/components/UI/Auth/FormActionButtons';
import { useCustomToast } from '@/lib/hooks/useCustomToast';

const VerifyOTP = () => {
	const { verifyOTP, isError, userData, errorMsg } = useVerifyOTP();
	const {
		resendOTP,
		isError: error,
		userData: data,
		errorMsg: msg,
	} = useResendOTP();

	const { triggerCustomToast } = useCustomToast();

	const searchParams = useSearchParams();
	const email = searchParams.get('email');

	const verifyOTPForm = useForm<verifyOTPSchemaType>({
		resolver: zodResolver(verifyOTPSchema),
		defaultValues: {
			email: email ?? '',
			otp: '',
		},
		mode: 'all',
		reValidateMode: 'onBlur',
	});

	const { handleSubmit, setValue } = verifyOTPForm;

	const verifyOTPSubmitHandler: SubmitHandler<verifyOTPSchemaType> = async (
		fieldValues,
	) => {
		const { email, otp } = fieldValues;

		const userSendData = {
			email,
			otp,
		};

		await verifyOTP(userSendData);

		if (isError && !userData) {
			triggerCustomToast('error', errorMsg);
		}

		if (!isError && userData) {
			triggerCustomToast(
				'success',
				'Account verified successfully.',
				'Account verified successfully.',
			);
		}
	};

	return (
		<Form {...verifyOTPForm}>
			<form
				onSubmit={handleSubmit(verifyOTPSubmitHandler)}
				className='mt-12 px-4 sm:px-0 !font-montserrat sm:w-[70%] sm:max-w-[400px] md:w-[50%] md:max-w-[410px] lg:w-[100%] lg:max-w-[425px] mx-auto relative'
			>
				<div className='flex place-content-center mb-8'>
					<InputOTP
						maxLength={6}
						value={verifyOTPForm.watch('otp')}
						onChange={(otp) => setValue('otp', otp)}
					>
						<InputOTPGroup>
							<InputOTPSlot index={0} />
							<InputOTPSlot index={1} />
						</InputOTPGroup>
						<InputOTPSeparator />
						<InputOTPGroup>
							<InputOTPSlot index={2} />
							<InputOTPSlot index={3} />
						</InputOTPGroup>
						<InputOTPSeparator />
						<InputOTPGroup>
							<InputOTPSlot index={4} />
							<InputOTPSlot index={5} />
						</InputOTPGroup>
					</InputOTP>
				</div>

				<p className='w-full text-center mb-4'>
					If you didn’t receive a code,{' '}
					<button
						className='text-white font-semibold'
						type='button'
						onClick={async () => {
							await resendOTP({ email: email ?? '' });

							if (error && !data) {
								triggerCustomToast('error', msg);
							}

							if (!error && data) {
								triggerCustomToast(
									'success',
									'OTP resent successfully',
									'OTP resent successfully',
								);
							}
						}}
					>
						Resend
					</button>
				</p>
				<SubmitButton textValue='Verify' />
			</form>
		</Form>
	);
};

export default VerifyOTP;
