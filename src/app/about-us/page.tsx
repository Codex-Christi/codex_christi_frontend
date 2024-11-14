import AboutUs from '@/components/UI/about/AboutUs';
import DefaultPageWrapper from '@/components/UI/general/DefaultPageWrapper';
import CometsContainer from '@/components/UI/Home/Comets';
import Image from 'next/image';
import Footer from '@/components/UI/general/Footer';
import { Metadata } from 'next/types';

export async function generateMetadata(): Promise<Metadata> {
  return {
    // dynamically get the host from the Next headers
    title: 'Codex Christi | About Us',
    description: 'All there is to know about Codex Christi',
  };
}

const AboutUsPage = () => {
  return (
    <DefaultPageWrapper hasMainNav>
      <div className='relative'>
        <h1 className='text-3xl leading-6 font-nico w-auto inline-block absolute top-1/3 z-50 mx-12 md:mx-20'>
          About <br />{' '}
          <span className='text-right ml-auto block w-full'>Us</span>
        </h1>

        <Image
          priority
          fetchPriority='high'
          alt='About Us'
          height={0}
          width={0}
          src='/media/img/about-hero.svg'
          className={`w-full relative -z-50 h-1/3`}
        />
      </div>

      <CometsContainer />

      <main className='w-full max-w-full pb-10 !overflow-x-hidden relative space-y-4 px-6 pt-10 md:pt-0 md:px-10 lg:space-y-8'>
        <AboutUs />
      </main>

      <Footer />
    </DefaultPageWrapper>
  );
};

export default AboutUsPage;
