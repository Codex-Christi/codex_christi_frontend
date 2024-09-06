import { FC } from 'react';
import Hero from './Hero';
import CometsContainer from './Comets';

const Home: FC = () => {
  return (
    <>
      <CometsContainer />
      <Hero />
    </>
  );
};

export default Home;
