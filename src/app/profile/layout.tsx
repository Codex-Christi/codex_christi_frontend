import ProfileSidebar from '@/components/UI/profile/ProfileSidebar';
import RequireAccount from '@/components/UI/Auth/RequireAccount';
import dynamic from 'next/dynamic';
const CometsContainer = dynamic(() => import('@/components/UI/general/CometsContainer'));

const ProfileLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <RequireAccount>
      <CometsContainer>
        <div className='md:flex md:items-start'>
          <div className='hidden lg:contents'>
            <ProfileSidebar />
          </div>

          {children}
        </div>
      </CometsContainer>
    </RequireAccount>
  );
};

export default ProfileLayout;
