import { toast } from 'sonner';

type ToastPosition =
	| 'top-left'
	| 'top-right'
	| 'bottom-left'
	| 'bottom-right'
	| 'top-center'
	| 'bottom-center';

const errorToast = ({
	message,
	header = 'An error occurred!',
	position = 'top-right',
	duration,
	tone = 'error',
	closeLabel = 'Close',
}: {
	message: string;
	header?: string;
	position?: ToastPosition;
	duration?: number;
	tone?: 'error' | 'message';
	closeLabel?: string;
}) => {
	const showToast = tone === 'message' ? toast.message : toast.error;
	const toastID = showToast(header, {
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

export default errorToast;
