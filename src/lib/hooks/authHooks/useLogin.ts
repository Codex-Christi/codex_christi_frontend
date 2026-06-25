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

        if (sessionStatus.success) {
          setLoginProcessState({
            isLoading: false,
            isError: false,
            errorMsg: '',
          });

          // Sync the auth store from the server session we just created.
          const sessionState = sessionStatus.sessionState;
          setSessionState(sessionState);

          if (sessionState.isAuthenticated) {
            // Fetch profile into Zustand BEFORE redirecting (non-shop flows)
            const { setProfileFromServer } = useUserMainProfileStore.getState();

            if (!isCodexChristiShop) {
              try {
                await setProfileFromServer(); // fills userMainProfile
              } catch (e) {
                console.error('Failed to fetch user profile after login:', e);
                // Optional: you could still proceed; profile page will show "Loading..."
              }
            }

            toast.dismiss(loadingToastID);

            successToast({
              message: `Redirecting you ${isCodexChristiShop ? '' : 'to your dashboard'}...`,
              header: 'Login Successful.',
            });

            // Redirect logic
            if (loginReturnPath) {
              router.push(loginReturnPath);
            } else if (isCodexChristiShop) {
              if (referer && typeof referer === 'string') {
                router.push(referer);
              } else {
                router.push('/');
              }
            } else {
              router.push('/profile');
            }

            return;
          }

          // If session not active after all this:
          throw new Error('Session verification failed');
        }

        throw new Error(sessionStatus.error);
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
