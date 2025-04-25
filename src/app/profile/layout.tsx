import ProfileSidebar from "@/components/UI/profile/ProfileSidebar";
import dynamic from "next/dynamic";
const CometsContainer = dynamic(
	() => import("@/components/UI/general/CometsContainer"),
);

const ProfileLayout = ({ children }: { children: React.ReactNode }) => {
	return (
		<CometsContainer>
			<div className="flex items-start">
				<ProfileSidebar />

				{children}
			</div>
		</CometsContainer>
	);
};

export default ProfileLayout;
