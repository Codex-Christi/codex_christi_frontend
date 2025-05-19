import errorToast from "@/lib/error-toast";
import loadingToast from "@/lib/loading-toast";
import successToast from "@/lib/success-toast";
import axios, { AxiosResponse } from "axios";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

const client = axios.create({
	baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
});

export type UserDataSendType = {
	first_name: string;
	last_name: string;
	email: string;
	password: string;
};

export type UserDataReturnType = {
	status: number;
	success: boolean;
	message: string;
	data: { id: string; first_name: string; last_name: string; email: string };
};

interface SignupHookInterface {
	isLoading: boolean;
	isError: boolean | undefined;
	errorMsg: string;
	userData: UserDataReturnType | null;
}

interface SignUpResponse {
  data: UserDataReturnType; // Assuming response includes a user object

  message?: string; // Optional message for success/error
  success: boolean; // Indicates success or failure
}

const defaultSignUpProcessState: SignupHookInterface = {
	isLoading: false,
	isError: undefined,
	errorMsg: "",
	userData: null,
};

export const useRegularSignUp = () => {
	const router = useRouter();

	const [signupProcessState, setSignupProcessState] =
		useState<SignupHookInterface>(defaultSignUpProcessState);

	const signUp = useCallback(
		async (userDetails: UserDataSendType) => {
			setSignupProcessState((prev) => ({
				...prev,
				isLoading: true,
			}));

			const loadingToastID = loadingToast({
				message: "Please wait a moment...",
			});

			try {
				const signUpRes: AxiosResponse<UserDataReturnType> =
					await client.post(`/account/user-registration`, {
						...userDetails,
					});

                toast.dismiss(loadingToastID);

				if (signUpRes?.data?.success) {
					successToast({
						message: "Account creation successful.",
						header: "Account Created Sucessfully.",
                    });

                    setSignupProcessState({
						isLoading: false,
						isError: false,
						errorMsg: "",
						userData: signUpRes.data,
					});

					router.replace(
						`/auth/verify-otp?email=${signUpRes?.data?.data?.email}`,
					);

					return signUpRes.data;
				}

				throw new Error(signUpRes?.data?.message);
            } catch (err: unknown) {
                toast.dismiss(loadingToastID);

				setSignupProcessState((prev) => ({
					...prev,
					isLoading: false,
					isError: true,
					errorMsg: String(err),
				}));

				errorToast({
					message: String(err),
				});

				return String(err);
			}
		},
		[router],
	);

	return { ...signupProcessState, signUp };

};
