import { FC } from 'react';
import Hero from './Hero';
import CometsContainer from './Comets';
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
