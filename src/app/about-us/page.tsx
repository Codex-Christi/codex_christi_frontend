import AboutUs from '@/components/UI/about/AboutUs';
import AboutHero from '@/components/UI/about/AboutHero';
import '../route-utilities.css';
import DefaultPageWrapper from '@/components/UI/general/DefaultPageWrapper';
import CometsContainer from '@/components/UI/general/CometsContainer';
import Footer from '@/components/UI/general/Footer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Codex Christi | About Us',
  description: 'All there is to know about Codex Christi',
};

const AboutUsPage = () => {
  return (
    <DefaultPageWrapper navAppearance='glass'>
      <AboutHero />

      <CometsContainer />

      <main className='w-full max-w-full pb-10 !overflow-x-hidden relative space-y-4 px-6 pt-10 md:pt-0 md:px-10 lg:space-y-8'>
        <AboutUs />
      </main>

      <Footer />
    </DefaultPageWrapper>
  );
};

export default AboutUsPage;
