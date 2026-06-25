import { toast } from 'sonner';

type ToastPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-center'
  | 'bottom-center';

const successToast = ({
  message,
  header = 'Action Successful!',
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
  const toastID = toast.success(header, {
    description: message,
    action: {
      label: closeLabel,
      onClick: () => toast.dismiss(toastID),
    },
    position,
    duration,
  });

  return toastID;
};

export default successToast;
