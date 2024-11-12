import AboutUs from '@/components/UI/about/AboutUs';
import DefaultPageWrapper from '@/components/UI/general/DefaultPageWrapper';
import CometsContainer from '@/components/UI/Home/Comets';
import Image from "next/image";
import Footer from '@/components/UI/Footer';
import { Metadata } from 'next/types';
import { headers } from 'next/headers';

export async function generateMetadata(): Promise<Metadata> {
	return {
		// dynamically get the host from the Next headers
		metadataBase: new URL(`https://${headers().get('host')}`),
		title: 'Codex Christi | About Us',
		description: 'All there is to know about Codex Christi',
	};
}

const AboutUsPage = () => {
	return (
		<DefaultPageWrapper hasMainNav>
			<Image
				priority={false}
				loading='lazy'
				alt='About Us'
				height={0}
				width={0}
				src='/media/img/about-hero.svg'
				className={`w-full relative -z-50 h-1/3`}
            />
			<CometsContainer />

			<main className='w-full max-w-full pb-10 !overflow-x-hidden relative space-y-4 px-6 pt-10 md:pt-0 md:px-10'>
				<AboutUs />
			</main>

            <Footer />
		</DefaultPageWrapper>
	);
};

export default AboutUsPage;
