import { FC, ReactNode } from 'react';

interface CometsContainerInterface {
  children?: ReactNode;
}

const CometsContainer: FC<CometsContainerInterface> = (props) => {
  // Props
  const { children } = props || {};

  // Main JSX
  return (
    <div
      className={`${children ? 'relative' : 'absolute'} top-0 bottom-0 left-0 right-0 w-full
      ${children ? '!-z-[0] min-h-dvh' : '!-z-[1]'} overflow-hidden `}
    >
      <div
        aria-hidden='true'
        className={`absolute -top-1/2 -left-1/2 w-[200%] h-[200%]
          ${children ? '!-z-[0]' : '!-z-[1]'} ${children ? 'min-h-dvh' : 'min-h-[auto]'}
          bg-[url('/media/img/home/comets_mobile.svg')]
          md:bg-[url('/media/img/home/comets_tablet.svg')]
          lg:bg-[url('/media/img/home/comets_ desktop.svg')]
          bg-repeat animate-ltr-linear-infinite !ease-linear motion-reduce:animate-none`}
      />

      {children ? (
        <div
          className={`!pointer-events-auto absolute top-0 bottom-0 left-0 right-0 w-full h-full !z-[0]`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
};

export default CometsContainer;
