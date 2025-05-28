import { FC, SetStateAction } from "react";
import EditGender from "./EditGender";
import EditBirthday from "./EditBirthday";
import EditEmail from "./EditEmail";
import EditWebsite from "./EditWebsite";
import EditPhoneNumber from "./EditPhoneNumber";
import EditCountry from "./EditCountry";
import EditProfilePicture from "./EditProfilePicture";
import { cn } from "@/lib/utils";
import { useUserMainProfileStore } from "@/stores/userMainProfileStore";
import { useEditUserMainProfileStore } from "@/stores/editUserProfileStore";
import { UserProfileDataInterface } from "@/lib/types/user-profile/main-user-profile";
import EditProfileSubmitButton from "./EditProfileSubmitButton";

// Interfaces
interface EditModalFieldsProps {
	isActive: boolean;
	setIsActive: React.Dispatch<SetStateAction<boolean>>;
}

const EditModalFields: FC<EditModalFieldsProps> = ({isActive, setIsActive}) => {
	// Hooks
	const editProfileData = useEditUserMainProfileStore(
		(state) => state.userEditData,
	);

	const setUserEditData = useEditUserMainProfileStore(
		(state) => state.setUserEditData,
	);

	const mainProfileData = useUserMainProfileStore(
		(state) => state.userMainProfile,
    );

	//   Handlers
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const targetName = e.target.name as keyof UserProfileDataInterface;
		const targetVal = e.target.value;

		// Change the edit profile data
		setUserEditData({
			...editProfileData,
			[targetName]: targetVal,
		});
	};

	const setFormValues = (fieldName: string, value: string) => {
		setUserEditData({
			...editProfileData,
			[fieldName]: value,
		});
	};

	//   Functions
	const getEditFieldValues = (name: keyof UserProfileDataInterface) => {
		const value =
			editProfileData &&
			editProfileData[name] !== undefined &&
			editProfileData[name] !== null
				? editProfileData[name]
				: mainProfileData && mainProfileData[name]
					? mainProfileData[name]
					: "";

		return value instanceof File ? value.name : value;
	};

	// Main JSX
	return (
		<div
			className={cn(
				`bg-[#0D0D0D]/[.98] backdrop-blur-lg text-white mx-auto p-8 w-[90%] space-y-2 transition-transform md:w-[60%] h-[calc(100dvh-3rem)] md:h-[calc(100dvh-4rem)] overflow-y-auto duration-300 ease-linear rounded-[10px] -translate-y-[200%] shadow-2xl lg:w-2/5 z-[500] max-w-full overflow-x-hidden`,
				{
					"md:translate-y-4 translate-y-0": isActive,
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

			<p className="text-yellow-500 text-center">
				Please note that excluding the profile picture, each field can
				be changed once in 6 months.
			</p>

			<EditProfilePicture />

			{/* First and Last Name Edit */}
			<div className="grid gap-6">
				<section className="grid md:grid-cols-2 gap-3">
					{[
						{ name: "first_name", text: "First Name" },
						{ name: "last_name", text: "Last Name" },
					].map((item, index) => {
						const name = item.name as "first_name" | "last_name";
						const text = item.text as "First Name" | "Last Name";
						return (
							<label
								className="grid gap-0.5 w-full"
								htmlFor={item.name}
								key={index}
							>
								<span className="text-white/70">
									{item.text}
								</span>

								<input
									className="input w-full"
									type="text"
									placeholder={text}
									id={name}
									name={name}
									value={getEditFieldValues(name)}
									onChange={handleInputChange}
								/>
							</label>
						);
					})}
				</section>

				{/* Username Edit */}
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
						value={getEditFieldValues("username")}
						onChange={handleInputChange}
					/>
				</label>

				{/* Bio Edit */}
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
						value={getEditFieldValues("bio")}
						onChange={handleInputChange}
					/>
				</label>

				<EditCountry />

				<div className="grid gap-0.5">
					<p className="text-white/70">Select Gender</p>

					<EditGender
						value={getEditFieldValues("gender")}
						onChange={(e) => {
							setFormValues("gender", e);
						}}
					/>
				</div>

				<EditEmail />

				<EditPhoneNumber
					value={getEditFieldValues("mobile_phone")}
					onChange={(e) => {
						setFormValues("mobile_phone", e);
					}}
				/>

				<EditBirthday />

				<EditWebsite />

				<EditProfileSubmitButton />
			</div>
		</div>
	);
};

export default EditModalFields;
