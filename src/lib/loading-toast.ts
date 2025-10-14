import { toast } from 'sonner';

type Position =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-center'
  | 'bottom-center';

const loadingToast = ({
  message,
  header = 'Processing...',
  position = 'top-right',
  duration,
}: {
  message: string;
  header?: string;
  position?: Position;
  duration?: number;
}) => {
  const toastID = toast.loading(header, {
    description: message,
    action: {
      label: 'Close',
      onClick: () => toast.dismiss(toastID),
    },
    position: position,
    duration: duration,
  });

  return toastID as number;
};

export default loadingToast;
