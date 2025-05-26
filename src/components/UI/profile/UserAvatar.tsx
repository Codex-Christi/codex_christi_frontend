/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { FC, useEffect, useState } from "react";
import Image, { StaticImageData } from "next/image";
import ProfileImage from "@/assets/img/profile-img.png";
import { useUserMainProfileStore } from "@/stores/userMainProfileStore";
import { cn } from "@/lib/utils";

const UserAvatar: FC<{
	height?: number;
	width?: number;
	className?: string;
	src?: string | StaticImageData;
	[key: string]: any;
}> = ({ height = 50, width = 50, className, src, ...rest }) => {
	const userMainProfile = useUserMainProfileStore(
		(state) => state.userMainProfile,
	);

	const [hasHydrated, setHasHydrated] = useState(false);

	useEffect(() => {
		setHasHydrated(true);
	}, [userMainProfile]);

	const fallbackSrc =
		userMainProfile?.profile_pic &&
		typeof userMainProfile.profile_pic === "string"
			? userMainProfile.profile_pic
			: ProfileImage;

	const imageSrc = src ?? fallbackSrc;

	if (!hasHydrated) {
		return (
			<div
				className={cn(
					"size-12 rounded-full bg-gray-200 animate-pulse",
					className,
				)}
				style={{ width, height }}
			/>
		);
	}

	return (
		<Image
			className={cn("rounded-full size-20", className)}
			src={imageSrc}
			width={width}
			height={height}
			alt={
				userMainProfile
					? `${userMainProfile.first_name ?? ""} ${userMainProfile.last_name ?? ""}`
					: "User Avatar"
			}
			priority
			{...rest}
		/>
	);
};

export default UserAvatar;
