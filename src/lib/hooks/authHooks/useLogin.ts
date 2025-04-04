import axios, { AxiosError, AxiosResponse } from 'axios';
import { useCallback, useMemo, useState } from 'react';

const tokenClient = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
});

type loginType = { email: string; password: string };
export type LoginDataReturnType = { refresh: string; access: string };

interface SignInHookInterface {
  isLoading: boolean;
  isError: boolean;
  errorMsg: string;
  loginSuccessData: LoginDataReturnType | null;
}

const defaultSignUpProcessState: SignInHookInterface = {
  isLoading: false,
  isError: false,
  errorMsg: '',
  loginSuccessData: null,
};

export const useLogin = () => {
  const [loginProcessState, setLoginProcessState] =
    useState<SignInHookInterface>(useMemo(() => defaultSignUpProcessState, []));

  const login = useCallback(
    async (userDetails: loginType) => {
      if (!loginProcessState.loginSuccessData) {
        setLoginProcessState((prev) => {
          return { ...prev, isLoading: true };
        });
        try {
          const loginRes: AxiosResponse<LoginDataReturnType> =
            await tokenClient.post(`/login`, { ...userDetails });

          setLoginProcessState({
            isLoading: false,
            isError: false,
            errorMsg: '',
            loginSuccessData: loginRes.data,
          });

          return loginRes.data;
        } catch (err: unknown) {
          // Handle error case and set loading to false
          setLoginProcessState((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
            errorMsg:
              properlyReturnAnyError(err as AxiosError) || 'An error occurred', // Handle error message
          }));

          return properlyReturnAnyError(err as AxiosError); // Return error message
        }
      } else {
        alert('Already logged in');
      }
    },
    [loginProcessState.loginSuccessData]
  );

  return { ...loginProcessState, login };
};

export const properlyReturnAnyError = (error: AxiosError) => {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      // Return responseText
      const responseTextObj = JSON.parse(error.response.request.responseText);
      if (typeof responseTextObj === 'object') {
        const responseTextObjArr = Object.values(
          responseTextObj
        )[0] as string[];
        return responseTextObjArr;
      } else {
        return responseTextObj;
      }
    } else if (error.request) {
      // The request was made but no response was received
      return `${error.message}`;
    } else {
      // Something happened in setting up the request that triggered an Error
      return `Error:, ${error.message}`;
    }
  } else {
    // Non-Axios error
    return `An error occured!`;
  }
};
