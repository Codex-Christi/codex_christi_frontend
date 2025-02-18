'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/UI/primitives/button';

const WaitlistButton = () => {
  // Hooks
  const router = useRouter();

  // Main JSX
  return (
    <Button
      name='Join Waitlist Button'
      onClick={() => router.push('/auth/signup?waitlist=true')}
      variant='secondary'
      className={`mt-[150px] md:mt-[144px] lg:mt-[136px] !mx-auto block font-inter
         bg-white text-black font-bold text-[1.15rem] py-3 !h-[unset]`}
    >
      Join waitlist
    </Button>
  );
};

export default WaitlistButton;
