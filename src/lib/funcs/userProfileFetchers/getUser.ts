'use server';

import { decrypt } from '@/lib/session/main-session';
import { UserProfileDataInterface } from '@/lib/types/user-profile/main-user-profile';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

const client = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
});

export const getUser = cache(async () => {
  const accessToken = (await decrypt((await cookies()).get('session')?.value)) ?? null;

  if (!accessToken) {
    return;
  }

  const mainAccessToken = accessToken ? (accessToken.mainAccessToken as string) : ('' as string);

  const apiResponse = await client
    .get('/account/my-profile', {
      headers: {
        Authorization: `Bearer ${mainAccessToken}`,
      },
    })
    .then((resp: { data: AxiosResponse<UserProfileDataInterface> }) => resp.data.data)
    .catch(async (err: AxiosError) => {
      // Handle unauthorized access
      const statusCode = (err as AxiosError).response?.status;
      if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
        // Handle unauthorized access
        console.log('User not found or unauthorized access');

        redirect('/next-api/logout');
      }
    });

  return apiResponse;
});
