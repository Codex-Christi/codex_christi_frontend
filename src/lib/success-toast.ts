import { toast } from 'sonner';

type Position =
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
}: {
  message: string;
  header?: string;
  position?: Position;
  duration?: number;
}) => {
  const toastID = toast.success(header, {
    description: message,
    action: {
      label: 'Close',
      onClick: () => toast.dismiss(toastID),
    },
    position: position,
    duration: duration ?? undefined,
  });

  return toastID;
};

export default successToast;
