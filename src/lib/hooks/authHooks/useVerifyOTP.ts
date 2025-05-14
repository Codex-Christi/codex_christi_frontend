/* eslint-disable @typescript-eslint/no-explicit-any */
import errorToast from "@/lib/error-toast";
import loadingToast from "@/lib/loading-toast";
import successToast from "@/lib/success-toast";
import axios, { AxiosResponse } from "axios";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const tokenClient = axios.create({
	baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
});

type otpType = { email: string; otp: string };
type resendOTPType = { email: string };
type UserDataReturnType = {
	status: number;
	success: boolean;
	message: string;
};

export const useVerifyOTP = () => {
    const router = useRouter();

    const verifyOTP = async (userDetails: otpType) => {
        const loadingToastID = loadingToast({
			message: "Please wait a moment...",
        });

		try {
			const verifyOTPRes: AxiosResponse<UserDataReturnType> =
				await tokenClient.post(`/account/otp/verify`, {
					...userDetails,
				});

			toast.dismiss(loadingToastID);

			if (verifyOTPRes?.data?.success) {
				successToast({
					message: "Account verified successfully.",
					header: "Account Verified!",
				});

                router.replace(`/auth/sign-in`);

				return verifyOTPRes.data;
			}
        } catch (err: any) {
            toast.dismiss(loadingToastID);

			if (err?.response?.data?.errors) {
				errorToast({
					message: err?.response?.data?.errors[0]?.message as string,
				});

				return;
			}

			errorToast({
				message: String(err),
			});
		}
	};

	return { verifyOTP };
};

export const useResendOTP = () => {
    const resendOTP = async (userDetails: resendOTPType) => {
        const loadingToastID = loadingToast({
			message: "Please wait a moment...",
        });

		try {
			const resendOTPRes: AxiosResponse<UserDataReturnType> =
				await tokenClient.post(`/account/otp/resend-otp`, { ...userDetails });

            if (resendOTPRes?.data?.success) {
				successToast({
					message: "OTP resent successfully.",
					header: "OTP Resent!",
				});

				return resendOTPRes.data;
			}
		} catch (err: unknown) {
			toast.dismiss(loadingToastID);

			errorToast({
				message: String(err),
			});

			return String(err);
		}
	};

	return { resendOTP };
};
