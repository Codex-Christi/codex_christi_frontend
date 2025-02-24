// src/hooks/useUser.ts
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import useAuthStore from '@/stores/authStore';

export const useUser = () => {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data } = await axios.get('/api/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return data;
    },
    enabled: !!accessToken,
  });
};
