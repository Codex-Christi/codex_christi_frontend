import { toast } from "sonner";

type Position =
	| "top-left"
	| "top-right"
	| "bottom-left"
	| "bottom-right"
	| "top-center"
	| "bottom-center";

const errorToast = ({
	message,
	header = "An error occured!",
	position = "top-right",
}: {
	message: string;
	header?: string;
	position?: Position;
}) => {
	const toastID = toast.error(header, {
		description: message,
		action: {
			label: "Close",
			onClick: () => toast.dismiss(toastID),
		},
		position: position,
    });

    return toastID;
};

export default errorToast;
