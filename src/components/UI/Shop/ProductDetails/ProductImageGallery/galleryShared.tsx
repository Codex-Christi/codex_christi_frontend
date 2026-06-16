import type { SyntheticEvent } from 'react';

export const imagePreventDefaults = {
  onContextMenu: (e: SyntheticEvent) => e.preventDefault(),
  onDragStart: (e: SyntheticEvent) => e.preventDefault(),
};

export type ImageListLoaderReturnType = {
  loaded: boolean[];
  failed: boolean[];
  anyLoading: boolean;
  anyFailed: boolean;
  allLoaded: boolean;
  markLoaded: (i: number, url?: string) => void;
  markFailed: (i: number) => void;
  retryAll: () => void;
  retryOne: (i: number) => void;
  srcWithRetry: (src: string, i: number) => string;
};

export function LoadingOverlay({ show, onRetry }: { show: boolean; onRetry?: () => void }) {
  if (!show) return null;
  return (
    <div className='absolute inset-0 z-10 grid place-items-center bg-black/30 backdrop-blur-sm'>
      <div className='flex flex-col items-center gap-3'>
        <div className='h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white' />
        {onRetry && (
          <span
            role='button'
            tabIndex={0}
            onClick={onRetry}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onRetry()}
            className='text-white/90 text-sm underline cursor-pointer'
          >
            Reload
          </span>
        )}
      </div>
    </div>
  );
}
