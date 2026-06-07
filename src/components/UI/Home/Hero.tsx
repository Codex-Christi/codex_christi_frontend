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

      <picture>
        <source
          media='(min-width: 1024px)'
          srcSet='/media/img/general/logo-main-704.avif'
          type='image/avif'
        />
        <source
          media='(min-width: 768px)'
          srcSet='/media/img/general/logo-main-576.avif'
          type='image/avif'
        />
        <source srcSet='/media/img/general/logo-main-384.avif' type='image/avif' />
        <source
          media='(min-width: 1024px)'
          srcSet='/media/img/general/logo-main-704.webp'
          type='image/webp'
        />
        <source
          media='(min-width: 768px)'
          srcSet='/media/img/general/logo-main-576.webp'
          type='image/webp'
        />
        <source srcSet='/media/img/general/logo-main-384.webp' type='image/webp' />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt='Hero Logo Image'
          className='pointer-events-none absolute left-auto right-0 h-auto w-[12rem] md:w-[18rem] lg:w-[22rem]'
          decoding='sync'
          fetchPriority='high'
          height={129}
          loading='eager'
          src='/media/img/general/logo-main.svg'
          width={149}
        />
      </picture>
    </div>
  );
};

export default Hero;
