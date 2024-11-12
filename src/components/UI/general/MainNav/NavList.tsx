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
				className={`flex flex-col lg:flex-row !font-montserrat mx-auto lg:mx-0
                text-[1.4rem] gap-7 pb-8 border-white/80 border-b border-r-0 pr-0  w-full max-w-[200px]
                lg:text-[1rem] lg:gap-6 lg:pb-0 lg:border-b-0 lg:border-r lg:pr-[2.5rem] lg:w-auto lg:max-w-max
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
			<section
				className={`flex flex-col lg:flex-row !font-montserrat
                text-[1.4rem] gap-7 w-full mx-auto mt-8
                lg:text-[1rem] lg:gap-6 lg:w-auto lg:mx-0 lg:mt-0
                `}
			>
				{navListArr.slice(5).map((linkObj, index) => {
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
		</>
	);
};

export default NavList;
