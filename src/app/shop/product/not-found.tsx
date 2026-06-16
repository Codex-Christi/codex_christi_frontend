import Image from 'next/image';
import NotFoundImage from '@/assets/img/shop-not-found.png';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className='!relative py-12 flex flex-col place-content-center gap-32 min-h-dvh w-full bg-transparent !select-none'>
      <div className='mx-auto text-center grid gap-2'>
        <div className='w-[200px] md:w-[350px] md:h-[200px]'>
          <Image
            className='size-full'
            src={NotFoundImage}
            alt='Product not Found!'
          />
        </div>

        <div className='text-center'>
          <p>...ooops</p>

          <h1 className='text-lg'>Product not Found!</h1>
        </div>
      </div>

      <div className='product-not-found-link flex justify-center'>
        <Link
          className=' border-[#0085FF] text-white bg-[#0085FF] hover:bg-[#0085FF]/70 rounded-xl 
          hover:text-white font-ocr !font-bold px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base'
          href='/'
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}
