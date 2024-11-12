import { FC } from 'react';

const CometsContainer: FC = () => {
  return (
    <div className='absolute top-0 bottom-0 left-0 right-0 w-full !-z-[5]'>
      <div
        className={`relative top-0 bottom-0 left-0 right-0 w-full h-full !z-[5]
          bg-[url('/media/img/home/comets_mobile.svg')]
          md:bg-[url('/media/img/home/comets_tablet.svg')]
          lg:bg-[url('/media/img/home/comets_ desktop.svg')]
          bg-repeat animate-ltr-linear-infinite !ease-linear`}
      />
    </div>
  );
};

export default CometsContainer;
