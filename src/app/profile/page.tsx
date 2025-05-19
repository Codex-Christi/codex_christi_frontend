import { decrypt } from '@/lib/session/main-session';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { cookies } from 'next/headers';
import ProfilePageMainComponent from '@/components/UI/profile/ProfilePageMainComponent';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
const client = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
});

export const metadata: Metadata = {
  title: 'Profile | Codex Christi',
  description: 'View and edit your personal information',
};

interface UserData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

// export const revalidate = 600;

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
    .catch(async (err: AxiosError) => {
      // Handle unauthorized access
      const statusCode = (err as AxiosError).response?.status;
      if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
        // Handle unauthorized access
        console.log('User not found or unauthorized access');

        redirect('/api/logout');
      }
    });

  return apiResponse;
};

// Async SSR profile page data genarator function
export default async function Page() {
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
}
