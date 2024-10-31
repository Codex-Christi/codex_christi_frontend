"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Form } from '@/components/UI/primitives/form';
import {
	verifyOTPSchema,
	verifyOTPSchemaType,
} from '@/lib/formSchemas/verifyOTPSchema';
import { useVerifyOTP } from '@/lib/hooks/authHooks/useVerifyOTP';
import { useResendOTP } from '@/lib/hooks/authHooks/useVerifyOTP';
import { useSearchParams } from 'next/navigation';
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from '@/components/UI/primitives/input-otp';
import { SubmitButton } from '@/components/UI/Auth/FormActionButtons';

const VerifyOTP = () => {
	const { verifyOTP } = useVerifyOTP();
	const { resendOTP } = useResendOTP();

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

		const serverResponse = await verifyOTP(userSendData);

		console.log(serverResponse);
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

                <p className="w-full text-center mb-4">
                    If you didn’t receive a code, <button className="text-white font-semibold" type="button" onClick={async () => {
                        const res = await resendOTP({email: email ?? ""});

                        console.log(res)
                    }}>Resend</button>
                </p>
				<SubmitButton textValue='Verify' />
			</form>
		</Form>
	);
};

export default VerifyOTP;
