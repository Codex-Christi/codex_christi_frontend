'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

const variants = {
  initial: { opacity: 0, x: 1000 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -100 },
};

const PageTransition = ({ children }: { children: ReactNode }) => {
  // Hooks
  const pathname = usePathname();

  // Main JSX
  return (
    <AnimatePresence mode='popLayout' initial={false}>
      <motion.div
        key={pathname} // Use the pathname as the key for each page
        variants={variants}
        initial='initial'
        animate='animate'
        exit='exit'
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export default PageTransition;
