import Link from 'next/link';
import { BsCaretRightFill } from 'react-icons/bs';

const navListArr = ['feed', 'community', 'messages', 'live', 'shop'] as const;

const NavList = () => {
  return (
    <section
      className={`hidden md:flex md:gap-3.5 lg:gap-5 text-lg !font-montserrat font-semibold`}
    >
      {navListArr.map((linkText: (typeof navListArr)[number]) => {
        if (linkText === 'live') {
          return (
            <Link
              href={linkText}
              className='flex items-center gap-1'
              key={linkText}
            >
              {linkText.toLocaleUpperCase()}
              <BsCaretRightFill />
            </Link>
          );
        }
        return (
          <Link href={linkText} key={linkText}>
            {linkText.toLocaleUpperCase()}
          </Link>
        );
      })}
    </section>
  );
};

//  CREATE ACTIVELINK COMPONENT AND PASS IN PROPS LIKE TEXTNAME, CHILDREN AND EXTEND STYLEPROPS

export default NavList;
