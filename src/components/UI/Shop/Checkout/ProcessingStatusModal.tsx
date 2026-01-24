import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { useOrderProcessingStore } from '@/stores/shop_stores/checkoutStore/orderProcessingStore';
import { cn } from '@/lib/utils';

const statusCopy: Record<
  string,
  {
    title: string;
    description: string;
  }
> = {
  processing: {
    title: 'We are processing your order',
    description: 'Please keep this page open while we finalize your payment.',
  },
  completed: {
    title: 'Order confirmed',
    description: 'Everything looks great. We are preparing your order for fulfillment.',
  },
  error: {
    title: 'We hit a snag',
    description: 'One of the steps failed. Please review the details below and try again.',
  },
  idle: {
    title: 'Awaiting payment',
    description: 'We are standing by to confirm your order.',
  },
};

const statusIcon = (status: 'idle' | 'pending' | 'success' | 'error') => {
  if (status === 'success') return <CheckCircle2 className='text-emerald-300' size={24} />;
  if (status === 'error') return <AlertCircle className='text-rose-300' size={24} />;
  return <Loader2 className='text-sky-200 animate-spin' size={22} />;
};

export const ProcessingStatusModal = () => {
  const modalVisible = useOrderProcessingStore((state) => state.modalVisible);
  const steps = useOrderProcessingStore((state) => state.steps);
  const flowStatus = useOrderProcessingStore((state) => state.flowStatus);
  const customerEmail = useOrderProcessingStore((state) => state.customerEmail);
  const customerName = useOrderProcessingStore((state) => state.customerName);
  const orderId = useOrderProcessingStore((state) => state.orderId);
  const setModalVisible = useOrderProcessingStore((state) => state.setModalVisible);

  const copy = statusCopy[flowStatus] ?? statusCopy.processing;
  const timelineProgress = useMemo(() => {
    const total = steps.length || 1;
    const completed = steps.filter((step) => step.status === 'success').length;
    return Math.round((completed / total) * 100);
  }, [steps]);

  return (
    <AnimatePresence>
      {modalVisible && (
        <motion.div
          className='fixed inset-0 z-[200] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-md'
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className='relative w-full max-w-xl overflow-hidden rounded-[32px] border border-white/20 bg-gradient-to-b from-[#050914]/95 via-[#0f172a]/90 to-[#050914]/95 p-6 text-white shadow-[0_40px_80px_rgba(5,7,19,0.8)] backdrop-blur-3xl'
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
          >
            <motion.div
              className='pointer-events-none absolute -top-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#8b5cf6]/40 via-[#38bdf8]/35 to-transparent blur-3xl opacity-70'
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className='pointer-events-none absolute -bottom-14 right-4 h-56 w-56 rounded-full bg-gradient-to-tr from-[#f472b6]/30 via-transparent to-transparent blur-3xl opacity-70'
              animate={{ scale: [1, 1.2, 1], rotate: [0, 8, 0] }}
              transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className='space-y-4 text-center relative'
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className='flex items-center justify-center gap-2 text-xs uppercase tracking-[0.35em] text-white/60'>
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles size={16} />
                </motion.div>
                <span>Order #{orderId ?? '--'}</span>
              </div>
              <h2 className='text-3xl font-semibold leading-tight'>{copy.title}</h2>
              <p className='text-base text-white/75'>{copy.description}</p>
              {customerName && (
                <p className='text-sm text-white/60'>
                  {customerName}
                  {customerEmail ? ` • ${customerEmail}` : ''}
                </p>
              )}
            </motion.div>

            <motion.div
              className='mt-8 space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-inner shadow-black/30'
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className='flex items-center justify-between text-xs uppercase tracking-wide text-white/60'>
                <span>Progress</span>
                <span>{timelineProgress}%</span>
              </div>
              <div className='relative h-3 w-full overflow-hidden rounded-full bg-white/10'>
                <motion.div
                  className='absolute inset-0 bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400'
                  animate={{ width: `${timelineProgress}%` }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  style={{ width: `${timelineProgress}%` }}
                />
                <motion.div
                  className='absolute inset-y-0 right-0 w-16 bg-gradient-to-r from-transparent to-white/40'
                  animate={{ x: ['0%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            </motion.div>

            <ul className='mt-6 space-y-4'>
              {steps.map((step, index) => (
                <motion.li
                  key={step.key}
                  className='flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-inner shadow-black/20'
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div
                    className={cn(
                      'rounded-full border p-3',
                      step.status === 'success'
                        ? 'border-emerald-300/50 bg-emerald-400/10'
                        : step.status === 'error'
                          ? 'border-rose-300/50 bg-rose-400/10'
                          : 'border-white/20 bg-white/10',
                    )}
                  >
                    {statusIcon(step.status)}
                  </div>
                  <div className='flex flex-col'>
                    <div className='flex items-center gap-3'>
                      <p className='font-semibold text-lg'>{step.label}</p>
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs uppercase tracking-wide',
                          step.status === 'success'
                            ? 'bg-emerald-400/20 text-emerald-200'
                            : step.status === 'error'
                              ? 'bg-rose-400/20 text-rose-200'
                              : step.status === 'pending'
                                ? 'bg-sky-400/20 text-sky-100'
                                : 'bg-white/10 text-white/70',
                        )}
                      >
                        {step.status}
                      </span>
                    </div>
                    <p className='mt-1 text-sm text-white/70'>{step.description}</p>
                    {step.errorMessage && (
                      <p className='mt-2 text-sm text-rose-200'>{step.errorMessage}</p>
                    )}
                  </div>
                </motion.li>
              ))}
            </ul>

            {flowStatus === 'error' && (
              <div className='mt-6 text-center'>
                <p className='text-sm text-rose-200'>
                  Something went wrong while finalizing your order. You can close this window and
                  try again, or reach out to support if the issue persists.
                </p>
                <button
                  className='mt-4 inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10'
                  onClick={() => setModalVisible(false)}
                >
                  Dismiss
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProcessingStatusModal;
