'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/UI/primitives/button';
import { TiChevronRight } from 'react-icons/ti';
import useAuthStore from '@/stores/authStore';

const WaitlistButton = () => {
  // Hooks
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  // Main JSX
  return (
    <Button
      name='Join Waitlist Button'
      onClick={() =>
        router.push(isAuthenticated ? '/profile' : '/auth/signup?waitlist=true')
      }
      variant='secondary'
      className={`mt-[150px] md:mt-[144px] lg:mt-[136px] !mx-auto font-inter
         bg-white text-black font-bold text-[1.15rem] py-3 !h-[unset] flex`}
    >
      <h3>{isAuthenticated ? 'View Profile' : `Join waitlist`}</h3>
      {!isAuthenticated && (
        <TiChevronRight className='text-[1.5rem] text-black ml-2' size={20} />
      )}
    </Button>
  );
};

export default WaitlistButton;
