import axios, { AxiosError, AxiosResponse } from 'axios';
import { useState } from 'react';

const tokenClient = axios.create({
	baseURL: 'https://saintproject.onrender.com/api/',
});

type loginType = { email: string; password: string; };
type UserDataReturnType = { id: Number; name: string; email: string };

interface SignupHookInterface {
	isLoading: boolean;
	isError: boolean;
	erroMsg: string;
	userData: UserDataReturnType | null;
}

const defaultSignUpProcessState: SignupHookInterface = {
	isLoading: false,
	isError: false,
	erroMsg: '',
	userData: null,
};

export const useLogin = () => {
	const [loginProcessState, setLoginProcessState] =
		useState<SignupHookInterface>(defaultSignUpProcessState);

	const login = async (userDetails: loginType) => {
		setLoginProcessState;
		try {
			const loginRes: AxiosResponse<loginType, UserDataReturnType> =
				await tokenClient.post(`/token/`, { ...userDetails });

			return loginRes.data;
		} catch (err: AxiosError | any) {
			return err.message;
		}
	};

	return { ...loginProcessState, login };
};
