import { NextRequest, NextResponse } from "next/server";
import { redirectLoggedInUserToProfile } from "../session/session-redirect";
import { getCookie } from "../session/main-session";
import { logoutUser } from "@/actions/logout";

export const redirectLoggedInUserToProfileMiddleware = async (
	request: NextRequest,
) => {
	return await redirectLoggedInUserToProfile(request);
};

export const redirectExpSessionToLoginPage = async (req: NextRequest) => {
	try {
		const isSessionAvailable = (await getCookie("session")) ? true : false;

		if (!isSessionAvailable) {
			await logoutUser();

			return NextResponse.redirect(
				new URL("/auth/sign-in?sessionExp=true", req.url),
			);
		}
    } catch {
        return NextResponse.redirect(
			new URL("/auth/sign-in?sessionExp=true", req.url),
		);
	}
};
