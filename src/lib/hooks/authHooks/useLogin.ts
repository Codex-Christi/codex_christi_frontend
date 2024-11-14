import axios, { AxiosError, AxiosResponse } from 'axios';
import { useCallback, useState } from 'react';

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

  const login = useCallback(async (userDetails: loginType) => {
    setLoginProcessState((prev) => {
      return { ...prev, isLoading: true };
    });
    try {
      const loginRes: AxiosResponse<UserDataReturnType> =
        await tokenClient.post(`/token/`, { ...userDetails });

      setLoginProcessState({
        isLoading: false,
        isError: false,
        errorMsg: '',
        userData: loginRes.data,
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
  }, []);

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
