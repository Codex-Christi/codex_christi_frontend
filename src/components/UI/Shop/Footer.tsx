import type { ReactNode } from 'react';
import { getMainSiteUrl, getShopSiteUrl } from '@/lib/siteBaseUrls';

const sectionOne = [
  {
    name: 'Help & Support',
    route: '',
  },
  {
    name: 'Tract Order(s)',
    route: '',
  },
  {
    name: 'Report a Product',
    route: '',
  },
  {
    name: 'About Codex Christi',
    route: '',
  },
];

const sectionTwo = [
  {
    name: 'Blog',
    route: '',
  },
  {
    name: 'Careers',
    route: '',
  },
  {
    name: 'Partnerships',
    route: '',
  },
];

const sectionThree = [
  {
    name: 'Terms of Use',
    route: '',
  },
  {
    name: 'Privacy & Security',
    route: '',
  },
  {
    name: 'Delete Account',
    route: '',
  },
];

const sectionFour = [
  {
    name: 'Refund Policy',
    route: '',
  },
  {
    name: 'Payment Protection',
    route: '',
  },
  {
    name: 'Shipping & POD Policy',
    route: '/shop/shipping-pod-policy',
  },
];

type SocialLink = {
  route: string;
  label: string;
  icon: ReactNode;
};

const socialIconClassName = 'size-5';

const socialLinks: SocialLink[] = [
  {
    route: '',
    label: 'Instagram',
    icon: (
      <svg
        aria-hidden='true'
        className={socialIconClassName}
        fill='none'
        viewBox='0 0 24 24'
      >
        <rect width='16' height='16' x='4' y='4' rx='5' stroke='currentColor' strokeWidth='2' />
        <circle cx='12' cy='12' r='3.5' stroke='currentColor' strokeWidth='2' />
        <circle cx='17' cy='7' r='1.2' fill='currentColor' />
      </svg>
    ),
  },
  {
    route: '',
    label: 'Facebook',
    icon: (
      <svg aria-hidden='true' className={socialIconClassName} viewBox='0 0 24 24'>
        <path
          d='M14 8.1h2.2V4.3A27 27 0 0 0 13 4c-3.2 0-5.4 2-5.4 5.6v3.1H4v4.3h3.6V24H12v-7h3.5l.6-4.3H12V10c0-1.2.3-1.9 2-1.9Z'
          fill='currentColor'
        />
      </svg>
    ),
  },
  {
    route: '',
    label: 'X',
    icon: (
      <svg
        aria-hidden='true'
        className={socialIconClassName}
        fill='none'
        viewBox='0 0 24 24'
      >
        <path d='m5 5 14 14M19 5 5 19' stroke='currentColor' strokeWidth='2.4' />
      </svg>
    ),
  },
  {
    route: '',
    label: 'LinkedIn',
    icon: (
      <svg aria-hidden='true' className={socialIconClassName} viewBox='0 0 24 24'>
        <path
          d='M6.5 9H3v12h3.5V9ZM4.8 3A2.05 2.05 0 1 0 4.7 7.1 2.05 2.05 0 0 0 4.8 3ZM21 14.2c0-3.4-1.8-5-4.3-5-2 0-2.9 1.1-3.4 1.9V9H9.8v12h3.5v-6c0-1.6.3-3.1 2.3-3.1 1.9 0 1.9 1.8 1.9 3.2V21H21v-6.8Z'
          fill='currentColor'
        />
      </svg>
    ),
  },
  {
    route: '',
    label: 'GitHub',
    icon: (
      <svg aria-hidden='true' className={socialIconClassName} viewBox='0 0 24 24'>
        <path
          d='M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.9.6-3.5-1.2-3.5-1.2-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 0 1.6 1.1 1.6 1.1.9 1.5 2.3 1.1 2.9.8.1-.7.4-1.1.7-1.4-2.3-.3-4.7-1.2-4.7-5A3.9 3.9 0 0 1 6.5 8.7c-.1-.3-.5-1.4.1-2.8 0 0 .9-.3 2.9 1.1a9.8 9.8 0 0 1 5.2 0c2-1.4 2.9-1.1 2.9-1.1.6 1.4.2 2.5.1 2.8a3.9 3.9 0 0 1 1.1 2.8c0 3.9-2.4 4.7-4.7 5 .4.3.7.9.7 1.8V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z'
          fill='currentColor'
        />
      </svg>
    ),
  },
  {
    route: '',
    label: 'Email',
    icon: (
      <svg
        aria-hidden='true'
        className={socialIconClassName}
        fill='none'
        viewBox='0 0 24 24'
      >
        <path
          d='M4 6h16v12H4V6Zm0 1 8 6 8-6'
          stroke='currentColor'
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth='2'
        />
      </svg>
    ),
  },
];

function resolveFooterHref(route: string) {
  if (!route) return '#';
  if (route.startsWith('/shop')) return getShopSiteUrl(route.replace(/^\/shop/, '') || '/');
  if (route.startsWith('/')) return getMainSiteUrl(route);
  return route;
}

const Footer = () => {
  return (
    <footer className='bg-[#3D3D3D4D] grid gap-12 px-2 py-10 md:px-8 lg:px-16 text-white'>
      <div className='grid gap-4 grid-cols-2 md:grid-cols-4'>
        <ul className='space-y-4'>
          {sectionOne.map((section) => (
            <li key={section.name}>
              <a
                className='hover:underline hover:decoration-double underline-offset-4'
                href={resolveFooterHref(section.route)}
              >
                {section.name}
              </a>
            </li>
          ))}
        </ul>

        <ul className='space-y-4'>
          {sectionTwo.map((section) => (
            <li key={section.name}>
              <a
                className='hover:underline hover:decoration-double underline-offset-4'
                href={resolveFooterHref(section.route)}
              >
                {section.name}
              </a>
            </li>
          ))}
        </ul>

        <ul className='space-y-4'>
          {sectionThree.map((section) => (
            <li key={section.name}>
              <a
                className='hover:underline hover:decoration-double underline-offset-4'
                href={resolveFooterHref(section.route)}
              >
                {section.name}
              </a>
            </li>
          ))}
        </ul>

        <ul className='space-y-4'>
          {sectionFour.map((section) => (
            <li key={section.name}>
              <a
                className='hover:underline hover:decoration-double underline-offset-4'
                href={resolveFooterHref(section.route)}
              >
                {section.name}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className='flex items-center justify-between flex-wrap gap-8'>
        <div className='flex items-center gap-4 md:gap-8 flex-wrap'>
          {socialLinks.map((media) => (
            <a
              aria-label={`Connect with us on ${media.label}`}
              className='grid size-9 place-items-center rounded-full border border-white/15 text-white/80 transition hover:border-white/40 hover:text-white'
              href={resolveFooterHref(media.route)}
              key={media.label}
            >
              {media.icon}
            </a>
          ))}
        </div>

        <p className='text-sm'>©Codex Christi</p>
      </div>
    </footer>
  );
};

export default Footer;
