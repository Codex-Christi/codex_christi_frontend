import axios, { AxiosError, AxiosResponse } from 'axios';
import { useState } from 'react';

const tokenClient = axios.create({
	baseURL: 'https://saintproject.onrender.com/api/v1',
});

type otpType = { email: string; otp: string };
type resendOTPType = { email: string };
type UserDataReturnType = { id: Number; name: string; email: string };

interface IVerifyOTP {
	isLoading: boolean;
	isError: boolean;
	erroMsg: string;
	userData: UserDataReturnType | null;
}

const defaultVerifyOTPProcessState: IVerifyOTP = {
	isLoading: false,
	isError: false,
	erroMsg: '',
	userData: null,
};

export const useVerifyOTP = () => {
	const [verifyOTPProcessState, setVerifyOTPProcessState] =
		useState<IVerifyOTP>(defaultVerifyOTPProcessState);

	const verifyOTP = async (userDetails: otpType) => {
		setVerifyOTPProcessState;
		try {
			const verifyOTPRes: AxiosResponse<otpType, UserDataReturnType> =
				await tokenClient.post(`/verify-otp/`, { ...userDetails });

			return verifyOTPRes.data;
		} catch (err: AxiosError | any) {
			return err.message;
		}
	};

	return { ...verifyOTPProcessState, verifyOTP };
};

export const useResendOTP = () => {
	const [verifyOTPProcessState, setVerifyOTPProcessState] =
		useState<IVerifyOTP>(defaultVerifyOTPProcessState);

	const resendOTP = async (userDetails: resendOTPType) => {
		setVerifyOTPProcessState;
		try {
			const resendOTPRes: AxiosResponse<
				resendOTPType,
				UserDataReturnType
			> = await tokenClient.post(`/resend-otp/`, { ...userDetails });

			return resendOTPRes.data;
		} catch (err: AxiosError | any) {
			return err.message;
		}
	};

	return { ...verifyOTPProcessState, resendOTP };
};
