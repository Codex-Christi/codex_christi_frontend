'use client';
import { notFound } from 'next/navigation';
import { use, useCallback, useState } from 'react';
import { useOrderConfirmationStore } from './store';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';
import { FaArrowLeft } from 'react-icons/fa6';
import { Button } from '@/components/UI/primitives/button';
import errorToast from '@/lib/error-toast';
import { useRouteChangeAware } from '@/lib/hooks/useRouteChangeAware';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';

type PageProps = {
  params: Promise<{ id: string }>;
};

const OrderConfirmation = ({ params }: PageProps) => {
  // const { id: capturedOrderID } = use(params);

  // Hooks
  const { paymentJSONData } = useOrderConfirmationStore((state) => state);
  const { pdfReceiptLink, receiptFileName } = paymentJSONData || {};
  const clearCart = useCartStore((store) => store.clearCart);
  const clearCheckoutStore = useShopCheckoutStore((store) => store.clearCheckout);
  useRouteChangeAware(() => {
    clearCart();
    clearCheckoutStore();
  });

  // States
  const [downloading, setDownloading] = useState(false);

  // Handlers
  const handleDownLoad = useCallback(async () => {
    try {
      if (!pdfReceiptLink) throw new Error('No Receipt Link generated');
      const response = await fetch(pdfReceiptLink);
      const blob = await response.blob(); // Convert the response to a Blob

      const downloadUrl = URL.createObjectURL(blob); // Create a temporary URL for the Blob

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${receiptFileName}.pdf`; // Set the desired receiptFileName for the download

      document.body.appendChild(link);
      link.click(); // Programmatically click the link to trigger the download
      document.body.removeChild(link); // Remove the link from the document

      URL.revokeObjectURL(downloadUrl); // Revoke the temporary URL to release memory
    } catch (err) {
      console.error('Error during download:', err);
      errorToast({
        header: `Error during download:`,
        message: `${typeof err === 'string' ? err : err instanceof Error ? err.message : JSON.stringify(err)}`,
      });
    } finally {
      setDownloading(false);
    }
  }, [receiptFileName, pdfReceiptLink]);

  // UseEffect for pathname change

  // Returned not-found page if the current zustand state doesn't hold the TX
  // if (capturedOrderID !== capturedOrderPaypalID) {
  //   return notFound();
  // }

  // Main JSX
  return (
    <div className='!text-white flex flex-col py-5 !font-inter !select-none'>
      <CustomShopLink
        href='/shop'
        className='py-2 px-4 ml-5 border max-w-max flex gap-3 items-center rounded-2xl font-semibold hover:border-[1.5px]'
      >
        <FaArrowLeft />
        <h2>Continue Shopping</h2>
      </CustomShopLink>

      <section
        className='bg-[rgba(243,243,243,0.078)] mx-auto mt-10 mb-20 w-full max-w-[490px] min-h-[445px] rounded-3xl 
        backdrop-blur-[30px] flex flex-col items-center py-10'
      >
        <h2 className='text-[1.1rem]'>Thank you for your purchase</h2>

        <h2 className='text-[1.275rem] font-[500] text-center my-8 px-2'>
          {/* Order #{capturedOrderPaypalID} has been confirmed */}
        </h2>

        <svg
          xmlns='http://www.w3.org/2000/svg'
          width='64'
          height='64'
          fill='none'
          viewBox='0 0 64 64'
        >
          <g fillRule='evenodd'>
            <path
              fill='#2576CE'
              d='M60.82 26.327A6.66 6.66 0 0 1 64 32.002a6.61 6.61 0 0 1-3.176 5.65l-.036.18a6.7 6.7 0 0 1 1.172 2.916 6.65 6.65 0 0 1-5.514 7.53l-.085.127a6.8 6.8 0 0 1-.027 3.156c-.886 3.529-4.457 5.682-7.987 4.836l-.107.072A6.6 6.6 0 0 1 47 59.387c-2.181 2.923-6.306 3.55-9.248 1.412l-.116.023a6.6 6.6 0 0 1-2.261 2.232 6.636 6.636 0 0 1-9.085-2.248l-.089-.018A6.57 6.57 0 0 1 23.241 62a6.65 6.65 0 0 1-7.538-5.577l-.056-.038a6.8 6.8 0 0 1-3.218-.012c-3.542-.902-5.698-4.497-4.826-8.04l-.042-.06a6.658 6.658 0 0 1-4.354-10.516l-.016-.08a6.6 6.6 0 0 1-2.255-2.276c-1.866-3.125-.854-7.183 2.255-9.08l.02-.1a6.57 6.57 0 0 1-1.208-2.953 6.65 6.65 0 0 1 5.552-7.535l.057-.085a6.8 6.8 0 0 1 .017-3.193c.901-3.55 4.476-5.706 8.015-4.842l.075-.051a6.6 6.6 0 0 1 1.243-2.96c2.186-2.927 6.32-3.538 9.277-1.4l.092-.019A6.6 6.6 0 0 1 28.6.937c3.129-1.869 7.193-.852 9.1 2.251l.085.017a6.56 6.56 0 0 1 2.962-1.215 6.65 6.65 0 0 1 7.538 5.57l.064.043a6.8 6.8 0 0 1 3.21.013c3.537.901 5.692 4.486 4.831 8.023l.055.082a6.6 6.6 0 0 1 2.941 1.242c2.924 2.183 3.55 6.308 1.41 9.25z'
            ></path>
            <path
              fill='#F3F3F3'
              d='M45.45 24.65a2 2 0 1 0-2.9-2.755L27.424 37.822l-5.974-6.29a2 2 0 0 0-2.9 2.754l7.424 7.818a2 2 0 0 0 2.9 0zM20 32.908l-1.45 1.377 2.9-2.754z'
            ></path>
          </g>
        </svg>

        <CustomShopLink
          href={`/shop/order-details/`}
          className='py-3 border border-[#2576CE] rounded-2xl w-full max-w-[400px] font-[500] text-[1.1rem] mx-auto 
          text-center mt-8 bg-[#2576CE] text-[#F3F3F3] transition'
        >
          View Order Details
        </CustomShopLink>

        <Button
          name='Download Receipt'
          onClick={handleDownLoad}
          className='!py-3 border rounded-2xl w-full max-w-[400px] font-[500] text-[1.1rem] mx-auto text-center mt-3
          hover:bg-white bg-transparent h-auto hover:text-black transition'
          disabled={downloading}
        >
          {downloading ? 'Downloading...' : 'Generate receipt'}
        </Button>
      </section>
    </div>
  );
};

export default OrderConfirmation;
