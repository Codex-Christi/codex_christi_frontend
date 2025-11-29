/* eslint-disable @typescript-eslint/no-explicit-any */
import loadingToast from '@/lib/loading-toast';
import errorToast from '@/lib/error-toast';
import successToast from '@/lib/success-toast';
import { decrypt, deleteSession } from '@/lib/session/main-session';
import { getCookie } from '@/lib/session/main-session';
import { clearUserMainProfileStore } from '@/stores/userMainProfileStore';
import { toast } from 'sonner';

type LogoutResult = {
  status: boolean;
  error?: string;
};

export const logoutUser = async (): Promise<boolean | LogoutResult> => {
  const loadingToastID = loadingToast({
    message: 'Please wait a moment...',
  });

  try {
    // Get refresh token cookie once and short-circuit early if missing
    const refreshTokenCookie = await getCookie('refreshToken');
    const encryptedRefreshToken = refreshTokenCookie?.value;

    if (!encryptedRefreshToken) {
      throw new Error('No refresh token found');
    }

    // Decrypt once and safely access mainRefreshToken
    const decrypted = await decrypt(encryptedRefreshToken);
    const mainRefreshToken = (decrypted as any)?.mainRefreshToken as string | undefined;

    if (!mainRefreshToken) {
      throw new Error('Invalid refresh token');
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/auth/user-logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: mainRefreshToken }),
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok || !data?.success) {
      const message = data?.message || 'Logout failed.';
      throw new Error(message);
    }

    // Ensure local session and in-memory user state are cleared before redirect
    await deleteSession();
    clearUserMainProfileStore();

    successToast({
      message: 'You have successfully logged out.',
      header: 'Logout Successful.',
    });

    toast.dismiss(loadingToastID);

    window.location.replace('/auth/sign-in');

    return true;
  } catch (err: any) {
    toast.dismiss(loadingToastID);

    const apiErrorMessage =
      err?.response?.data?.errors?.[0]?.message ||
      err?.response?.data?.message ||
      err?.message ||
      'Something went wrong. Please try again.';

    errorToast({
      message: apiErrorMessage,
    });

    return {
      status: false,
      error: apiErrorMessage,
    };
  }
};
