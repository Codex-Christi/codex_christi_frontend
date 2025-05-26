"use client";

import Image from "next/image";
import ProfileImage from "@/assets/img/profile-img.png";
import { FC, Dispatch, SetStateAction } from "react";
import { useUserMainProfileStore } from "@/stores/userMainProfileStore";
import UserAvatar from "./UserAvatar";

const ProfileBanner: FC<{
	setIsActive: Dispatch<SetStateAction<boolean>>;
	isActive: boolean;
}> = ({ setIsActive, isActive }) => {
	// Hooks
	const userMainProfile = useUserMainProfileStore(
		(state) => state.userMainProfile,
	);

	//   Consts
	const { first_name, last_name, username, bio } = userMainProfile || {};

	// Main JSX
	return (
		<>
			<div className="text-[#F3F3F30D] bg-[#0D0D0D] rounded-[20px] p-4 flex gap-4 items-center mb-8 lg:hidden">
				<Image
					className="size-10 rounded-full"
					src={ProfileImage}
					alt="John Doe"
				/>

				<div className="bg-inherit relative text-white w-full">
					<svg
						className="absolute right-4 top-1/3"
						width="15"
						height="14"
						viewBox="0 0 15 14"
						fill="none"
					>
						<path
							fillRule="evenodd"
							clipRule="evenodd"
							d="M12.6729 1.52664C13.3769 2.23062 13.3769 3.37199 12.6729 4.07597L8.63643 8.11242L4.59998 12.1489L1.20087 12.9987L2.05065 9.64742L10.1268 1.52989C10.7922 0.861114 11.8529 0.82505 12.5609 1.42361L12.6729 1.52664Z"
							stroke="#F3F3F3"
							strokeWidth="1.4"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						<path
							d="M6.29968 12.998H13.0979"
							stroke="#F3F3F3"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						<path
							d="M10.6482 3.65234L11.498 4.50212"
							stroke="#F3F3F3"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>

					<input
						className="input w-full !pr-8 !rounded-full"
						type="text"
						placeholder="Share your thoughts, Saint"
						id="post"
						name="post"
					/>
				</div>

				<button
					className="text-[#0D0D0D] bg-[#F3F3F3E5] backdrop-blur-[30px] px-4 py-2.5 border border-[#F3F3F3E5] rounded-[15px] flex items-center gap-1 shrink-0 font-bold"
					type="button"
				>
					<svg
						width="17"
						height="12"
						viewBox="0 0 17 12"
						fill="none"
					>
						<path
							d="M9.97729 0.123047C11.4638 0.123134 12.7397 1.01466 13.3113 2.28906L14.1697 1.8125C14.5631 1.59298 15.0204 1.57174 15.4246 1.74414L15.5935 1.83008L15.6423 1.8584V1.86426C16.0539 2.12959 16.3004 2.57313 16.3005 3.06641V8.93262C16.3004 9.38204 16.0974 9.79109 15.7507 10.0605L15.5935 10.167C15.3672 10.3002 15.1078 10.3681 14.8679 10.3682C14.6887 10.3682 14.5097 10.3338 14.3386 10.2656L14.1697 10.1865L13.3113 9.70898C12.739 10.9837 11.4641 11.8759 9.97729 11.876H3.75562C1.74089 11.8758 0.10151 10.2364 0.101318 8.22168V3.77734C0.101469 1.76259 1.74087 0.123196 3.75562 0.123047H9.97729ZM3.75854 1.20996C2.34283 1.20997 1.1924 2.35973 1.19214 3.77539V8.21973C1.19222 9.63553 2.34272 10.7861 3.75854 10.7861H9.98022C11.3958 10.7859 12.5456 9.63538 12.5457 8.21973V3.77539C12.5454 2.35989 11.3957 1.21022 9.98022 1.20996H3.75854ZM15.0427 2.7666C14.9875 2.73553 14.853 2.67869 14.7 2.76367H14.699L13.6326 3.35449V8.63672L14.699 9.22949H14.7L14.7566 9.25586C14.8869 9.3029 14.9936 9.25362 15.0427 9.22559H15.0437L15.0916 9.19141C15.1462 9.14585 15.2126 9.06313 15.2126 8.93066V3.0625C15.2126 2.88627 15.0956 2.79778 15.0427 2.76758V2.7666Z"
							fill="black"
							stroke="black"
							strokeWidth="0.2"
						/>
						<path
							d="M10.4241 2.44336H9.53531C9.29055 2.44336 9.09094 2.64298 9.09094 2.88773C9.09094 3.13248 9.29056 3.3321 9.53531 3.3321H10.4241C10.6688 3.3321 10.8684 3.13248 10.8684 2.88773C10.8684 2.64298 10.6688 2.44336 10.4241 2.44336Z"
							fill="black"
						/>
					</svg>
					Go Live
				</button>
			</div>

			<div className="flex items-start flex-wrap justify-between gap-4 px-4 py-8 bg-black backdrop-blur-[30px] rounded-t-[20px]">
				<div className="flex flex-wrap md:flex-nowrap items-center gap-4">
					<UserAvatar className="lg:size-24" height={80} width={80} />

					<div className="space-y-4">
						<div>
							<h1 className="md:text-2xl font-semibold flex items-center gap-1">
								{`${first_name} ${last_name}`}{" "}
								<svg
									width="19"
									height="13"
									viewBox="0 0 19 13"
									fill="none"
								>
									<path
										d="M0.522461 1.50098C0.522461 0.948692 0.970176 0.500977 1.52246 0.500977H6.52246V12.501H1.52246C0.970176 12.501 0.522461 12.0533 0.522461 11.501V1.50098Z"
										fill="#056A00"
									/>
									<rect
										x="6.52246"
										y="0.500977"
										width="6"
										height="12"
										fill="white"
									/>
									<path
										d="M12.5225 0.500977H17.5225C18.0747 0.500977 18.5225 0.948692 18.5225 1.50098V11.501C18.5225 12.0533 18.0747 12.501 17.5225 12.501H12.5225V0.500977Z"
										fill="#056A00"
									/>
								</svg>
							</h1>

							<p className="text-white/70">@{username}</p>
						</div>

						<div>
							<p className="text-lg">
								{bio
									? bio
									: `Christ in me 💛 the hope of Glory.`}
							</p>

							<p className="flex items-center gap-10 text-white/70">
								<span>30 following</span>

								<span>3.2k followers</span>
							</p>
						</div>
					</div>
				</div>

				<button
					className="inline-block border border-white rounded-[10px] py-2 px-3 md:py-3 md:px-4 md:rounded-sm shrink-0"
					type="button"
					onClick={() => setIsActive(!isActive)}
				>
					Edit Profile
				</button>
			</div>
		</>
	);
};

export default ProfileBanner;
