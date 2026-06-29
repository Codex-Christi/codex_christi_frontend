import { FC, ReactNode } from 'react';
import MainNav from '../MainNav';

interface DefaultPageWrapperInterface {
  children?: ReactNode;
  hasMainNav?: boolean | undefined;
}

const DefaultPageWrapper: FC<DefaultPageWrapperInterface> = ({
  children,
  hasMainNav = true,
}) => {
  // Main JSX
  return (
    <>
      {hasMainNav && <MainNav />}
      {children}
    </>
  );
};

export default DefaultPageWrapper;
