'use server';

import axios, { AxiosError, AxiosResponse } from 'axios';
import { getServerAccessToken } from '@/lib/session/server-session';
import { redirect } from 'next/navigation';
import { IUserShopProfile } from '../types/user-shop-interface';

const client = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
});

export const fetchUserShopProfile = async () => {
  const mainAccessToken = await getServerAccessToken();

  if (!mainAccessToken) {
    return null;
  }

  try {
    const resp: AxiosResponse<IUserShopProfile> = await client.get('/shop/my-shop-profile', {
      headers: {
        Authorization: `Bearer ${mainAccessToken}`,
      },
    });

    return resp.data;
  } catch (err) {
    const error = err as AxiosError;
    const status = error.response?.status;

    if (status === 401 || status === 403 || status === 404) {
      redirect('/next-api/logout');
    }

    return null;
  }
};
