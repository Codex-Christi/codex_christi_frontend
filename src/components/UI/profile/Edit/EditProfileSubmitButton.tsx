import React, { useCallback, useState } from "react";
import { Button } from "../../primitives/button";
import {
	useValidateUserEditData,
	useEditUserMainProfileStore,
} from "@/stores/editUserProfileStore";
import { useUserMainProfileStore } from "@/stores/userMainProfileStore";
import axios from "axios";
import { UserProfileDataInterface } from "@/lib/types/user-profile/main-user-profile";
import loadingToast from "@/lib/loading-toast";
import errorToast from "@/lib/error-toast";
import successToast from "@/lib/success-toast";
import { toast } from "sonner";
import { decrypt, getCookie } from "@/lib/session/main-session";

// Interfaces
interface UserPatchResponse {
	status: number;
	success: boolean;
	message: string;
	data: UserProfileDataInterface;
}

// Patch User Function
const patchUser = async (formData: FormData) => {
	const sessionCookie = await getCookie("session");

	const decryptedSessionCookie = await decrypt(sessionCookie?.value);

	const mainAccessToken = decryptedSessionCookie
		? (decryptedSessionCookie.mainAccessToken as string)
		: ("" as string);

	const client = axios.create({
		baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
	});

	try {
		const response = await client.patch<UserPatchResponse>(
			"/account/my-profile-update",
			formData,
			{
				headers: {
					"Content-Type": "multipart/form-data",
					"Authorization": `Bearer ${mainAccessToken}`,
				},
			},
		);
		return response.data;
	} catch (error: unknown) {
		console.error("Error updating user profile:", error);
		throw error;
	}
};

// Main Component
const EditProfileSubmitButton = () => {
	// Hooks
	const { validate } = useValidateUserEditData();
	const [isLoading, setIsLoading] = useState(false);
	const { clearEditData } = useEditUserMainProfileStore((state) => state);
	const { setUserMainProfile } = useUserMainProfileStore((state) => state);

	// Submit Patch Data
	const submitPatchData = useCallback(async () => {
		// Validate the data
		const submissionData = validate();
		const formData = new FormData();

		if (!submissionData.success) {
			const getFirstErrorKey = Object.keys(submissionData?.errors)[0];

			const firstError = Object.values(submissionData?.errors)[0];

			errorToast({
				message:
					getFirstErrorKey === "undefined"
						? "You have not made any changes."
						: `${getFirstErrorKey} field: ${firstError}`,
			});
		}

		// Convert the data to FormData
		if (submissionData.success && submissionData.data) {
			for (const key in submissionData.data) {
				formData.set(
					key,
					submissionData.data[
						key as keyof typeof submissionData.data
					] as string | Blob,
				);
			}
			// Set the loading state
			setIsLoading(true);
			const loadingToastID = loadingToast({
				message: "Updating user details...",
			});

			// Send the data to the server
			try {
				await patchUser(formData)
					.then((response) => {
						setIsLoading(false);

						toast.dismiss(loadingToastID);

						successToast({
							message: "Profile updated successfully.",
							header: "Profile Updated",
						});

						setUserMainProfile(response.data);

						clearEditData();
					})
					.catch((error) => {
                        setIsLoading(false);

						toast.dismiss(loadingToastID);

						errorToast({
							message:
								error?.response?.data?.errors[0]?.message ??
								"Error updating profile. Please try again.",
						});
					});
            } catch (error) {
                setIsLoading(false);

				toast.dismiss(loadingToastID);

				errorToast({
					message:
						String(error),
				});
			}
		}
	}, [clearEditData, setUserMainProfile, validate]);

	// Main JSx
	return (
		<Button
			name="Edit Profile - Submit"
			id="edit-profile-submit"
			aria-label="Edit Profile"
			className="bg-[#0085FF] text-white font-semibold rounded pt-1.5 pb-2 px-5 mx-auto block"
			type="button"
			onClick={submitPatchData}
			disabled={isLoading}
		>
			Save changes
		</Button>
	);
};

export default EditProfileSubmitButton;
