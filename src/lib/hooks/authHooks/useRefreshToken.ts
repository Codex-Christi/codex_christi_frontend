'use client';

import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { LoginDataReturnType as TokensObjectType } from './useLogin';

export const useRefreshToken = () => {
  const { refreshToken, setLoginState } = useAuthStore();

  const refreshTokenMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post('/token/refresh', { refreshToken });
      return response.data;
    },
    onSuccess: (data: TokensObjectType) => {
      setLoginState(data.access, data.refresh);
    },
  });

  return refreshTokenMutation;
};
