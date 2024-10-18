import { useCallback, useState } from "react";
import axios, { AxiosError, AxiosResponse } from "axios";
import { useCallback, useEffect, useState } from 'react';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { useCustomToast } from '../useCustomToast';

const client = axios.create({
	baseURL: "https://saintproject.onrender.com/api/v1",
});

const tokenClient = axios.create({
	baseURL: "https://saintproject.onrender.com/api/",
});

// Types and Interfaces
type loginType = {email: string; password: string};

type UserDataSendType = { name: string; email: string; password: string };
type UserDataReturnType = { id: Number; name: string; email: string };
interface SignupHookInterface {
	isLoading: boolean;
	isError: boolean;
	erroMsg: string;
	userData: UserDataSendType | null;
}

const defaultSignUpProcessState: SignupHookInterface = {
	isLoading: false,
	isError: false,
	erroMsg: "",
	userData: null,
=======
type UserDataSendType = {
  name: string;
  email: string;
  password: string;
};

type UserDataReturnType = {
  id: number; // Use lowercase 'number'
  name: string;
  email: string;
};

interface SignupHookInterface {
  isLoading: boolean;
  isError: boolean;
  errorMsg: string; // Fixed typo from 'erroMsg' to 'errorMsg'
  userData: UserDataReturnType | null; // Update type to return UserDataReturnType
}

interface SignUpResponse {
  user: UserDataReturnType; // Assuming response includes a user object
  message?: string; // Optional message for success/error
}

const defaultSignUpProcessState: SignupHookInterface = {
  isLoading: false,
  isError: false,
  errorMsg: '',
  userData: null,
};

// Main SignUp Hook
export const useRegularSignUp = () => {
	// State values
	const [loginProcessState, setLoginProcessState] =
		useState<SignupHookInterface>(defaultSignUpProcessState);

	const signUp = useCallback(async (userDetails: UserDataSendType) => {
		setLoginProcessState;
		try {
			const signUpRes: AxiosResponse<
				UserDataReturnType,
				UserDataReturnType
			> = await client.post(`/users/`, { ...userDetails });
			return signUpRes.data;
		} catch (err: AxiosError | any) {
			return err.message;
		}
	}, []);

	return { ...loginProcessState, signUp };
};

export const useLogin = () => {
    const [loginProcessState, setLoginProcessState] = useState<SignupHookInterface>(defaultSignUpProcessState);

	const login = useCallback(async (userDetails: loginType) => {
		setLoginProcessState;
		try {
			const loginRes: AxiosResponse<loginType, UserDataReturnType> =
				await tokenClient.post(
					`/token/`,
					{ ...userDetails },
				);

			return loginRes.data;
		} catch (err: AxiosError | any) {
			return err.message;
		}
	}, []);

	return { ...loginProcessState, login };

  // Hooks
  const { triggerCustomToast } = useCustomToast();

  // State values
  const [loginProcessState, setLoginProcessState] =
    useState<SignupHookInterface>(defaultSignUpProcessState);

  useEffect(() => {
    triggerCustomToast('error', 'Hi');
  }, [triggerCustomToast]);

  // Main singup func
  const signUp = useCallback(
    async (userDetails: UserDataSendType): Promise<SignUpResponse | string> => {
      // Set loading state to true before making the request
      setLoginProcessState((prev) => ({
        ...prev,
        isLoading: true,
        isError: false,
      }));

      try {
        const signUpRes: AxiosResponse<UserDataReturnType> = await client.post(
          `/users/`,
          { ...userDetails }
        );

        // Set state with the user data on successful request
        setLoginProcessState({
          isLoading: false,
          isError: false,
          errorMsg: '',
          userData: signUpRes.data,
        });

        return { user: signUpRes.data }; // Return structured response
      } catch (err: unknown) {
        // Handle error case and set loading to false
        setLoginProcessState((prev) => ({
          ...prev,
          isLoading: false,
          isError: true,
          errorMsg: (err as AxiosError).message || 'An error occurred', // Handle error message
        }));
        return (err as AxiosError).message; // Return error message
      }
    },
    []
  );

  return { ...loginProcessState, signUp };
};
