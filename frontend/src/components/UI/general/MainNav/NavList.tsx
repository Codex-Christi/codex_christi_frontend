import ActiveLink from './ActiveLink';

export const navListArr = [
  'feed',
  'community',
  'messages',
  'live',
  'shop',
] as const;

const NavList = () => {
  return (
    <section
      className={`hidden md:flex md:gap-6 lg:gap-[2rem] text-[1.05rem] !font-montserrat font-bold`}
    >
      {navListArr.map((linkText: (typeof navListArr)[number]) => (
        <ActiveLink linkText={linkText} key={linkText} href={linkText} />
      ))}
    </section>
  );
};

export default NavList;
