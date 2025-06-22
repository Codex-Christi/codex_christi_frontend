import Image from 'next/image';
import ProductImage from '@/assets/img/t-shirt-2.png';
import { useEffect, useState } from 'react';
import { getOrderFinalDetails } from '@/actions/shop/checkout/getOrderFinalDetails';
import { useCartStore } from '@/stores/shop_stores/cartStore';

const OrderSummary = () => {
  const cart = useCartStore((store) => store.variants);

  const [serverOrderDetails, setServerOrderDetails] = useState<Awaited<
    ReturnType<typeof getOrderFinalDetails>
  > | null>(null);

  useEffect(() => {
    const func = async () => {
      const orderDetailsFromServer = await getOrderFinalDetails(
        cart,
        'DEU',
        'merchize'
      );

      setServerOrderDetails(orderDetailsFromServer);
    };

    func();
  }, [cart]);

  // Destructuring
  const { retailPriceTotalNum, shippingPriceNum, currency, currency_symbol } =
    serverOrderDetails?.finalPricesWithShippingFee ?? {};

  // Main JSX
  return (
    <div className='bg-[#4C3D3D3D] backdrop-blur-[10px] p-4 rounded-[10px] md:p-10 space-y-8 lg:col-span-5'>
      <h2 className='border-b border-white pb-1 text-xl font-bold'>
        Order Summary
      </h2>

      <div className='grid gap-12'>
        <div className='flex items-start justify-between gap-4'>
          <div className='flex items-center gap-4'>
            <Image
              className='rounded-[10px] w-10 h-12 object-cover object-center'
              src={ProductImage}
              alt='Ton blue hoodie '
            />

            <div className='text-[#F3F3F3] text-sm space-y-0.5'>
              <p className='font-semibold'>Ton blue hoodie</p>

              <p className='text-[#F3F3F3]/70'>Size: M</p>

              <p className='text-[#F3F3F3]/70'>Colour: Ton Blue</p>
            </div>
          </div>

          <div className='text-[#F3F3F3] space-y-0.5'>
            <p className='font-semibold'>N34,700</p>

            <p className='text-right text-[#F3F3F3]/70'>Qty: 3</p>
          </div>
        </div>

        <div className='flex items-start gap-3'>
          <input
            className='input w-full !px-4 !py-2.5 !rounded-[10px] !border-[#F3F3F399]'
            type='text'
            placeholder='Coupon or discount code'
            id='coupon'
            name='coupon'
          />

          <button className='btn border-[#F3F3F366] text-[#F3F3F3] bg-[#F3F3F366] hover:bg-[#F3F3F366]/30 hover:text-[#F3F3F3] !font-bold px-4 sm:px-6 !py-2.5 rounded-[10px] text-sm sm:text-base text-center shrink-0'>
            Apply
          </button>
        </div>

        {/* Order Details Final */}
        {serverOrderDetails?.finalPricesWithShippingFee && (
          <div className='space-y-2'>
            <p className='flex items-center justify-between gap-4 font-semibold'>
              <span>Subtotal</span>

              <span>{`${currency_symbol} ${retailPriceTotalNum}`}</span>
            </p>

            <p className='flex items-center justify-between gap-4 font-semibold'>
              <span>Shipping/Delivery Fee</span>

              <span>{`${currency_symbol} ${shippingPriceNum}`}</span>
            </p>
          </div>
        )}

        <p className='flex items-center justify-between gap-4 font-semibold'>
          <span>Total</span>
          <span className='text-lg'>{`${(retailPriceTotalNum ?? 0) + (shippingPriceNum ?? 0)} ${currency}`}</span>
        </p>
      </div>
    </div>
  );
};

export default OrderSummary;
