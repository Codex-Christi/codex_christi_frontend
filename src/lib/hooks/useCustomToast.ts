import { toast } from '@/hooks/use-toast';

type TOAST_TYPE = 'error' | 'success' | 'processs';

export const useCustomToast = () => {
  const triggerCustomToast = (
    type: TOAST_TYPE,
    message: string,
    header?: string
  ) => {
    switch (type) {
      case 'error':
        toast({
          title: 'An error occured!',
          description: message,
          variant: 'destructive',
        });
        break;
      case 'success':
        toast({
          title: header || 'Action successful',
          description: message,
          variant: 'success',
        });
        break;
      case 'processs':
        toast({
          title: header || 'Loading...',
          description: message,
          variant: 'default',
        });

      default:
    }
  };

  return { triggerCustomToast };
};
