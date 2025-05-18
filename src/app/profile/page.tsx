'use server';

import { decrypt } from '@/lib/session/main-session';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { cookies } from 'next/headers';
import ProfilePageMainComponent from '@/components/UI/profile/ProfilePageMainComponent';
import { redirect } from 'next/navigation';
const client = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
});

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
    .get('/account/my-profil', {
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
