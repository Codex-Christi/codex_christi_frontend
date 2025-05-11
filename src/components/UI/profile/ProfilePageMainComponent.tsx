'use client';
import ContentContainer from '@/components/UI/profile/ContentContainer';
import ProfileBanner from '@/components/UI/profile/ProfileBanner';
import ProfileContainer from '@/components/UI/profile/ProfileContainer';
import { useState } from 'react';
import EditProfileModal from './EditProfileModal';
import { UserProfileData } from '@/lib/types/user-profile/main-user-profile';

// Interfaces
interface ProfilePageMainComponentProps {
  mainProfileUserData: UserProfileData;
}

// main component
const ProfilePageMainComponent: React.FC<
  ProfilePageMainComponentProps
> = () => {
  // Hooks
  const [isActive, setIsActive] = useState(false);

  //   Main JSX
  return (
    <>
      <EditProfileModal isActive={isActive} setIsActive={setIsActive} />
      <ContentContainer>
        <div className='bg-[#0D0D0D]/30 backdrop-blur-lg rounded-[10px]'>
          <ProfileBanner isActive={isActive} setIsActive={setIsActive} />

          <ProfileContainer />
        </div>
      </ContentContainer>
    </>
  );
};

export default ProfilePageMainComponent;
