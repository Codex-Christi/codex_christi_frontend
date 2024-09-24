//  CREATE ACTIVELINK COMPONENT AND PASS IN PROPS LIKE TEXTNAME, CHILDREN AND EXTEND STYLEPROPS

import Link, { LinkProps } from 'next/link';
import { FC, ReactNode } from 'react';
import { navListArr } from './NavList';
import { BsCaretLeftFill, BsCaretDownFill } from 'react-icons/bs';
import useResponsiveSSR from '@/lib/useResponsiveSSR';

interface ActiveLinkInterface extends LinkProps {
  index: number;
  children?: ReactNode;
  linkText: (typeof navListArr)[number]['linkText'];
}

const ActiveLink: FC<ActiveLinkInterface> = (props) => {
  // Hooks
  const { isDesktopOnly } = useResponsiveSSR();

  // Props Destructuring
  const { children, href, linkText, index } = props;

  return (
    <Link
      className={`${
        linkText === 'ABOUT US' ||
        linkText === 'SHOP' ||
        linkText === 'FREELANCING'
          ? 'flex items-center gap-2'
          : 'flex items-center '
      }

       ${
         linkText === 'DONATE'
           ? ` px-[1.3rem] py-3.5 lg:px-1.5 lg:py-1 border-white border-[1.5px] rounded-2xl lg:rounded-lg`
           : ''
       }

      ${
        linkText === 'SHOP'
          ? `bg-white !text-black px-[3rem] py-4 lg:px-[1.25rem] lg:py-2.5 
        rounded-2xl lg:rounded-lg w-full justify-center max-w-[300px]`
          : ''
      }
      
      ${
        linkText === 'FREELANCING' &&
        `px-[3rem] py-4 lg:px-[1.25rem] lg:py-2.5 w-full justify-center max-w-[300px]
        rounded-2xl lg:rounded-lg border-white border-[1.5px]`
      }

     

      ${
        (index >= 3 && index <= 7) ||
        linkText === 'SHOP' ||
        linkText === 'FREELANCING'
          ? 'font-bold text-white'
          : 'font-semibold text-white/70'
      }

      lg:ml-0 lg:text-center mx-auto

     `}
      //
      // end of className
      //
      href={href.toString().toLowerCase()}
    >
      {linkText === 'ABOUT US' && !isDesktopOnly && (
        <BsCaretLeftFill className='!h-[45%]' />
      )}
      {/* ↑↑↑↑ Caret for Mobiles only ↑↑↑↑ */}
      {linkText} {/* ⟸⟸⟸⟸ the Text of each Link */}
      {/*  */}
      {linkText === 'ABOUT US' && isDesktopOnly && (
        <BsCaretDownFill className='!h-[45%]' />
      )}
      {/* ↑↑↑↑ Caret for Desktop only ↑↑↑↑ */}
      {linkText === 'SHOP' && (
        <svg
          xmlns='http://www.w3.org/2000/svg'
          width='20.796'
          height='22.282'
          viewBox='626.204 -369.641 20.796 22.282'
          style={{ WebkitPrintColorAdjust: 'exact' }}
          fill='none'
          version='1.1'
        >
          <g data-testid='Union-1' opacity='1'>
            <path
              fill='#2576ce'
              d='M627.438-367.797c-.202.403-.301.899-.5 1.891l-.666 3.332a3.41 3.41 0 106.736 1.008l.077-.769a3.53 3.53 0 107.03-.042l.081.811a3.41 3.41 0 106.737-1.008l-.667-3.332c-.198-.992-.298-1.488-.499-1.891a3.35 3.35 0 00-2.105-1.725c-.434-.119-.94-.119-1.952-.119h-10.215c-1.012 0-1.518 0-1.952.119a3.345 3.345 0 00-2.105 1.725zm16.151 10.974c.911 0 1.757-.237 2.487-.648v1.205c0 4.203 0 6.305-1.306 7.611-1.051 1.051-2.618 1.256-5.381 1.296v-3.891c0-1.042 0-1.563-.224-1.951a1.678 1.678 0 00-.612-.612c-.388-.224-.909-.224-1.951-.224s-1.562 0-1.95.224a1.663 1.663 0 00-.612.612c-.224.388-.224.909-.224 1.951v3.891c-2.764-.04-4.331-.245-5.382-1.296-1.306-1.306-1.306-3.408-1.306-7.611v-1.205c.73.411 1.576.648 2.487.648a5.07 5.07 0 003.47-1.369 5.176 5.176 0 003.517 1.369 5.176 5.176 0 003.517-1.369 5.072 5.072 0 003.47 1.369z'
              className='0'
            ></path>
          </g>
        </svg>
      )}
      {linkText === 'FREELANCING' && (
        <svg
          xmlns='http://www.w3.org/2000/svg'
          width='20'
          height='26.785'
          viewBox='-1093.204 -79.64 20 26.785'
          style={{ WebkitPrintColorAdjust: 'exact' }}
          fill='none'
          version='1.1'
        >
          <g data-testid='freelancer icon' opacity='0.949'>
            <path
              fill='#fff'
              d='M-1084.438-79.568c2.868-.383 4.809.759 5.822 3.425.511 2.975-.653 4.961-3.493 5.959-3.454.336-5.418-1.217-5.89-4.658.186-2.352 1.373-3.927 3.561-4.726zm-4.52 9.863c.96-.022 1.919 0 2.877.069a56.193 56.193 0 012.808 3.767l2.945-3.767a11.137 11.137 0 013.973.274c1.14.5 1.893 1.345 2.26 2.534.332 2.553.629 5.11.891 7.671-.089 1.321-.773 2.143-2.055 2.466a77.63 77.63 0 00.479-7.26.956.956 0 00-.479-.343 470.541 470.541 0 00-16.028 0c-.362.224-.545.544-.548.959.299 2.212.436 4.426.411 6.644-1.153-.446-1.747-1.291-1.78-2.534.236-2.588.533-5.168.89-7.74.616-1.554 1.735-2.467 3.356-2.74zm5.069.275c.458-.023.915 0 1.369.068.235.337.417.702.548 1.096a33.356 33.356 0 00-1.233 1.575 9.964 9.964 0 01-1.095-1.575c.085-.411.222-.8.411-1.164zm-7.124 5.479c5.252-.023 10.503 0 15.754.068.086.261.132.535.137.822a180.67 180.67 0 01-.685 6.986c-4.977.069-9.954.092-14.932.069-.16-2.33-.342-4.659-.548-6.986.02-.358.111-.678.274-.959zm-.822 8.493c5.708-.022 11.416 0 17.124.069a.545.545 0 01.137.274c-.33.75-.695 1.48-1.096 2.192-5.023.091-10.046.091-15.069 0a5.732 5.732 0 01-1.096-2.535z'
              className='0'
            ></path>
          </g>
        </svg>
      )}
      {/* If any extra children, render here */}
      {children}
    </Link>
  );
};

export default ActiveLink;
