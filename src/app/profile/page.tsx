import ContentContainer from "@/components/UI/profile/ContentContainer";
import ProfileBanner from "@/components/UI/profile/ProfileBanner";
import ProfileContainer from "@/components/UI/profile/ProfileContainer";
import { Button } from "@/components/UI/primitives/button";
import { decrypt } from "@/lib/session/main-session";
import axios, { AxiosError, AxiosResponse } from "axios";
import { cookies } from "next/headers";

const client = axios.create({
	baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
});

export const revalidate = 600;

interface UserData {
	id: string;
	first_name: string;
	last_name: string;
	email: string;
}

// Pre rendering get User SSR order
const getUser = async () => {
	const accessToken = await decrypt((await cookies()).get("session")?.value);

	const mainAccessToken = accessToken
		? accessToken.mainAccessToken
		: ("" as string);

	const apiResponse = await client
		.get("/account/my-profile", {
			headers: {
				Authorization: `Bearer ${mainAccessToken}`,
			},
		})
		.then((resp: { data: AxiosResponse<UserData> }) => resp.data.data)
		.catch((err: AxiosError) => err);

	return apiResponse;
};

export default async function Page() {
	const userDataApiResponse = await getUser();
	const doesResponseHaveUserData = "first_name" in userDataApiResponse;

	return (
		<ContentContainer>
			<div className="bg-[#0D0D0D]/30 rounded-[10px]">
				<ProfileBanner />

				<ProfileContainer />
			</div>
		</ContentContainer>
	);

	// if (doesResponseHaveUserData) {
	// 	const responseObj = apiResponse;
	// 	return (
	// 		<div>
	// 			<h3>Hello {responseObj.first_name}</h3>
	// 			<Button
	// 				name="Logout button"
	// 				className="my-3"
	// 			>
	// 				Logout User
	// 			</Button>
	// 		</div>
	// 	);
	// } else {
	// 	const { err: requestError } = { err: apiResponse.message };
	// 	return <h5>An error occured: {requestError}</h5>;
	// }
}
