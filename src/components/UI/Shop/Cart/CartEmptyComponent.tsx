import Link from 'next/link';
import Image from 'next/image';
import CartImage from '@/assets/img/cart-image.png';

export const CartEmptyComponent = () => {
  return (
    <>
      <div className='w-32 h-auto mx-auto'>
        <Image src={CartImage} alt='' />
      </div>

      <div className='space-y-2 text-center'>
        <h2 className='font-semibold'>Your cart is empty!</h2>

        <p>Discover the best deals here</p>

        <Link
          className='text-center bg-[#0085FF] px-4 py-3 rounded-lg text-white font-extrabold inline-flex items-center gap-4'
          href='/shop'
        >
          START SHOPPING
          <svg width='6' height='10' viewBox='0 0 6 10' fill='none'>
            <path
              d='M7.37392e-06 8.83806C-0.000810145 9.067 0.066366 9.29103 0.19302 9.48175C0.319674 9.67247 0.500102 9.82129 0.711433 9.90934C0.922765 9.9974 1.15548 10.0207 1.38009 9.97636C1.60469 9.932 1.81106 9.82195 1.97305 9.66016L5.6612 5.9679C5.7691 5.86003 5.85454 5.73182 5.91257 5.59071C5.97061 5.4496 6.00008 5.29838 5.99929 5.1458C5.99929 5.13244 5.99929 5.12011 5.99929 5.10778C6.00485 4.94976 5.97779 4.79229 5.9198 4.64518C5.86181 4.49808 5.77413 4.36451 5.66223 4.2528L1.97202 0.569783C1.75343 0.361919 1.46226 0.24772 1.16064 0.251559C0.859026 0.255397 0.570854 0.37697 0.357628 0.59033C0.144402 0.80369 0.0230107 1.09194 0.0193616 1.39356C0.0157126 1.69518 0.130095 1.98628 0.338096 2.20474L3.24628 5.11292L0.338096 8.0211C0.230808 8.12837 0.145723 8.25574 0.0877098 8.39592C0.0296967 8.5361 -0.000105819 8.68635 7.37392e-06 8.83806Z'
              fill='white'
            />
          </svg>
        </Link>
      </div>
    </>
  );
};
