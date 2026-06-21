import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import AdminGlassPanel from './AdminGlassPanel';
import { AdminToolStateBadge } from './AdminStatusBadge';
import type { MetricCard, ToolTone } from './adminShopDashboardTypes';

const toneClass: Record<ToolTone, string> = {
  cyan: 'text-cyan-300',
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  rose: 'text-rose-300',
  violet: 'text-violet-300',
  blue: 'text-blue-300',
};

type AdminMetricCardProps = {
  card: MetricCard;
  index: number;
  reduceMotion: boolean;
};

export default function AdminMetricCard({ card, index, reduceMotion }: AdminMetricCardProps) {
  const Icon = card.icon;
  const cardBody = (
    <AdminGlassPanel
      interactive={Boolean(card.href)}
      className='group relative min-h-[156px] overflow-hidden p-4 sm:min-h-[178px] sm:p-5'
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='flex items-center gap-4'>
          <Icon className={toneClass[card.tone]} size={26} />
          <h2 className='text-sm font-semibold text-white sm:text-base'>{card.title}</h2>
        </div>
        <AdminToolStateBadge state={card.state} />
      </div>

      <div className='mt-7 flex items-end gap-3 sm:mt-8'>
        <p className='text-2xl font-semibold tracking-normal text-white sm:text-3xl'>{card.metric}</p>
        <p className='pb-1 text-sm text-slate-400'>{card.caption}</p>
      </div>

      <div className='mt-4 h-px bg-white/10' />

      <span className='mt-4 inline-flex items-center gap-2 text-sm text-slate-300 group-hover:text-white'>
        {card.action}
        <ArrowRight size={15} />
      </span>
    </AdminGlassPanel>
  );

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.28, delay: Math.min(index * 0.035, 0.22) },
        whileHover: { y: -3 },
      };

  return (
    <motion.div {...motionProps}>
      {card.href ? (
        <Link
          href={card.href}
          className='block focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70'
        >
          {cardBody}
        </Link>
      ) : (
        <button
          type='button'
          className={cn('block w-full cursor-default text-left', !card.href && 'focus:outline-none')}
        >
          {cardBody}
        </button>
      )}
    </motion.div>
  );
}
