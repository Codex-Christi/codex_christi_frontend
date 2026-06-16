// app/not-found.tsx
import { ShoppingCart } from 'lucide-react';
import Cube from '@/components/UI/Shop/404PageComponents/Cube';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className='!relative min-h-dvh w-full bg-transparent !select-none'>
      {/* Floating cube */}
      <Cube className='!top-10 !left-10' />

      {/* Glassmorphic container */}
      <div className='shop-not-found-panel relative flex flex-col items-center justify-center min-h-screen backdrop-blur-[2px] px-4'>
        <div
          className={`p-6 sm:p-8 rounded-3xl bg-white/5 backdrop-blur-2xl !-mt-[10rem] sm:!-mt-[10rem] border border-white/10
          shadow-2xl w-full max-w-md sm:max-w-lg text-center`}
        >
          {/* Animated shopping cart */}
          <div className='shopping-cart-float mb-6 sm:mb-8'>
            <ShoppingCart className='w-16 h-16 sm:w-24 sm:h-24 text-cyan-400' />
          </div>

          {/* 404 text */}
          <h1
            className={`text-6xl sm:text-9xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text
            font-ocr text-transparent mb-4 shop-not-found-title`}
          >
            404
          </h1>

          {/* Message */}
          <p className='shop-not-found-copy text-lg sm:text-xl text-gray-300 mb-6 sm:mb-8 font-ocr font-semibold'>
            Product not found in our quantum inventory
          </p>

          {/* Return button */}
          <div className='shop-not-found-link flex justify-center'>
            <Link
              href='/'
              className={`bg-transparent rounded-2xl !border-cyan-400/50 border
				 text-cyan-400 hover:bg-cyan-400/30 hover:text-white
			font-ocr !font-bold px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base`}
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
