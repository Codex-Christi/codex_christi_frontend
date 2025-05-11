import axios, { AxiosError, AxiosResponse } from 'axios';
import { useCallback, useMemo, useState } from 'react';
import { createLoginSession } from '@/actions/login';
// import useAuthStore from '@/stores/authStore';
import { verifySession } from '@/lib/session/session-validate';
import { useRouter } from 'next/navigation';

const tokenClient = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
});

type loginType = { email: string; password: string };
export type LoginDataReturnType = {
  data: { refresh: string; access: string };
  success: boolean;
};

interface SignInHookInterface {
  isLoading: boolean;
  isError: boolean;
  errorMsg: string;
}

const defaultSignUpProcessState: SignInHookInterface = {
  isLoading: false,
  isError: false,
  errorMsg: '',
};

// Main useLogin
export const useLogin = () => {
  // Hooks
  // const { autoUpDateSession } = useAuthStore((state) => state);
  const router = useRouter();

  // State values
  const [loginProcessState, setLoginProcessState] =
    useState<SignInHookInterface>(useMemo(() => defaultSignUpProcessState, []));

  // Main Login Func
  const login = useCallback(
    async (userDetails: loginType) => {
      setLoginProcessState((prev) => {
        return { ...prev, isLoading: true };
      });
      try {
        const loginRes: AxiosResponse<LoginDataReturnType> =
          await tokenClient.post(`/auth/user-login`, { ...userDetails });

        const { refresh: refreshToken, access: accessToken } =
          loginRes.data.data;

        const sessionStatus = await createLoginSession(
          accessToken,
          refreshToken
        );
        if (sessionStatus.success === true) {
          setLoginProcessState({
            isLoading: false,
            isError: false,
            errorMsg: '',
          });

          // Manually check is session is created and active (from server)
          const isSessionActive = await verifySession();

          if (isSessionActive === true) {
            router.push('/profile');
          }
        } else {
          throw new Error(sessionStatus.error);
        }
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
    },
    [router]
  );

  return { ...loginProcessState, login };
};

export const properlyReturnAnyError = (error: AxiosError) => {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      // Return responseText
      console.log(error.response);

      const errorsObj = error.response?.data as {
        errors: Array<{ code: number; message: string }>;
      };
      const errorArr = errorsObj.errors;
      if (errorArr && errorArr.length > 0) {
        // If there are multiple errors, return the first one

        return errorArr[0].message as string;
      } else {
        // If there are no errors, return the status text
        return error.response.statusText;
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
