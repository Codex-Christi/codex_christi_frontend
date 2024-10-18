import { toast } from '@/hooks/use-toast';
import { useCallback } from 'react';

type TOAST_TYPE = 'error' | 'success' | 'processs';

export const useCustomToast = () => {
  const triggerCustomToast = useCallback(
    (type: TOAST_TYPE, message: string) => {
      switch (type) {
        case 'error':
          toast({
            title: 'An error occured!',
            description: message,
            variant: 'destructive',
          });
        case 'success':
        case 'processs':
        default:
      }
    },
    []
  );

  return { triggerCustomToast };
};
