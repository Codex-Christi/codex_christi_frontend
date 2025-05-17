/* eslint-disable @typescript-eslint/no-explicit-any */
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
	email: string;
};

export type PasswordResetType = {
    email: string;
    otp: string;
    password: string;
};

export type UserDataReturnType = {
	status: number;
	success: boolean;
	message: string;
	data: { id: string; first_name: string; last_name: string; email: string };
};

interface PasswordResetHookInterface {
	isLoading: boolean;
	isError: boolean | undefined;
	errorMsg: string;
	userData: UserDataReturnType | null;
}

const defaultPasswordResetProcessState: PasswordResetHookInterface = {
	isLoading: false,
	isError: undefined,
	errorMsg: "",
	userData: null,
};

export const usePasswordReset = () => {
	const router = useRouter();

	const [passwordResetProcessState, setPasswordResetProcessState] =
		useState<PasswordResetHookInterface>(defaultPasswordResetProcessState);

	const passwordResetOTP = useCallback(
		async (userDetails: UserDataSendType) => {
			setPasswordResetProcessState((prev) => ({
				...prev,
				isLoading: true,
			}));

			const loadingToastID = loadingToast({
				message: "Please wait a moment...",
            });


			try {
				const passwordResetRes: AxiosResponse<UserDataReturnType> =
					await client.post(`/account/password-reset-otp`, userDetails);

				toast.dismiss(loadingToastID);

				if (passwordResetRes?.data?.success) {
					successToast({
						message: "OTP sent successfully.",
						header: "OTP Sent!",
					});

					setPasswordResetProcessState({
						isLoading: false,
						isError: false,
						errorMsg: "",
						userData: passwordResetRes.data,
					});

					router.replace(
						`/auth/reset-password?email=${userDetails?.email.toLowerCase()}`,
					);

					return passwordResetRes.data;
				}

				throw new Error(passwordResetRes?.data?.message);
			} catch (err: any) {
				toast.dismiss(loadingToastID);

				if (err?.response?.data?.errors) {
					errorToast({
						message: err?.response?.data?.errors[0]
							?.message as string,
					});

					return;
				}

				errorToast({
					message: String(err),
				});
			}
		},
		[router],
	);

    const resetPassword = useCallback(
		async (userDetails: PasswordResetType) => {
			setPasswordResetProcessState((prev) => ({
				...prev,
				isLoading: true,
			}));

			const loadingToastID = loadingToast({
				message: "Please wait a moment...",
			});

			try {
				const passwordResetRes: AxiosResponse<UserDataReturnType> =
					await client.post(
						`/account/forgotten-password-reset`,
						userDetails,
					);

				toast.dismiss(loadingToastID);

				if (passwordResetRes?.data?.success) {
					successToast({
						message: "Password reset successfully.",
						header: "Password Reset Successful!",
					});

					setPasswordResetProcessState({
						isLoading: false,
						isError: false,
						errorMsg: "",
						userData: passwordResetRes.data,
					});

					router.replace(
						`/auth/sign-in`,
					);

					return passwordResetRes.data;
				}

				throw new Error(passwordResetRes?.data?.message);
			} catch (err: any) {
				toast.dismiss(loadingToastID);

				if (err?.response?.data?.errors) {
					errorToast({
						message: err?.response?.data?.errors[0]
							?.message as string,
					});

					return;
				}

				errorToast({
					message: String(err),
				});
			}
		},
		[router],
	);

	return { ...passwordResetProcessState, passwordResetOTP, resetPassword };
};
