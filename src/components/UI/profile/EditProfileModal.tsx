import Image from "next/image";
import ProfileImage from "@/assets/img/profile-img.png";
import { cn } from "@/lib/utils";
import { SetStateAction } from "react";

const EditProfileModal = ({
	isActive,
	setIsActive,
}: {
	isActive: boolean;
	setIsActive: React.Dispatch<SetStateAction<boolean>>
}) => {
	return (
		<div
			className={cn(
				"bg-[#0D0D0DFA] text-white fixed w-full top-[calc(4rem+1.40rem)] p-8 left-0 space-y-8 transition-transform duration-300 ease-linear -translate-y-[200%]",
				{
					"translate-y-0": isActive,
				},
			)}
		>
			<div className="flex items-center justify-between">
				<button
					type="button"
					aria-label="Close modal"
					onClick={() => setIsActive(false)}
				>
					<svg
						width="17"
						height="17"
						viewBox="0 0 17 17"
						fill="none"
					>
						<path
							fillRule="evenodd"
							clipRule="evenodd"
							d="M15.8492 2.13582C16.2398 1.74529 16.2398 1.11213 15.8492 0.721604C15.4587 0.33108 14.8256 0.33108 14.435 0.721604L8.07109 7.08554L1.70715 0.721604C1.31663 0.33108 0.683463 0.33108 0.292939 0.721604C-0.0975857 1.11213 -0.0975857 1.74529 0.292939 2.13582L6.65688 8.49976L0.292893 14.8637C-0.0976308 15.2543 -0.0976312 15.8874 0.292893 16.278C0.683417 16.6685 1.31658 16.6685 1.70711 16.278L8.07109 9.91397L14.4351 16.278C14.8256 16.6685 15.4588 16.6685 15.8493 16.278C16.2398 15.8874 16.2398 15.2543 15.8493 14.8637L9.4853 8.49976L15.8492 2.13582Z"
							fill="white"
						/>
					</svg>
				</button>

				<p className="font-bold text-lg mx-auto">Edit Profile</p>
			</div>

			<div className="relative size-20 rounded-full mx-auto">
				<Image
					className="size-full rounded-full"
					src={ProfileImage}
					alt="User"
				/>

				<div className="absolute w-full inset-0 size-full grid place-content-center">
					<svg
						width="32"
						height="26"
						viewBox="0 0 32 26"
						fill="none"
					>
						<path
							d="M29 26H3C1.346 26 0 24.654 0 23V7C0 5.346 1.346 4 3 4H7.381L9.102 0.554C9.27 0.214 9.617 0 9.996 0H22.006C22.385 0 22.731 0.214 22.901 0.554L24.619 4H29C30.654 4 32 5.346 32 7V23C32 24.654 30.654 26 29 26ZM30 7C30 6.449 29.551 6 29 6H24C23.95 6 23.907 5.979 23.859 5.972C23.788 5.961 23.717 5.955 23.649 5.929C23.588 5.906 23.537 5.869 23.482 5.834C23.428 5.801 23.373 5.773 23.326 5.729C23.273 5.68 23.235 5.62 23.194 5.56C23.166 5.52 23.127 5.491 23.105 5.446L21.387 2H10.615L8.895 5.446C8.848 5.541 8.785 5.623 8.715 5.695C8.701 5.71 8.684 5.719 8.669 5.733C8.597 5.798 8.518 5.851 8.432 5.892C8.403 5.907 8.375 5.919 8.344 5.931C8.234 5.971 8.12 5.999 8.002 6H8H3C2.449 6 2 6.449 2 7V23C2 23.551 2.449 24 3 24H29C29.551 24 30 23.551 30 23V7ZM16 21C12.14 21 9 17.86 9 14C9 10.14 12.14 7 16 7C19.86 7 23 10.14 23 14C23 17.86 19.86 21 16 21ZM16 9C13.243 9 11 11.243 11 14C11 16.757 13.243 19 16 19C18.757 19 21 16.757 21 14C21 11.243 18.757 9 16 9Z"
							fill="white"
						/>
					</svg>
				</div>
			</div>

			<div className="grid gap-6">
				<label
					className="grid gap-0.5"
					htmlFor="name"
				>
					<span className="text-white/70">Fullname</span>

					<input
						className="input"
						type="text"
						placeholder="Fullname"
						id="name"
						name="name"
					/>

					<span className="text-sm">
						*name can be changed once in 6 months
					</span>
				</label>

				<label
					className="grid gap-0.5"
					htmlFor="username"
				>
					<span className="text-white/70">Username</span>

					<input
						className="input"
						type="text"
						placeholder="Username"
						id="username"
						name="username"
					/>
				</label>

				<label
					className="grid gap-0.5"
					htmlFor="bio"
				>
					<span className="text-white/70">Bio</span>

					<input
						className="input"
						type="text"
						placeholder="Bio"
						id="bio"
						name="bio"
					/>
				</label>

				<div className="grid gap-0.5">
					<p className="text-white/70">Nationality</p>

					<button
						className="input flex items-center gap-4 justify-between"
						type="button"
					>
						<span>Select country</span>

						<svg
							width="11"
							height="8"
							viewBox="0 0 11 8"
							fill="none"
						>
							<path
								d="M10.6876 2.14168C11.0781 1.75115 11.0781 1.11799 10.6876 0.727464C10.2971 0.336939 9.66389 0.336939 9.27336 0.727464L10.6876 2.14168ZM9.27336 0.727464L4.14201 5.85881L5.55623 7.27302L10.6876 2.14168L9.27336 0.727464Z"
								fill="white"
							/>
							<path
								d="M1.70711 0.727464C1.31658 0.336939 0.683418 0.336939 0.292893 0.727464C-0.0976311 1.11799 -0.0976311 1.75115 0.292893 2.14168L1.70711 0.727464ZM0.292893 2.14168L4.90396 6.75274L6.31817 5.33853L1.70711 0.727464L0.292893 2.14168Z"
								fill="white"
							/>
						</svg>
					</button>
				</div>

				<div className="grid gap-0.5">
					<p className="text-white/70">Gender</p>

					<button
						className="input flex items-center gap-4 justify-between"
						type="button"
					>
						<span>Prefer not to say</span>

						<svg
							width="11"
							height="8"
							viewBox="0 0 11 8"
							fill="none"
						>
							<path
								d="M10.6876 2.14168C11.0781 1.75115 11.0781 1.11799 10.6876 0.727464C10.2971 0.336939 9.66389 0.336939 9.27336 0.727464L10.6876 2.14168ZM9.27336 0.727464L4.14201 5.85881L5.55623 7.27302L10.6876 2.14168L9.27336 0.727464Z"
								fill="white"
							/>
							<path
								d="M1.70711 0.727464C1.31658 0.336939 0.683418 0.336939 0.292893 0.727464C-0.0976311 1.11799 -0.0976311 1.75115 0.292893 2.14168L1.70711 0.727464ZM0.292893 2.14168L4.90396 6.75274L6.31817 5.33853L1.70711 0.727464L0.292893 2.14168Z"
								fill="white"
							/>
						</svg>
					</button>
				</div>

				<button
					className="flex items-center gap-4 justify-between py-1"
					type="button"
				>
					<span>Update Email</span>

					<svg
						width="8"
						height="14"
						viewBox="0 0 8 14"
						fill="none"
					>
						<path
							d="M1.74928 1.18383C1.43686 0.871407 0.930328 0.871407 0.617908 1.18383C0.305489 1.49625 0.305489 2.00278 0.617908 2.3152L1.74928 1.18383ZM0.617908 2.3152L6.43456 8.13185L7.56593 7.00048L1.74928 1.18383L0.617908 2.3152Z"
							fill="white"
						/>
						<path
							d="M0.617908 11.6843C0.305489 11.9967 0.305489 12.5033 0.617908 12.8157C0.930328 13.1281 1.43686 13.1281 1.74928 12.8157L0.617908 11.6843ZM1.74928 12.8157L7.14092 7.42405L6.00955 6.29268L0.617908 11.6843L1.74928 12.8157Z"
							fill="white"
						/>
					</svg>
				</button>

				<button
					className="flex items-center gap-4 justify-between py-1"
					type="button"
				>
					<span>Add phone number</span>

					<svg
						width="8"
						height="14"
						viewBox="0 0 8 14"
						fill="none"
					>
						<path
							d="M1.74928 1.18383C1.43686 0.871407 0.930328 0.871407 0.617908 1.18383C0.305489 1.49625 0.305489 2.00278 0.617908 2.3152L1.74928 1.18383ZM0.617908 2.3152L6.43456 8.13185L7.56593 7.00048L1.74928 1.18383L0.617908 2.3152Z"
							fill="white"
						/>
						<path
							d="M0.617908 11.6843C0.305489 11.9967 0.305489 12.5033 0.617908 12.8157C0.930328 13.1281 1.43686 13.1281 1.74928 12.8157L0.617908 11.6843ZM1.74928 12.8157L7.14092 7.42405L6.00955 6.29268L0.617908 11.6843L1.74928 12.8157Z"
							fill="white"
						/>
					</svg>
				</button>

				<button
					className="flex items-center gap-4 justify-between py-1"
					type="button"
				>
					<span>Add birthday</span>

					<svg
						width="22"
						height="22"
						viewBox="0 0 22 22"
						fill="none"
					>
						<path
							d="M1 7.66667H21M5.44444 1V3.22222M16.5556 1V3.22222M4.33333 12.1111H6.55555M4.33333 16.5556H6.55555M9.88889 12.1111H12.1111M9.88889 16.5556H12.1111M15.4444 12.1111H17.6667M15.4444 16.5556H17.6667M4.55555 21H17.4444C18.689 21 19.3113 21 19.7867 20.7578C20.2048 20.5448 20.5448 20.2048 20.7578 19.7867C21 19.3113 21 18.689 21 17.4444V6.77778C21 5.53321 21 4.91093 20.7578 4.43558C20.5448 4.01743 20.2048 3.67748 19.7867 3.46443C19.3113 3.22222 18.689 3.22222 17.4444 3.22222H4.55555C3.311 3.22222 2.68871 3.22222 2.21336 3.46443C1.79521 3.67748 1.45526 4.01743 1.24221 4.43558C1 4.91093 1 5.53321 1 6.77778V17.4444C1 18.689 1 19.3113 1.24221 19.7867C1.45526 20.2048 1.79521 20.5448 2.21336 20.7578C2.68871 21 3.31099 21 4.55555 21Z"
							stroke="#F3F3F3"
							strokeWidth="1.6"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</button>

				<button
					className="flex items-center gap-4 justify-between py-1"
					type="button"
				>
					<span>Add Website</span>

					<svg
						width="22"
						height="22"
						viewBox="0 0 22 22"
						fill="none"
					>
						<path
							d="M13.4028 18.2085L12.6019 19.0094C9.94782 21.6636 5.64468 21.6636 2.99058 19.0094C0.336475 16.3554 0.336475 12.0522 2.99058 9.39817L3.79152 8.59717"
							stroke="#F3F3F3"
							strokeWidth="2"
							strokeLinecap="round"
						/>
						<path
							d="M8.59717 13.4029L13.4029 8.59717"
							stroke="#F3F3F3"
							strokeWidth="2"
							strokeLinecap="round"
						/>
						<path
							d="M8.59717 3.79152L9.39817 2.99058C12.0522 0.336475 16.3554 0.336475 19.0094 2.99058C21.6636 5.64468 21.6636 9.94782 19.0094 12.6019L18.2085 13.4028"
							stroke="#F3F3F3"
							strokeWidth="2"
							strokeLinecap="round"
						/>
					</svg>
				</button>

				<button
					className="bg-[#0085FF] text-white font-semibold rounded py-3 px-5 mx-auto block"
					type="button"
				>
					Save changes
				</button>
			</div>
		</div>
	);
};

export default EditProfileModal;
