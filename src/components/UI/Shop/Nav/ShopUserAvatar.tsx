import { FC, useState } from "react";
import Image, { ImageProps } from "next/image";
import { Skeleton } from "../../primitives/skeleton";
import { cn } from "@/lib/utils";

type UserAvatarInterface = Omit<ImageProps, "width" | "height"> & {
	width: number;
	height: number;
	username?: string;
};

const UserAvatar: FC<UserAvatarInterface> = ({width, height, username, ...props}) => {
	// Hooks
	const [loaded, setLoaded] = useState<boolean>(false);

	return (
		<div className="flex flex-col items-center">
			{!loaded && (
				<Skeleton
					className={cn("size-10 rounded-full p-0")}
					style={{ width, height }}
				/>
			)}

			<Image
				{...props}
				alt="User Avatar"
				width={width ?? 25}
				height={height ?? 25}
                className={cn("rounded-full size-8 object-cover object-center", {
                    "hidden": !loaded
                })}
				onLoad={() => setLoaded(true)}
			/>

			<small className="text-[.95rem] font-semibold leading-none mt-2">
				{username ? username : "User"}
			</small>
		</div>
	);
};

export default UserAvatar;
