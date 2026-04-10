"use server";

import { createSession } from "@/lib/session/main-session";
import { getServerSessionState, getServerUserID } from "@/lib/session/server-session";

export interface AuthSessionState {
  isAuthenticated: boolean;
  user_id: string | null;
}

export async function createLoginSession(
	accessToken: string,
	refreshToken: string,
) {
	try {
		await createSession(accessToken, refreshToken);

		return {
			success: true,
		};
	} catch (err: Error | unknown) {
		return {
			success: false,
			error: `${err}`,
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
