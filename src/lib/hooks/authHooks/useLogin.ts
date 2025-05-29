/* eslint-disable @typescript-eslint/no-explicit-any */
import errorToast from '@/lib/error-toast';
import loadingToast from '@/lib/loading-toast';
import successToast from '@/lib/success-toast';
import axios, { AxiosResponse } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createLoginSession } from '@/actions/login';
import { verifySession } from '@/lib/session/session-validate';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const tokenClient = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
});

type loginType = { email: string; password: string };

export type LoginDataReturnType = {
  status: number;
  success: boolean;
  message: string;
  data: { refresh: string; access: string };
};

interface SignInHookInterface {
  isLoading: boolean;
  isError: boolean;
  errorMsg: string;
}

const defaultSignUpProcessState: SignInHookInterface = {
  isLoading: false,
  isError: false,
  errorMsg: '',
};

export const useLogin = () => {
  const router = useRouter();

  // State values
  const [isClient, setIsClient] = useState(false);
  const [referer, setReferer] = useState<string | null>(null);
  // State for login process
  const [loginProcessState, setLoginProcessState] =
    useState<SignInHookInterface>(useMemo(() => defaultSignUpProcessState, []));
  const isCodexChristiShop = isClient
    ? window.location.hostname.includes('codexchristi.shop')
    : false;

  // Effect to set client-side state and referer
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true);
      setReferer(
        document.referrer
          ? document.referrer.split(window.location.hostname)[1]
          : null
      );
    }
  }, [referer]);

  // Main Login Func
  const login = useCallback(
    async (userDetails: loginType) => {
      setLoginProcessState((prev) => {
        return { ...prev, isLoading: true };
      });

      const loadingToastID = loadingToast({
        message: 'Please wait a moment...',
      });

      try {
        const loginRes: AxiosResponse<LoginDataReturnType> =
          await tokenClient.post(`/auth/user-login`, {
            ...userDetails,
          });

        if (loginRes?.data?.success) {
          const { refresh: refreshToken, access: accessToken } =
            loginRes.data.data;

          const sessionStatus = await createLoginSession(
            accessToken,
            refreshToken
          );

          if (sessionStatus.success === true) {
            setLoginProcessState({
              isLoading: false,
              isError: false,
              errorMsg: '',
            });

            // Manually check is session is created and active (from server)
            const isSessionActive = await verifySession();

            if (isSessionActive === true) {
              toast.dismiss(loadingToastID);

              successToast({
                message: `Redirecting you ${isCodexChristiShop ? '' : 'to your dashboard'}...`,
                header: 'Login Successful.',
              });

              // If the user is not codexchristi.shop, push to referer
              if (isCodexChristiShop) {
                if (referer && typeof referer === 'string') {
                  router.push(referer);
                } else {
                  router.push('/');
                }
              } else {
                // If the user is not on codexchristi.shop, push to profile page
                router.push('/profile');
              }
            }
          } else {
            throw new Error(sessionStatus.error);
          }

          return;
        }

        throw new Error(loginRes?.data?.message);
      } catch (err: any) {
        toast.dismiss(loadingToastID);

        if (err?.response?.data?.errors) {
          setLoginProcessState((prev) => ({
            ...prev,
            isLoading: false,
            isError: true,
            errorMsg: err?.response?.data?.errors[0]?.message as string,
          }));

          errorToast({
            message: err?.response?.data?.errors[0]?.message as string,
          });

          return;
        }

        setLoginProcessState((prev) => ({
          ...prev,
          isLoading: false,
          isError: true,
          errorMsg: String(err),
        }));

        errorToast({
          message: String(err),
        });

        return String(err);
      }
    },
    [isCodexChristiShop, referer, router]
  );

  return { ...loginProcessState, login };
};
