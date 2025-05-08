import axios, { AxiosError, AxiosResponse } from 'axios';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { properlyReturnAnyError } from './useLogin';

const client = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
});

export type UserDataSendType = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
};

export type UserDataReturnType = { id: string; name: string; email: string };

interface SignupHookInterface {
  isLoading: boolean;
  isError: boolean | undefined;
  errorMsg: string;
  userData: UserDataReturnType | null;
}
// interface SignUpResponse {
//   user: UserDataReturnType; // Assuming response includes a user object
//   message?: string; // Optional message for success/error
//   email?: string;
// }

// Default values
const defaultSignUpProcessState: SignupHookInterface = {
  isLoading: false,
  isError: undefined,
  errorMsg: '',
  userData: null,
};

// Main SignUp Hook
export const useRegularSignUp = () => {
  // Hooks
  const router = useRouter();

  // State values
  const [signupProcessState, setSignupProcessState] =
    useState<SignupHookInterface>(defaultSignUpProcessState);

  // Main singup func
  const signUp = useCallback(
    async (userDetails: UserDataSendType) => {
      // Set loading state to true before making the request
      setSignupProcessState((prev) => ({
        ...prev,
        isLoading: true,
      }));

      try {
        const signUpRes: AxiosResponse<UserDataReturnType> = await client.post(
          `/account/user-registration`,
          { ...userDetails }
        );

        // Set state with the user data on successful request
        setSignupProcessState({
          isLoading: false,
          isError: false,
          errorMsg: '',
          userData: signUpRes.data,
        });

        // Perform redirection
        setTimeout(() => {
          router.replace(`/auth/verify-otp?email=${signUpRes.data.email}`);
        }, 3000);

        // Perform redirection
        setTimeout(() => {
          router.replace(`/auth/verify-otp?email=${signUpRes.data.email}`);
        }, 3000);

        return signUpRes.data; // Return structured response
      } catch (err: unknown) {
        // Handle error case and set loading to false
        setSignupProcessState((prev) => ({
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

  return { ...signupProcessState, signUp };
};
