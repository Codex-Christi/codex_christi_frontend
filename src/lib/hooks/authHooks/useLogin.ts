// src/hooks/useLogin.ts
'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { getSafeAdminReturnPath } from '@/lib/admin/admin-paths';
import errorToast from '@/lib/error-toast';
import loadingToast from '@/lib/loading-toast';
import successToast from '@/lib/success-toast';
import { loginUser } from '@/actions/login';
import useAuthStore from '@/stores/authStore';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';
import { isShopSiteHostname } from '@/lib/siteBaseUrls';

type loginType = { email: string; password: string };

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

function getSameHostRefererPath() {
  if (!document.referrer) return null;

  try {
    const referrerURL = new URL(document.referrer);

    if (referrerURL.host !== window.location.host) return null;

    return `${referrerURL.pathname}${referrerURL.search}`;
  } catch {
    return null;
  }
}

function getLoginRedirectPath({
  isShopSite,
  loginReturnPath,
  referer,
}: {
  isShopSite: boolean;
  loginReturnPath: string | null;
  referer: string | null;
}) {
  if (loginReturnPath) return loginReturnPath;
  if (isShopSite) return referer ?? '/';

  return '/profile';
}

export const useLogin = () => {
  const router = useRouter();
  const setSessionState = useAuthStore((state) => state.setSessionState);

  // State for login process
  const [loginProcessState, setLoginProcessState] = useState<SignInHookInterface>(
    defaultSignUpProcessState,
  );

  // Main Login Func
  const login = useCallback(
    async (userDetails: loginType) => {
      const isCodexChristiShop = isShopSiteHostname(window.location.hostname);
      const referer = getSameHostRefererPath();
      const loginReturnPath = getSafeAdminReturnPath(
        new URLSearchParams(window.location.search).get('next'),
      );

      setLoginProcessState((prev) => ({
        ...prev,
        isLoading: true,
      }));

      const loadingToastID = loadingToast({
        message: 'Please wait a moment...',
      });

      try {
        const sessionStatus = await loginUser(userDetails);

        if (!sessionStatus.success) {
          throw new Error(sessionStatus.error);
        }

        const sessionState = sessionStatus.sessionState;

        if (!sessionState.isAuthenticated) {
          throw new Error('Session verification failed');
        }

        setLoginProcessState({
          isLoading: false,
          isError: false,
          errorMsg: '',
        });
        setSessionState(sessionState);

        if (!isCodexChristiShop) {
          try {
            await useUserMainProfileStore.getState().setProfileFromServer();
          } catch (e) {
            console.error('Failed to fetch user profile after login:', e);
          }
        }

        toast.dismiss(loadingToastID);
        successToast({
          message: `Redirecting you ${isCodexChristiShop ? '' : 'to your dashboard'}...`,
          header: 'Login Successful.',
        });

        router.push(
          getLoginRedirectPath({
            isShopSite: isCodexChristiShop,
            loginReturnPath,
            referer,
          }),
        );
      } catch (err: unknown) {
        toast.dismiss(loadingToastID);

        const errorMessage = err instanceof Error ? err.message : String(err);

        setLoginProcessState((prev) => ({
          ...prev,
          isLoading: false,
          isError: true,
          errorMsg: errorMessage,
        }));

        errorToast({
          message: errorMessage,
        });

        return errorMessage;
      }
    },
    [router, setSessionState],
  );

  return { ...loginProcessState, login };
};
