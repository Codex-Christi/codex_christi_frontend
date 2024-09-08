import React from 'react';

const navListArr = ['feed', 'community', 'messages', 'live', 'shop'];

const NavList = () => {
  return (
    <section
      className={`hidden md:flex md:gap-2.5 lg:gap-5 !font-montserrat font-semibold`}
    >
      {navListArr.map((linkText) => {
        return <h1 key={linkText}>{linkText.toLocaleUpperCase()}</h1>;
      })}
    </section>
  );
};

export default NavList;
