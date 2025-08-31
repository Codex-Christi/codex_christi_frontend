// /category/[id]/Skeleton.tsx
import { Skeleton } from '@/components/UI/primitives/skeleton';

export default function SkeletonContainer({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className='flex flex-col shadow-md overflow-hidden mx-auto w-full max-w-[275px] my-5'
        >
          <Skeleton className='h-[14rem] rounded-none rounded-t-xl !backdrop-blur-3xl ' />
          <Skeleton className='h-14 bg-slate-400 rounded-none !backdrop-blur-3xl' />
          <Skeleton className='h-12 bg-blue-400 rounded-none rounded-b-xl !backdrop-blur-3xl' />
        </div>
      ))}
    </>
  );
}
