import Image from 'next/image';
import styles from './AboutHero.module.css';

export default function AboutHero() {
  return (
    <div className='relative h-[20rem]'>
      <h1 className='text-3xl leading-6 font-nico w-auto inline-block absolute top-1/3 z-50 mx-10 md:mx-20'>
        About <br /> <span className='text-right ml-auto block w-full'>Us</span>
      </h1>

      <div className={styles.backdrop}>
        <picture className={styles.picture}>
          <source
            media='(min-width: 1024px)'
            type='image/svg+xml'
            srcSet='/media/img/about-hero.desktop.svg'
          />
          <Image
            loading='eager'
            fetchPriority='high'
            alt='About Us'
            fill
            unoptimized
            src='/media/img/about-hero.optimized.svg'
            className={`size-full object-cover ${styles.image}`}
          />
        </picture>
      </div>
    </div>
  );
}
