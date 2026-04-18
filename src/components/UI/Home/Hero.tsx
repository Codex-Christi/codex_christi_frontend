import Image from 'next/image';
import HeroImage from '../../../../public/media/img/general/logo-main.svg';

const Hero = () => {
  return (
    <div
      className={`flex select-none items-center relative px-5  w-full mx-auto
        mt-[200px] md:mt-[225px] lg:mt-[150px]
        max-w-[500px] min-h-[12rem]
        md:max-w-[570px] md:min-h-[13rem] 
        lg:max-w-[675px] lg:min-h-[17rem] font-nico
       `}
    >
      <section
        className={`flex flex-col gap-[1px] text-[2rem] md:text-[2.75rem] lg:text-[3.5rem] relative
            !leading-tight text-shadow-lg shadow-white`}
      >
        <h2>CREATE</h2>
        <h2>CONNECT</h2>
        <h2>TRANSFORM</h2>
      </section>

      <Image
        priority
        fetchPriority='high'
        alt='Hero Logo Image'
        src={HeroImage}
        className='pointer-events-none absolute left-auto right-0 h-auto w-[12rem] md:w-[18rem] lg:w-[22rem]'
      />
    </div>
  );
};

export default Hero;
