import axios, { AxiosError, AxiosResponse } from 'axios';
import loadingToast from '@/lib/loading-toast';
import errorToast from '@/lib/error-toast';
import successToast from '@/lib/success-toast';
import { toast } from 'sonner';
import { getCookie, decrypt } from '@/lib/session/main-session';
import { redirect } from 'next/navigation';

const client = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
});

export const fetchUserWishlist = async () => {
  const sessionCookie = await getCookie('session');

  const decryptedSessionCookie = await decrypt(sessionCookie?.value);

  const mainAccessToken = decryptedSessionCookie
    ? (decryptedSessionCookie.mainAccessToken as string)
    : ('' as string);

  try {
    const resp: AxiosResponse<{
      status: number;
      success: boolean;
      message: string;
      data: Record<string, string | number | boolean>[];
    }> = await client.get('/wishlist/get-wishlist', {
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

export const addToWishlist = async (product_ids: string[]) => {
  const loadingToastID = loadingToast({
    message: 'Processing request...',
  });

  const sessionCookie = await getCookie('session');

  const decryptedSessionCookie = await decrypt(sessionCookie?.value);

  const mainAccessToken = decryptedSessionCookie
    ? (decryptedSessionCookie.mainAccessToken as string)
    : ('' as string);

  try {
    const resp: AxiosResponse<{
      status: number;
      success: boolean;
      message: string;
      data: Record<string, string | number | boolean>[];
    }> = await client.post(
      '/wishlist/add-product',
      { product_ids },
      {
        headers: {
          Authorization: `Bearer ${mainAccessToken}`,
        },
      },
    );

    toast.dismiss(loadingToastID);

    successToast({
      message: 'Added to wishlist successfully.',
      header: 'Product Added to Wishlist',
    });

    return resp.data;
  } catch (error) {
    toast.dismiss(loadingToastID);

    const axiosError = error as AxiosError<{
      errors?: Array<{ message: string }>;
      message?: string;
    }>;

    const errorMessage =
      axiosError.response?.data?.errors?.[0]?.message ||
      axiosError.response?.data?.message ||
      axiosError.message ||
      'Error adding product to wishlist. Please try again.';

    errorToast({
      message: errorMessage,
    });
  }
};

export const removeFromWishlist = async (product_ids: string[]) => {
  const loadingToastID = loadingToast({
    message: 'Processing request...',
  });

  const sessionCookie = await getCookie('session');

  const decryptedSessionCookie = await decrypt(sessionCookie?.value);

  const mainAccessToken = decryptedSessionCookie
    ? (decryptedSessionCookie.mainAccessToken as string)
    : ('' as string);

  try {
    toast.dismiss(loadingToastID);

    const resp: AxiosResponse<{
      status: number;
      success: boolean;
      message: string;
      data: Record<string, string | number | boolean>[];
    }> = await client.post(
      '/wishlist/remove-products',
      { product_ids },
      {
        headers: {
          Authorization: `Bearer ${mainAccessToken}`,
        },
      },
    );

    successToast({
      message: 'Product deleted successfully.',
      header: 'Product Deleted Wishlist',
    });

    return resp.data;
  } catch (error) {
    toast.dismiss(loadingToastID);

    const axiosError = error as AxiosError<{
      errors?: Array<{ message: string }>;
      message?: string;
    }>;

    const errorMessage =
      axiosError.response?.data?.errors?.[0]?.message ||
      axiosError.response?.data?.message ||
      axiosError.message ||
      'Error removing product from wishlist. Please try again.';

    errorToast({
      message: errorMessage,
    });
  }
};
