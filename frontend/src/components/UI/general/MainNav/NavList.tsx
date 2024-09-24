'use client';

import { FC } from 'react';
import ActiveLink from './ActiveLink';

export const navListArr = [
  { linkText: 'Home', href: '/' },
  { linkText: 'Podcasts', href: '/podcasts' },
  { linkText: 'Community', href: '/community' },
  { linkText: 'ABOUT US', href: '/about-us' },
  { linkText: 'DONATE', href: '/donate' },
  { linkText: 'SHOP', href: '/shop' },
  { linkText: 'FREELANCING', href: '/freelancing' },
] as const;

const NavList: FC = () => {
  // Hooks

  // State values

  // Refs

  // useEffects

  // Main JSX
  return (
    <>
      <section
        className={`flex flex-col lg:flex-row !font-montserrat  w-[]70px] lg:w-auto mx-auto lg:mx-0
            text-[1.6rem] gap-8 pb-12 border-white/80 border-b
            lg:text-[1rem] lg:gap-6 lg:pb-0 lg:border-none
            `}
      >
        {navListArr.slice(0, 5).map((linkObj, index) => {
          const { linkText, href } = linkObj;

          return (
            <ActiveLink
              linkText={linkText}
              key={linkText}
              href={href}
              index={index}
            />
          );
        })}
      </section>

      {/* // Freelance and Shop section */}
      <section></section>
    </>
  );
};

export default NavList;
