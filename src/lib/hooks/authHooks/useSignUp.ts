import axios, { AxiosError, AxiosResponse } from 'axios';
import { useCallback, useState } from 'react';

const client = axios.create({
	baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}/v1`,
});

type UserDataSendType = { name: string; email: string; password: string; };

type UserDataReturnType = { id: Number; name: string; email: string; };

interface SignupHookInterface {
	isLoading: boolean;
	isError: boolean;
	errorMsg: string;
	userData: UserDataReturnType | null;
}
interface SignUpResponse {
	user: UserDataReturnType; // Assuming response includes a user object
	message?: string; // Optional message for success/error
}

// Default values
const defaultSignUpProcessState: SignupHookInterface = {
	isLoading: false,
	isError: false,
	errorMsg: '',
	userData: null,
};

// Main SignUp Hook
export const useRegularSignUp = () => {
	// State values
	const [signupProcessState, setSignupProcessState] =
		useState<SignupHookInterface>(defaultSignUpProcessState);

	// Main singup func
	const signUp = useCallback(
		async (
			userDetails: UserDataSendType,
		): Promise<SignUpResponse | string> => {
			// Set loading state to true before making the request
			setSignupProcessState((prev) => ({
				...prev,
				isLoading: true,
				isError: false,
			}));

			try {
				const signUpRes: AxiosResponse<UserDataReturnType> =
					await client.post(`/users/`, { ...userDetails });

				// Set state with the user data on successful request
				setSignupProcessState({
					isLoading: false,
					isError: false,
					errorMsg: '',
					userData: signUpRes.data,
				});

				return { user: signUpRes.data }; // Return structured response
			} catch (err: unknown) {
				// Handle error case and set loading to false
				setSignupProcessState((prev) => ({
					...prev,
					isLoading: false,
					isError: true,
					errorMsg:
						(err as AxiosError).message || 'An error occurred', // Handle error message
                }));

				return (err as AxiosError).message; // Return error message
			}
		},
		[],
	);

	return { ...signupProcessState, signUp };
};
