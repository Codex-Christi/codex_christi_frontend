'use client';

import Image from 'next/image';
import ProfileImage from '@/assets/img/profile-img.png';
import { FC, Dispatch, SetStateAction } from 'react';

const ProfileBanner: FC<{
  setIsActive: Dispatch<SetStateAction<boolean>>;
  isActive: boolean;
}> = ({ setIsActive, isActive }) => {
  return (
    <>
      <div className='flex items-start justify-between gap-4 px-4 py-8 bg-black/5 backdrop-blur-[30px] rounded-t-[20px]'>
        <div className='flex items-center gap-4'>
          <Image
            className='size-20 rounded-full'
            src={ProfileImage}
            alt='User'
          />

          <div className='space-y-4'>
            <div>
              <h1 className='text-2xl font-semibold flex items-center gap-1'>
                Mark Alveu{' '}
                <svg width='19' height='13' viewBox='0 0 19 13' fill='none'>
                  <path
                    d='M0.522461 1.50098C0.522461 0.948692 0.970176 0.500977 1.52246 0.500977H6.52246V12.501H1.52246C0.970176 12.501 0.522461 12.0533 0.522461 11.501V1.50098Z'
                    fill='#056A00'
                  />
                  <rect
                    x='6.52246'
                    y='0.500977'
                    width='6'
                    height='12'
                    fill='white'
                  />
                  <path
                    d='M12.5225 0.500977H17.5225C18.0747 0.500977 18.5225 0.948692 18.5225 1.50098V11.501C18.5225 12.0533 18.0747 12.501 17.5225 12.501H12.5225V0.500977Z'
                    fill='#056A00'
                  />
                </svg>
              </h1>

              <p className='text-white/70'>@MarkA</p>
            </div>

            <div>
              <p className='text-lg'>Christ in me 💛 the hope of Glory.</p>

              <p className='flex items-center gap-10 text-white/70'>
                <span>30 following</span>

                <span>3.2k followers</span>
              </p>
            </div>
          </div>
        </div>

        <button
          className='inline-block border border-white py-3 px-4 rounded-sm shrink-0'
          type='button'
          onClick={() => setIsActive(!isActive)}
        >
          Edit Profile
        </button>
      </div>
    </>
  );
};

export default ProfileBanner;
