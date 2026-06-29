import { FC, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CometsContainerInterface {
  children?: ReactNode;
  className?: string;
  cometClassName?: string;
  cometMotion?: 'animated' | 'static';
  variant?: 'page' | 'overlay';
}

const CometsContainer: FC<CometsContainerInterface> = (props) => {
  // Props
  const { children, className, cometClassName, cometMotion = 'animated', variant = 'page' } =
    props || {};
  const hasChildren = Boolean(children);
  const animatedCometFieldClassName =
    'absolute -left-1/2 -top-1/2 h-[200%] min-h-dvh w-[200%] bg-[url("/media/img/home/comets_mobile.svg")] bg-repeat animate-ltr-linear-infinite !ease-linear motion-reduce:animate-none md:bg-[url("/media/img/home/comets_tablet.svg")] lg:bg-[url("/media/img/home/comets_ desktop.svg")]';
  const staticCometFieldClassName =
    'fixed inset-0 h-dvh w-screen bg-[url("/media/img/home/comets_mobile.svg")] bg-repeat bg-left-top !animate-none !transform-none md:bg-[url("/media/img/home/comets_tablet.svg")] lg:bg-[url("/media/img/home/comets_ desktop.svg")]';
  const cometFieldClassName =
    cometMotion === 'static' ? staticCometFieldClassName : animatedCometFieldClassName;

  if (variant === 'overlay') {
    return (
      <div
        aria-hidden='true'
        className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      >
        <div className={cn(cometFieldClassName, cometClassName)} />
      </div>
    );
  }

  // Main JSX
  return (
    <div
      className={cn(
        hasChildren
          ? 'relative min-h-dvh overflow-x-hidden'
          : 'absolute top-0 bottom-0 left-0 right-0 !-z-[1] overflow-hidden',
        'w-full',
        className,
      )}
    >
      {hasChildren ? (
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 z-0 min-h-dvh overflow-hidden'
        >
          <div className={cn(cometFieldClassName, cometClassName)} />
        </div>
      ) : null}

      {!hasChildren ? (
        <div
          aria-hidden='true'
          className={cn(
            cometFieldClassName,
            'pointer-events-none !-z-[1] min-h-[auto]',
            cometClassName,
          )}
        />
      ) : null}

      {hasChildren ? (
        <div className='relative z-10 min-h-dvh w-full pointer-events-auto'>{children}</div>
      ) : null}
    </div>
  );
};

export default CometsContainer;
