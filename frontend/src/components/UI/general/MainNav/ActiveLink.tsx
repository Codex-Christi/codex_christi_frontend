//  CREATE ACTIVELINK COMPONENT AND PASS IN PROPS LIKE TEXTNAME, CHILDREN AND EXTEND STYLEPROPS

import Link, { LinkProps } from 'next/link';
import { FC, ReactNode } from 'react';
import { navListArr } from './NavList';
import { BsCaretRightFill } from 'react-icons/bs';

interface ActiveLinkInterface extends LinkProps {
  children?: ReactNode;
  linkText: (typeof navListArr)[number];
}

const ActiveLink: FC<ActiveLinkInterface> = (props) => {
  // Props Destructuring
  const { children, href, linkText } = props;

  return (
    <Link
      className={`${
        linkText === 'live' || linkText === 'shop'
          ? 'flex items-center gap-1'
          : 'flex items-center '
      }
      ${linkText === 'community' ? 'md:!hidden lg:!flex' : ''}
      ${linkText === 'shop' ? 'bg-white text-black py-1 px-2 rounded-md' : ''}
     `} // end of className
      href={href}
    >
      {linkText.toLocaleUpperCase()}
      {linkText === 'live' && <BsCaretRightFill />}
      {linkText === 'shop' && (
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

      {/* If any extra children, render here */}
      {children}
    </Link>
  );
};

export default ActiveLink;
