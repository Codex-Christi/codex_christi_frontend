import { FC, useState } from "react";
import Image, { ImageProps } from "next/image";
import { Skeleton } from "../../primitives/skeleton";

type UserAvatarInterface = Omit<ImageProps, "width" | "height"> & {
	width: number;
	height: number;
	username?: string;
};

const UserAvatar: FC<UserAvatarInterface> = (props) => {
	// Hooks
	const [loaded, setLoaded] = useState<boolean>(false);

	// Props
	const { width, height, username } = props;

	return (
		<div
			className={`flex flex-col items-center`}
			// min-h-[${height + 12}px] min-w-[${width + 12}px]
		>
			{!loaded && (
				<Skeleton
					className={`h-[${height ? height : 25}px] w-[${width ? width : 25}px] rounded-full p-0`}
				/>
			)}
			<Image
				{...props}
				alt="User Avatar"
				className="rounded-full"
				onLoad={() => setLoaded(true)}
			/>

			<small className="text-[.95rem] font-semibold leading-none mt-2">
				{username ? username : "User"}
			</small>
		</div>
	);
};

export default UserAvatar;
