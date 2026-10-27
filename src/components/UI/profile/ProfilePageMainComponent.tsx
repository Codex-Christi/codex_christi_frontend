'use client';
import ContentContainer from '@/components/UI/profile/ContentContainer';
import ProfileBanner from '@/components/UI/profile/ProfileBanner';
import ProfileContainer from '@/components/UI/profile/ProfileContainer';
import EditProfileModal from './Edit/EditProfileModal';
import { useState } from 'react';
import AccountLoadError from '../Auth/AccountLoadError';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';

// Interfaces

// main component
const ProfilePageMainComponent: React.FC = ({}) => {
  // Hooks
  const [isActive, setIsActive] = useState(false);
  const { error, setProfileFromServer } = useUserMainProfileStore();

  //   Main JSX
  return (
    <>
      <EditProfileModal isActive={isActive} setIsActive={setIsActive} />
      <ContentContainer>
        <AccountLoadError message={error} retry={setProfileFromServer} />
        <div className='bg-[#0D0D0D]/30 backdrop-blur-lg rounded-[10px]'>
          <ProfileBanner isActive={isActive} setIsActive={setIsActive} />

          <ProfileContainer />
        </div>
      </ContentContainer>
    </>
  );
};

export default ProfilePageMainComponent;
