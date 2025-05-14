"use client";

import errorToast from "@/lib/error-toast";
import { ResetPasswordLogo } from "@/components/UI/general/IconComponents/AuthLogo";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import { Form } from "@/components/UI/primitives/form";
import {
	resetPasswordSchema,
	resetPasswordSchemaType,
} from "@/lib/formSchemas/resetPasswordSchema";
import { PasswordInput } from "@/components/UI/Auth/FormFields";
import { SubmitButton } from "@/components/UI/Auth/FormActionButtons";
import { usePasswordReset } from "@/lib/hooks/authHooks/usePasswordReset";
import { useSearchParams } from "next/navigation";
import { useResendOTP } from "@/lib/hooks/authHooks/useVerifyOTP";

const ForgotPassword = () => {
	const { resetPassword } = usePasswordReset();

    const { resendOTP } = useResendOTP();

	const searchParams = useSearchParams();
	const email = searchParams.get("email");

	const resetPasswordZodForm = useForm<resetPasswordSchemaType>({
		resolver: zodResolver(resetPasswordSchema),
		defaultValues: {
			otp: "",
			password: "",
			confirm_password: ""
		},
		mode: "all",
		reValidateMode: "onBlur",
	});

    const resetPasswordSubmitHandler: SubmitHandler<
		resetPasswordSchemaType
	> = async (fieldValues) => {
		const { password, otp } = fieldValues;

        if (!email) {
            errorToast({
                header: "Email Required!",
                message: "Please provide a valid email address"
            });

            return;
        }

		const userSendData = {
			email: email ?? "",
			password,
			otp,
		};

        await resetPassword(userSendData);

	};

	return (
		<Form {...resetPasswordZodForm}>
			<form
				onSubmit={resetPasswordZodForm.handleSubmit(
					resetPasswordSubmitHandler
				)}
				className={`mt-12 px-4 sm:px-0 !font-inter
                    sm:w-[70%] sm:max-w-[400px]
                    md:w-[50%] md:max-w-[410px]
                    lg:w-[100%] lg:max-w-[425px]
                    mx-auto relative`}
			>
				<h1 className="text-bold text-3xl text-center mb-8">
					Password Change
				</h1>

				<ResetPasswordLogo />

				<PasswordInput
					currentZodForm={resetPasswordZodForm}
					inputName="otp"
				/>

				<PasswordInput
					currentZodForm={resetPasswordZodForm}
					inputName="password"
				/>

				<PasswordInput
					currentZodForm={resetPasswordZodForm}
					inputName="confirm_password"
				/>

				<p className="w-full text-center mb-4">
					If you didn’t receive a code,{" "}
					<button
						className="text-white font-semibold"
						type="button"
						onClick={async () => {
							await resendOTP({
								email:
									email ??
									prompt("Enter email: ")?.trim() ??
									("" as string),
							});
						}}
					>
						Resend
					</button>
				</p>

				<SubmitButton
					name="Change Password"
					textValue="Change Password"
				/>
			</form>
		</Form>
	);
};

export default ForgotPassword;
