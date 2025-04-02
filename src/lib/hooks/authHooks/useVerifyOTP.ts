/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosError, AxiosResponse } from 'axios';
import { useState } from 'react';

const tokenClient = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}/v1`,
});

type otpType = { email: string; otp: string };
type resendOTPType = { email: string };
type UserDataReturnType = { id: number; name: string; email: string };

interface IVerifyOTP {
  isLoading: boolean;
  isError: boolean;
  errorMsg: string;
  userData: UserDataReturnType | null;
}

const defaultVerifyOTPProcessState: IVerifyOTP = {
  isLoading: false,
  isError: false,
  errorMsg: '',
  userData: null,
};

export const useVerifyOTP = () => {
  const [verifyOTPProcessState, setVerifyOTPProcessState] =
    useState<IVerifyOTP>(defaultVerifyOTPProcessState);

  const verifyOTP = async (userDetails: otpType) => {
    try {
      const verifyOTPRes: AxiosResponse<UserDataReturnType> =
        await tokenClient.post(`/verify-otp`, { ...userDetails });

      setVerifyOTPProcessState({
        isLoading: false,
        isError: false,
        errorMsg: '',
        userData: verifyOTPRes.data,
      });

      return verifyOTPRes.data;
    } catch (err: AxiosError | any) {
      const { data } = err.response;

      setVerifyOTPProcessState((prev) => ({
        ...prev,
        isLoading: false,
        isError: true,
        errorMsg: data.non_field_errors[0],
      }));

      return data.non_field_errors[0];
    }
  };

  return { ...verifyOTPProcessState, verifyOTP };
};

export const useResendOTP = () => {
  const [verifyOTPProcessState, setVerifyOTPProcessState] =
    useState<IVerifyOTP>(defaultVerifyOTPProcessState);

  const resendOTP = async (userDetails: resendOTPType) => {
    try {
      const resendOTPRes: AxiosResponse<UserDataReturnType> =
        await tokenClient.post(`/resend-otp`, { ...userDetails });

      setVerifyOTPProcessState({
        isLoading: false,
        isError: false,
        errorMsg: '',
        userData: resendOTPRes.data,
      });

      return resendOTPRes.data;
    } catch (err: AxiosError | any) {
      const { data } = err.response;

      setVerifyOTPProcessState((prev) => ({
        ...prev,
        isLoading: false,
        isError: true,
        errorMsg: Array.isArray(data.email) ? data.email[0] : err.message,
      }));

      return Array.isArray(data.email) ? data.email[0] : err.message;
    }
  };

  return { ...verifyOTPProcessState, resendOTP };
};
