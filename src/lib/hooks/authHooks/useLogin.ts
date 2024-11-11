import axios, { AxiosError, AxiosResponse } from 'axios';
import { useState } from 'react';

const tokenClient = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
});

type loginType = { email: string; password: string };
type UserDataReturnType = { id: number; name: string; email: string };

interface SignInHookInterface {
  isLoading: boolean;
  isError: boolean;
  errorMsg: string;
  userData: UserDataReturnType | null;
}

const defaultSignUpProcessState: SignInHookInterface = {
  isLoading: false,
  isError: false,
  errorMsg: '',
  userData: null,
};

export const useLogin = () => {
  const [loginProcessState, setLoginProcessState] =
    useState<SignInHookInterface>(defaultSignUpProcessState);

  const login = async (userDetails: loginType) => {
    setLoginProcessState;
    try {
      const loginRes: AxiosResponse<UserDataReturnType> =
        await tokenClient.post(`/api/token/`, { ...userDetails });

      setLoginProcessState({
        isLoading: false,
        isError: false,
        errorMsg: '',
        userData: loginRes.data,
      });

      return loginRes.data;
    } catch (err: AxiosError | any) {
      const { data } = err.response;

      setLoginProcessState((prev) => ({
        ...prev,
        isLoading: false,
        isError: true,
        errorMsg: data.detail || 'An error occurred',
      }));

      return data.detail ? data.detail : 'An error occurred';
    }
  };

  return { ...loginProcessState, login };
};
