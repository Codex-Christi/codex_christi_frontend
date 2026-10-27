import Image from 'next/image';

function TeamPortrait({ name, alt }: { name: string; alt: string }) {
  const imageBase = `/media/img/general/${name}`;

  return (
    <picture className='block'>
      <source
        type='image/webp'
        srcSet={`${imageBase}-72.webp 1x, ${imageBase}-144.webp 2x, ${imageBase}-216.webp 3x`}
      />
      <Image
        className='mx-auto'
        src={`${imageBase}-216.webp`}
        alt={alt}
        width={72}
        height={72}
        unoptimized
        loading='lazy'
      />
    </picture>
  );
}

const AboutUs = () => {
  return (
    <>
      <div className='grid gap-4 lg:grid-cols-3 lg:gap-8 lg:items-end'>
        <section className='bg-[linear-gradient(180deg,_#3D3D3D_0%,_rgba(0,_24,_140,_0.5)_100%)] p-8 rounded-[20px] space-y-4'>
          <h2 className='text-2xl leading-6 font-nico'>
            OUR <br />
            VISION
          </h2>

          <p>
            Codex Christi is a vibrant and nurturing hub designed for Christian
            creatives who seek to honour God through their talents and gifts. It
            is a welcoming community where individuals can come together to
            connect with like-minded believers who share a passion for creative
            expression in various forms, be it through music, writing, visual
            arts, performance, or other mediums.
          </p>

          <p>
            The atmosphere is one of mutual edification, where members uplift
            and inspire one another, in the spirit of unity and purpose.
          </p>
        </section>

        <section className='bg-[linear-gradient(180deg,_#3D3D3D_0%,_rgba(80,_54,_16,_0.5)_100%)] p-8 rounded-[20px] space-y-4'>
          <h2 className='text-2xl leading-6 font-nico'>
            OUR <br />
            MISSION
          </h2>

          <p>
            The goal is to provide a sanctuary where individuals can be
            spiritually rejuvenated and reminded of the higher calling of their
            creative endeavours.
          </p>

          <p>
            In this space, creatives are not only able to showcase the unique
            abilities that God has bestowed upon them, but they are also
            encouraged to continually grow in their faith and craft.
          </p>
        </section>

        <section className='bg-[linear-gradient(180deg,_#3D3D3D_0%,_rgba(84,_37,_129,_0.5)_100%)] p-8 rounded-[20px] space-y-4'>
          <h2 className='text-2xl leading-6 font-nico'>
            OUR <br />
            APPROACH
          </h2>

          <p>
            Through support, collaboration, and shared inspiration, Codex
            Christi aims to be a beacon for Christian creatives who are
            dedicated to using their art as an expression of worship and
            devotion.
          </p>
        </section>
      </div>

      <section className='bg-[linear-gradient(90deg,_rgba(31,_34,_72,_0.5)_1.52%,_rgba(51,_40,_109,_0.5)_100%)] p-8 rounded-[20px] space-y-12'>
        <h2 className='text-[40px] leading-10 text-center font-nico'>
          MEET THE TEAM
        </h2>

        <div className='mx-auto grid grid-cols-2 gap-10 lg:grid-cols-4'>
          <div className='space-y-4'>
            <TeamPortrait name='saint-brisbe' alt='Saint Tarila Brisbe' />

            <div className='text-center'>
              <p className='text-2xl font-semibold text-white'>
                Saint Tarila Brisbe
              </p>

              <p>Co Founder/Dev team</p>
            </div>
          </div>

          <div className='space-y-4'>
            <TeamPortrait name='adebisi-ade' alt='Adebisi Ade' />

            <div className='text-center'>
              <p className='text-2xl font-semibold text-white'>Adebisi Ade</p>

              <p>Dev team</p>
            </div>
          </div>

          <div className='space-y-4'>
            <TeamPortrait name='kennedy-barile' alt='Kennedy Barile' />

            <div className='text-center'>
              <p className='text-2xl font-semibold text-white'>
                Kennedy Barile
              </p>

              <p>Co founder/Design</p>
            </div>
          </div>

          <div className='space-y-4'>
            <TeamPortrait name='messi' alt='Lionel Messi' />

            <div className='text-center'>
              <p className='text-2xl font-semibold text-white'>Lionel Messi</p>

              <p>THE GOAT</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default AboutUs;
