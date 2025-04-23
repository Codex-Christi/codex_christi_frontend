import ContentContainer from "@/components/UI/profile/ContentContainer";
import ProfileBanner from "@/components/UI/profile/ProfileBanner";
import ProfileContainer from "@/components/UI/profile/ProfileContainer";
// import axios, { AxiosError, AxiosResponse } from "axios";
// import { cookies } from "next/headers";

// const client = axios.create({
// 	baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
// });

export const revalidate = 600;

// interface UserData {
// 	id: string;
// 	first_name: string;
// 	last_name: string;
// 	email: string;
// }

// const getUser = async () => {
//   const accessToken = (await cookies()).get('accessToken')?.value;

//   const apiResponse = await client
//     .get('/account/user-profile', {
//       headers: {
//         Authorization: `Bearer ${accessToken}`,
//       },
//     })
//     .then((resp: AxiosResponse<UserData>) => resp.data)
//     .catch((err: AxiosError) => err);

//   console.log(apiResponse);

//   return apiResponse;
// };

export default async function Page() {
	//   const apiResponse = await getUser();

	return (
		<ContentContainer>
            <div className="bg-[#0D0D0D]/30 backdrop-blur-lg rounded-[10px]">
                <ProfileBanner />

                <ProfileContainer />
            </div>
		</ContentContainer>
	);
}
