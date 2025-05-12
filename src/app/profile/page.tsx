import { decrypt } from '@/lib/session/main-session';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { cookies } from 'next/headers';
import ProfilePageMainComponent from '@/components/UI/profile/ProfilePageMainComponent';

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
  const accessToken =
    (await decrypt((await cookies()).get('session')?.value)) ?? null;

  if (!accessToken) {
    return;
  }

  const mainAccessToken = accessToken
    ? (accessToken.mainAccessToken as string)
    : ('' as string);

  const apiResponse = await client
    .get('/account/my-profile', {
      headers: {
        Authorization: `Bearer ${mainAccessToken}`,
      },
    })
    .then((resp: { data: AxiosResponse<UserData> }) => resp.data.data)
    .catch((err: AxiosError) => err);

  return apiResponse;
};

export default async function Page() {
  try {
    const userDataApiResponse = await getUser();

    const doesResponseHaveUserData = userDataApiResponse
      ? 'first_name' in userDataApiResponse
      : false;

    if (doesResponseHaveUserData) {
      const responseObj = userDataApiResponse as UserData;
      return (
        <ProfilePageMainComponent serverFetchedProfileUserData={responseObj} />
      );
    }
  } catch (error) {
    const requestError = error as Error;
    // Handle the case where user data is not available
    return <h5>An error occured: {requestError.message}</h5>;
  }
}
