'use client';

import DefaultPageWrapper from '@/components/UI/general/DefaultPageWrapper';
import Footer from '@/components/UI/general/Footer';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export default function NotFound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [audioAllowed, setAudioAllowed] = useState(false);
  const [matrixRain, setMatrixRain] = useState<
    { id: number; left: string; symbol: string; duration: number }[]
  >([]);
  const [hydrationComplete, setHydrationComplete] = useState(false);

  useEffect(() => {
    setHydrationComplete(true);
    audioRef.current = new Audio('/sounds/beep.wav');

    const rain = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      symbol: ['0', '1', 'Ξ', '╳', '▲', '█'][Math.floor(Math.random() * 6)],
      duration: Math.random() * 3 + 2,
    }));
    setMatrixRain(rain);
  }, []);

  const enableAudio = () => setAudioAllowed(true);

  const playSound = () => {
    if (audioAllowed && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCursorPosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Main JSX
  if (!hydrationComplete) return null;
  return (
    <DefaultPageWrapper hasMainNav>
      <div
        className={`relative flex flex-col items-center justify-center w-full h-[82vh] mt-20 bg-black text-white 
       !select-none text-center overflow-hidden px-4`}
        onClick={enableAudio}
      >
        {/* Matrix Rain Effect (Client-Only to Prevent Hydration Mismatch) */}
        {hydrationComplete && (
          <div className='absolute inset-0 overflow-hidden pointer-events-none'>
            {matrixRain.map((drop) => (
              <motion.div
                key={drop.id}
                className='absolute text-neon-green opacity-70 font-ocr'
                initial={{ y: '-100%' }}
                animate={{ y: '110%' }}
                transition={{
                  repeat: Infinity,
                  duration: drop.duration,
                  ease: 'linear',
                }}
                style={{
                  left: drop.left,
                  fontSize: '1rem',
                  transform: 'rotate(-20deg)',
                }}
              >
                {drop.symbol}
              </motion.div>
            ))}
          </div>
        )}

        {/* Glitching 404 Text (Fully Centered) */}
        <motion.h1
          className='text-7xl sm:text-9xl font-extrabold text-neon-purple glitch-effect font-ocr leading-tight'
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          404
        </motion.h1>

        {/* Subtitle (Centered & Scales on Mobile) */}
        <motion.p
          className='text-lg sm:text-2xl text-gray-400 mt-4 glitch-effect font-ocr'
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          You’ve entered the void. This page doesn’t exist.
        </motion.p>

        {/* Floating Cyber Orb (Mobile-Optimized) */}
        <motion.div
          className='absolute top-20 sm:top-24 left-1/2 transform -translate-x-1/2 bg-neon-purple rounded-full'
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 360],
            x: [0, 10, 0],
            y: [0, 10, 0],
          }}
          transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
          style={{
            width: '60px',
            height: '60px',
            boxShadow: '0 0 15px rgba(173, 51, 255, 0.8)',
          }}
        />

        {/* Neon Glow Button (Centered & Scales on Mobile) */}
        <motion.div
          className='mt-6'
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          <Link
            href='/'
            className='px-6 py-3 text-white text-lg font-semibold bg-neon-blue rounded-lg shadow-neon hover:shadow-neon-glow transition-all font-ocr'
            onMouseEnter={playSound}
          >
            Return to Reality
          </Link>
        </motion.div>

        {/* Interactive Cursor (Hidden on Mobile for Performance) */}
        <motion.div
          className='absolute rounded-full w-8 h-8 sm:w-12 sm:h-12 bg-neon-purple z-50 pointer-events-none hidden sm:block'
          style={{
            left: `${cursorPosition.x - 24}px`,
            top: `${cursorPosition.y - 24}px`,
            boxShadow: `0 0 15px rgba(173, 51, 255, 1)`,
          }}
          animate={{ scale: [1, 1.5, 1], opacity: [1, 0.7, 1] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
        />

        {/* Extra Styles */}
        <style jsx>{`
          .glitch-effect {
            animation: glitch 1.5s infinite;
          }

          @keyframes glitch {
            0% {
              text-shadow:
                3px 3px 20px rgba(173, 51, 255, 0.8),
                -3px -3px 20px rgba(51, 173, 255, 0.8);
            }
            25% {
              text-shadow:
                -5px -3px 15px rgba(51, 173, 255, 0.9),
                3px 3px 10px rgba(173, 51, 255, 0.9);
              transform: translateX(2px);
            }
            50% {
              text-shadow:
                4px 4px 25px rgba(51, 255, 173, 0.8),
                -4px -4px 25px rgba(255, 51, 173, 0.8);
              transform: translateX(-2px);
            }
            75% {
              text-shadow:
                -5px 3px 10px rgba(51, 173, 255, 0.7),
                3px -3px 15px rgba(173, 51, 255, 0.7);
              transform: translateX(3px);
            }
            100% {
              text-shadow:
                3px 3px 20px rgba(173, 51, 255, 0.8),
                -3px -3px 20px rgba(51, 173, 255, 0.8);
              transform: translateX(0);
            }
          }
        `}</style>
      </div>
      <Footer />
    </DefaultPageWrapper>
  );
}
