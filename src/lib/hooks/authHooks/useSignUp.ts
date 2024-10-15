import { useCallback, useState } from 'react';
import axios, { AxiosError } from 'axios';

const baseUrl = 'https://saintproject.onrender.com/api/v1';

// Types and Interfaces
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
  erroMsg: '',
  userData: null,
};

// Main SignUp Hook
export const useRegularSignUp = () => {
  // State values
  const [loginProcessState, setLoginProcessState] =
    useState<SignupHookInterface>(defaultSignUpProcessState);

  const signUp = useCallback(async (userDetails: UserDataSendType) => {
    await axios
      .post<UserDataReturnType>(`${baseUrl}/users`, {
        ...userDetails,
      })
      .then((response) => response.data)
      .catch((err: AxiosError | any) => err.message);
  }, []);

  return { ...loginProcessState };
};
