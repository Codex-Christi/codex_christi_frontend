"use client";

import { PasswordResetLogo } from "@/components/UI/general/IconComponents/AuthLogo";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import { Form } from "@/components/UI/primitives/form";
import { EmailInput } from "@/components/UI/Auth/FormFields";
import { SubmitButton } from "@/components/UI/Auth/FormActionButtons";
import { z } from "zod";
import { SignUpFormSchema } from "@/lib/formSchemas/signUpFormSchema";

const forgotPasswordSchema = SignUpFormSchema.pick({
	email: true,
	password: undefined,
});

export type ForgotPasswordSchemaType = z.infer<typeof forgotPasswordSchema>;

const ForgotPassword = () => {
	const forgotPasswordForm = useForm<ForgotPasswordSchemaType>({
		resolver: zodResolver(forgotPasswordSchema),
		defaultValues: {
			email: "",
		},
		mode: "all",
		reValidateMode: "onBlur",
	});

	//   Signup form submit handler
	const forgotPasswordFormSubmitHandler: SubmitHandler<
		ForgotPasswordSchemaType
	> = async (fieldValues, event) => {
		// Prevent default first
		event?.preventDefault();

		const { email } = fieldValues;

		const userSendData = {
			email,
		};
	};

	return (
		<Form {...forgotPasswordForm}>
			<form
				onSubmit={forgotPasswordForm.handleSubmit(
					forgotPasswordFormSubmitHandler,
				)}
				className={`mt-12 px-4 sm:px-0 !font-inter
                    sm:w-[70%] sm:max-w-[400px]
                    md:w-[50%] md:max-w-[410px]
                    lg:w-[100%] lg:max-w-[425px]
                    mx-auto relative`}
			>
				<h1 className="text-bold text-3xl text-center mb-8">
					Forgot Password
				</h1>

				<PasswordResetLogo />

				<EmailInput
					currentZodForm={forgotPasswordForm}
					inputName="email"
					label="Enter your email address"
				/>

				<SubmitButton
					name="Next"
					textValue="Next"
				/>
			</form>
		</Form>
	);
};

export default ForgotPassword;
