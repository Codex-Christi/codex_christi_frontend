import { useState } from 'react';

const baseUrl = 'https://saintproject.onrender.com/api/v1';

interface SignupHookInterface {
  isLoading: boolean;
  isError: boolean;
  erroMsg: string;
  userData: { id: Number; name: string; email: string } | null;
}

const defaultSignUpProcessState: SignupHookInterface = {
  isLoading: false,
  isError: false,
  erroMsg: '',
  userData: null,
};

// Main SignUp Hook
export const useRegularSignUp = () => {
  const [loginProcessState, setLoginProcessState] =
    useState<SignupHookInterface>(defaultSignUpProcessState);

  return { loginProcessState };
};
