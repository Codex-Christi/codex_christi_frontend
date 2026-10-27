import { adminGlassPanelClass } from '@/components/UI/Admin/dashboard/AdminGlassPanel';

export default function LoadingDeliveryChecker() {
  return (
    <div
      role='status'
      aria-label='Loading delivery checker'
      className='mx-auto max-w-7xl space-y-5 px-4 py-6 motion-safe:animate-pulse sm:px-6'
    >
      <div className='h-5 w-36 rounded bg-white/10' />
      <div className={`${adminGlassPanelClass} flex flex-wrap gap-3 p-4`}>
        <div className='h-10 min-w-40 flex-1 rounded bg-white/10' />
        <div className='h-10 w-64 max-w-full rounded bg-white/10' />
      </div>
      <div className={`${adminGlassPanelClass} divide-y divide-white/10 px-4`}>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className='flex min-h-32 gap-3 py-4'>
            <div className='h-20 w-20 shrink-0 rounded bg-white/10' />
            <div className='grid min-w-0 flex-1 content-start gap-3 py-1'>
              <div className='h-4 w-72 max-w-full rounded bg-white/10' />
              <div className='h-3 w-48 max-w-full rounded bg-white/5' />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
