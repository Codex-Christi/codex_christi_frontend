import { cn } from '@/lib/utils';
import { FC } from 'react';

type PayPalMode = 'card' | 'paypal_buttons' | 'google_pay' | '';

const shimmerStyle = {
  backgroundImage:
    'linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.06) 100%)',
  backgroundSize: '200% 100%',
  animation: 'paypal-shimmer 1.4s ease-in-out infinite',
} as const;

const ShimmerBlock: FC<{ className?: string }> = ({ className }) => (
  <div
    className={cn('relative overflow-hidden rounded-md bg-white/10', className)}
    style={shimmerStyle}
  />
);

const PayPalLoadingSkeleton: FC<{ mode: PayPalMode }> = ({ mode }) => {
  return (
    <div className='w-full'>
      <style jsx>{`
        @keyframes paypal-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>

      {mode === 'paypal_buttons' ? (
        <div className='space-y-3 flex flex-col md:flex-row gap-4 items-center justify-center'>
          <ShimmerBlock className='h-11 my-0 w-full self-center rounded-full' />
          <ShimmerBlock className='h-11 my-0 w-full self-center rounded-full' />
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {Array.from({ length: 10 }).map((_, index) => (
            <ShimmerBlock key={`pp-skel-${index}`} className='h-12 w-full' />
          ))}
          <div className='md:col-span-2'>
            <ShimmerBlock className='h-12 w-full rounded-full' />
          </div>
        </div>
      )}
    </div>
  );
};

export default PayPalLoadingSkeleton;
