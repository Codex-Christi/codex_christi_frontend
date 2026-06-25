"use server";

import { getServerDjangoApiBaseUrl } from "@/lib/django/getServerDjangoApiBaseUrl";
import { createSession } from "@/lib/session/main-session";
import { getServerSessionState, getServerUserID } from "@/lib/session/server-session";
import {
	asRecord,
	getDjangoAuthErrorMessage,
	getNestedAuthToken,
} from "@/lib/session/django-auth-response";

export interface AuthSessionState {
  isAuthenticated: boolean;
  user_id: string | null;
}

export type CreateLoginSessionResult =
	| {
			success: true;
			sessionState: AuthSessionState;
	  }
	| {
			success: false;
			error: string;
	  };

type LoginCredentials = {
	email: string;
	password: string;
};

export async function createLoginSession(
	accessToken: string,
	refreshToken: string,
): Promise<CreateLoginSessionResult> {
	try {
		const session = await createSession(accessToken, refreshToken);

		return {
			success: true,
			sessionState: {
				isAuthenticated: true,
				user_id: session.userID,
			},
		};
	} catch (err: Error | unknown) {
		return {
			success: false,
			error: `${err}`,
		};
	}
}

export async function loginUser({
	email,
	password,
}: LoginCredentials): Promise<CreateLoginSessionResult> {
	try {
		const response = await fetch(`${getServerDjangoApiBaseUrl()}/auth/user-login`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({ email, password }),
			cache: "no-store",
		});
		const payload: unknown = await response.json().catch(() => null);

		if (!response.ok || asRecord(payload)?.success !== true) {
			return {
				success: false,
				error: getDjangoAuthErrorMessage(payload, "Login failed. Please try again."),
			};
		}

		const accessToken = getNestedAuthToken(payload, "access");
		const refreshToken = getNestedAuthToken(payload, "refresh");

		if (!accessToken || !refreshToken) {
			return {
				success: false,
				error: "Login response did not include session tokens.",
			};
		}

		return createLoginSession(accessToken, refreshToken);
	} catch (err: Error | unknown) {
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

export async function getUserID() {
	return (await getServerUserID()) as string;
}

export async function getAuthSessionState(): Promise<AuthSessionState> {
	const sessionState = await getServerSessionState();

	return {
		isAuthenticated: sessionState.isAuthenticated,
		user_id: sessionState.userID,
	};
}
