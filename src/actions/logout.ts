/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import loadingToast from '@/lib/loading-toast';
import errorToast from '@/lib/error-toast';
import successToast from '@/lib/success-toast';
import { decrypt, deleteSession } from '@/lib/session/main-session';
import { getCookie } from '@/lib/session/main-session';
import { clearUserMainProfileStore } from '@/stores/userMainProfileStore';
import { toast } from 'sonner';

export const axiosClient = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
});

export const logoutUser = async () => {
  const loadingToastID = loadingToast({
    message: 'Please wait a moment...',
  });

  try {
    const refreshToken = await getCookie('refreshToken');

    const decryptRefreshToken = await decrypt(refreshToken?.value);

    const mainRefreshToken = decryptRefreshToken
      ? (decryptRefreshToken.mainRefreshToken as string)
      : ('' as string);

    const res = await axiosClient.post(
      '/auth/user-logout',
      { refresh: mainRefreshToken }
      // {
      //   headers: {
      //     Authorization: `Bearer ${mainAccessToken}`,
      //   },
      // }
    );

    if (res?.data?.success) {
      await deleteSession();

      clearUserMainProfileStore();

      successToast({
        message: 'You have successfully logged out.',
        header: 'Logout Successful.',
      });

      toast.dismiss(loadingToastID);

      window.location.replace('/auth/sign-in');
      return true;
    }

    throw new Error(res?.data?.message);
  } catch (err: any) {
    toast.dismiss(loadingToastID);

    if (err?.response?.data?.errors) {
      errorToast({
        message: err?.response?.data?.errors[0]?.message as string,
      });

      return {
        status: false,
        error: err?.response?.data?.errors[0]?.message as string,
      };
    }

    errorToast({
      message: String(err),
    });

    return {
      status: false,
      error: err,
    };
  }
};
