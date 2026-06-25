import { toast } from 'sonner';

type ToastPosition =
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
  closeLabel = 'Close',
}: {
  message: string;
  header?: string;
  position?: ToastPosition;
  duration?: number;
  closeLabel?: string;
}) => {
  const toastID = toast.loading(header, {
    description: message,
    action: {
      label: closeLabel,
      onClick: () => toast.dismiss(toastID),
    },
    position,
    duration,
  });

  return toastID as number;
};

export default loadingToast;
