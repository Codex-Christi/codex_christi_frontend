import Footer from '@/components/UI/general/Footer';
import { getMainSiteUrl } from '@/lib/siteBaseUrls';

const rainSymbols = ['0', '1', 'Ξ', '╳', '▲', '█'];
const matrixRain = Array.from({ length: 42 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  symbol: rainSymbols[index % rainSymbols.length],
  duration: `${2 + (index % 4) * 0.75}s`,
  delay: `${(index % 7) * -0.35}s`,
}));

export default function NotFound() {
  return (
    <>
      <div
        className={`relative flex flex-col items-center justify-center w-full min-h-[82vh] bg-black text-white
       !select-none text-center overflow-hidden px-4`}
      >
        <div className='absolute inset-0 overflow-hidden pointer-events-none'>
          {matrixRain.map((drop) => (
            <div
              key={drop.id}
              className='cc-404-matrix-drop absolute text-neon-green opacity-70 font-ocr'
              style={{
                left: drop.left,
                fontSize: '1rem',
                transform: 'rotate(-20deg)',
                animationDuration: drop.duration,
                animationDelay: drop.delay,
              }}
            >
              {drop.symbol}
            </div>
          ))}
        </div>

        <h1 className='text-7xl sm:text-9xl font-extrabold text-neon-purple cc-404-glitch cc-404-fade-in font-ocr leading-tight'>
          404
        </h1>

        <p className='text-lg sm:text-2xl text-gray-400 mt-4 cc-404-glitch cc-404-fade-in-delayed font-ocr'>
          You’ve entered the void. This page doesn’t exist.
        </p>

        <div
          className='cc-404-cyber-orb absolute top-20 sm:top-24 left-1/2 bg-neon-purple rounded-full'
          style={{
            width: '60px',
            height: '60px',
            boxShadow: '0 0 15px rgba(173, 51, 255, 0.8)',
          }}
        />

        <div className='mt-6 cc-404-fade-in-button'>
          <a
            href={getMainSiteUrl('/')}
            className='px-6 py-3 text-white text-lg font-semibold bg-neon-blue rounded-lg shadow-neon hover:shadow-neon-glow transition-all font-ocr'
          >
            Return to Reality
          </a>
        </div>
      </div>
      <Footer />
    </>
  );
}
