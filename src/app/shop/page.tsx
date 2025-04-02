'use client';
import { Button } from '@/components/UI/primitives/button';
import { FC } from 'react';
import axios from 'axios';
import TopHomeBanner from '@/components/UI/Shop/ShopHomepageComponents/TopHomeBanner';

const Shop: FC = () => {
  const logOut = async () => {
    await axios
      .get(`${process.env.NEXT_PUBLIC_BASE_URL}/signout`)
      .then((resp) => {
        console.log('Logout successful');
      });
  };

  // Main Shop Home Page Client JSX
  return (
    <div className='relative flex flex-col'>
      <TopHomeBanner />
      <Button name='Logout button' className='w-20' onClick={logOut}>
        Logout
      </Button>
    </div>
  );
};

export default Shop;
