import { FC } from 'react';
import Hero from './Hero';
import dynamic from 'next/dynamic';
const CometsContainer = dynamic(() => import('../general/CometsContainer'));

const WaitlistButton = dynamic(() => import('./WaitlistButton'), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden='true'
      className='mt-[150px] md:mt-[144px] lg:mt-[136px] mx-auto h-[52px] w-[160px]'
    />
  ),
});

const Home: FC = () => {
  return (
    <>
      <CometsContainer />
      <Hero />
      <WaitlistButton />
    </>
  );
};

export default Home;
