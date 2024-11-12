import { FC } from 'react';
import Hero from './Hero';
import dynamic from 'next/dynamic';
const CometsContainer = dynamic(() => import('./Comets'));
import WaitlistButton from './WaitlistButton';

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
