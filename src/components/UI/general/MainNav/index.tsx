'use client';

import { FC, useState } from 'react';
// import Image from "next/image";
// import Link from "next/link";
import Logo from '../Logo';
import NavList from './NavList';
import SideDrawer from './SideDrawer';
import useResponsiveSSR from '@/lib/hooks/useResponsiveSSR';

// Main Nav Component
const MainNav: FC = () => {
	// Hooks
	const { isDesktopOnly } = useResponsiveSSR();

	// States
	const [isSideDrawerOpen, setIsSideDrawerOpen] = useState<boolean>(false);

	// Main JSX
	return (
		<>
			<nav
				role='navigation'
				className={`!z-[99] absolute top-[0] flex w-full pt-4 px-6 md:px-8 lg:py-2 justify-between lg:justify-around items-center !bg-transparent !text-white sticky !select-none`}
			>
				<Logo />

                {/* <div className='flex items-center justify-between gap-12 w-full'>
                    <Link href="/">
                        <Image src="/media/img/general/home-icon.svg" alt="Home" width={24} height={24} />
                    </Link>

                    <Link href="/">
                        <Image src="/media/img/general/podcast-icon.svg" alt="Podcast" width={24} height={24} />
                    </Link>

                    <Link href="/">
                        <Image src="/media/img/general/notifications-icon.svg" alt="Notifications" width={24} height={24} />
                    </Link>

                    <Link href="/">
                        <Image src="/media/img/general/community-icon.svg" alt="Community" width={24} height={24} />
                    </Link>
                </div> */}

				{/* Mobile Hamburger */}
				<button
					name='Mobile hamburger button'
					aria-label='Mobile hamburger button'
					onClick={() => {
						setIsSideDrawerOpen((state) => !state);
					}}
				>
					<svg
						className='lg:!hidden'
						xmlns='http://www.w3.org/2000/svg'
						width='40'
						height='24.516'
						viewBox='2422 -423.383 40 24.516'
						style={{ WebkitPrintColorAdjust: 'exact' }}
						fill='none'
						version='1.1'
					>
						<g
							data-testid='Vector-502'
							opacity='1'
						>
							<path
								fill='#fff'
								d='M2460.065-423.383a1.936 1.936 0 010 3.871v-3.871zm-36.13 3.871a1.935 1.935 0 010-3.871v3.871zm36.13 6.452a1.935 1.935 0 010 3.871v-3.871zm-30.968 3.871a1.936 1.936 0 010-3.871v3.871zm30.968 6.451a1.936 1.936 0 010 3.871v-3.871zM2442-398.867a1.935 1.935 0 110-3.871v3.871zm18.065-20.645h-36.13v-3.871h36.13v3.871zm0 10.323h-30.968v-3.871h30.968v3.871zm0 10.322H2442v-3.871h18.065v3.871z'
								className='0'
							></path>
						</g>
					</svg>
				</button>

				{/*  NavList for Desktop only*/}
				{isDesktopOnly && <NavList />}
			</nav>

			{/* Drawer */}
			<SideDrawer
				openState={isSideDrawerOpen}
				openCloseController={setIsSideDrawerOpen}
			/>
		</>
	);
};

export default MainNav;
