import { FC, ReactNode } from 'react';
import MainNav, { type MainNavAppearance } from '../MainNav';

interface DefaultPageWrapperInterface {
  children?: ReactNode;
  hasMainNav?: boolean | undefined;
  navAppearance?: MainNavAppearance;
}

const DefaultPageWrapper: FC<DefaultPageWrapperInterface> = ({
  children,
  hasMainNav = true,
  navAppearance = 'transparent',
}) => {
  // Main JSX
  return (
    <>
      {hasMainNav && <MainNav appearance={navAppearance} />}
      {children}
    </>
  );
};

export default DefaultPageWrapper;
