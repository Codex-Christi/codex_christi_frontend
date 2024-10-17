import { useCallback, useState } from "react";
import axios, { AxiosError, AxiosResponse } from "axios";

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
};
