import { FC } from 'react';
import Hero from './Hero';
import dynamic from 'next/dynamic';
import WaitlistButtonSlot from './WaitlistButtonSlot';

const CometsContainer = dynamic(() => import('../general/CometsContainer'));

const Home: FC = () => {
  return (
    <>
      <CometsContainer />
      <Hero />
      <WaitlistButtonSlot />
    </>
  );
};

export default Home;
