import { FC, ReactNode } from 'react';

interface CometsContainerInterface {
  children?: ReactNode;
}

const CometsContainer: FC<CometsContainerInterface> = (props) => {
  // Props
  const { children } = props || {};
  const hasChildren = Boolean(children);

  // Main JSX
  return (
    <div
      className={`${hasChildren ? 'relative min-h-dvh overflow-x-hidden' : 'absolute top-0 bottom-0 left-0 right-0 !-z-[1] overflow-hidden'} w-full`}
    >
      {hasChildren ? (
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 z-0 min-h-dvh overflow-hidden'
        >
          <div
            className='absolute -left-1/2 -top-1/2 h-[200%] min-h-dvh w-[200%]
            bg-[url("/media/img/home/comets_mobile.svg")]
            bg-repeat animate-ltr-linear-infinite !ease-linear motion-reduce:animate-none
            md:bg-[url("/media/img/home/comets_tablet.svg")]
            lg:bg-[url("/media/img/home/comets_ desktop.svg")]'
          />
        </div>
      ) : null}

      {!hasChildren ? (
        <div
          aria-hidden='true'
          className='pointer-events-none absolute -left-1/2 -top-1/2 !-z-[1] h-[200%] min-h-[auto] w-[200%]
          bg-[url("/media/img/home/comets_mobile.svg")]
          bg-repeat animate-ltr-linear-infinite !ease-linear motion-reduce:animate-none
          md:bg-[url("/media/img/home/comets_tablet.svg")]
          lg:bg-[url("/media/img/home/comets_ desktop.svg")]'
        />
      ) : null}

      {hasChildren ? (
        <div className='relative z-10 min-h-dvh w-full pointer-events-auto'>
          {children}
        </div>
      ) : null}
    </div>
  );
};

export default CometsContainer;
