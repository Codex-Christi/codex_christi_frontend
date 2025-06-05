'use client';

// app/not-found.tsx
import { motion } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import Cube from '@/components/UI/Shop/404PageComponents/Cube';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';

export default function NotFound() {
  return (
    <div className='!relative min-h-dvh w-full bg-transparent !select-none'>
      {/* Floating cube */}
      <Cube className='!top-10 !left-10' />

      {/* Glassmorphic container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className='relative flex flex-col items-center justify-center min-h-screen backdrop-blur-[2px] px-4'
      >
        <div
          className={`p-6 sm:p-8 rounded-3xl bg-white/5 backdrop-blur-2xl !-mt-[10rem] sm:!-mt-[10rem] border border-white/10
          shadow-2xl w-full max-w-md sm:max-w-lg text-center`}
        >
          {/* Animated shopping cart */}
          <motion.div
            animate={{
              rotate: [0, -10, 10, 0],
              y: [0, -20, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className='mb-6 sm:mb-8'
          >
            <ShoppingCart className='w-16 h-16 sm:w-24 sm:h-24 text-cyan-400' />
          </motion.div>

          {/* 404 text */}
          <motion.h1
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 100 }}
            className={`text-6xl sm:text-9xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text
            font-ocr text-transparent mb-4`}
          >
            404
          </motion.h1>

          {/* Message */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className='text-lg sm:text-xl text-gray-300 mb-6 sm:mb-8 font-ocr font-semibold'
          >
            Product not found in our quantum inventory
          </motion.p>

          {/* Return button */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className='flex justify-center'
          >
            <CustomShopLink
              href='/shop'
              className={`bg-transparent border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/30 hover:text-white
			font-ocr !font-bold px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base`}
            >
              Return to Home
            </CustomShopLink>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
