import ProfileSidebar from '@/components/UI/profile/ProfileSidebar';
import ServerAccountBoundary from '@/components/UI/Auth/ServerAccountBoundary';
import '../route-utilities.css';
import dynamic from 'next/dynamic';
const CometsContainer = dynamic(() => import('@/components/UI/general/CometsContainer'));

const ProfileLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <ServerAccountBoundary>
      <CometsContainer>
        <div className='md:flex md:items-start'>
          <div className='hidden lg:contents'>
            <ProfileSidebar />
          </div>

          {children}
        </div>
      </CometsContainer>
    </ServerAccountBoundary>
  );
};

export default ProfileLayout;
