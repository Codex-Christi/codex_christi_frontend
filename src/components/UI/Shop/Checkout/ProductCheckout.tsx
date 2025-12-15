'use client';

import dynamic from 'next/dynamic';
import { createContext, useEffect, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem } from '@/components/UI/primitives/accordion';
import { ServerOrderDetailsComponent } from './ServerOrderDetailsComponent';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';

// Dynamic Imports
const CheckoutPageOrderSummary = dynamic(() =>
  import('./CheckoutPageOrderSummary').then((comp) => comp.default),
);
const PaymentSection = dynamic(() => import('./PaymentSection').then((comp) => comp.default));
const BasicCheckoutInfo = dynamic(() =>
  import('./UserCheckoutSummary/BasicCheckoutInfo').then((comp) => comp.BasicCheckoutInfo),
);

export const CheckoutAccordionContext = createContext<{
  handleOpenItem: (itemValue: 'basic-checkout-info' | 'payment-section') => void;
  handleCloseAccordion: () => void;
}>({
  handleCloseAccordion: () => {},
  handleOpenItem: () => {},
});

// Main Component
const CheckoutPage = () => {
  const [openItem, setOpenItem] = useState('basic-checkout-info'); // State to hold the value of the open item (string for single type)

  // useEffects
  // Manually rehydrate the useShopCheckoutStore
  useEffect(() => {
    useShopCheckoutStore.persist.rehydrate();
  }, []);

  const handleOpenItem = (itemValue: 'basic-checkout-info' | 'payment-section') => {
    setOpenItem(itemValue); // Update the state to open the desired item
  };

  const handleCloseAccordion = () => {
    setOpenItem(''); // Update the state to close the accordion
  };

  // JSX
  return (
    <ServerOrderDetailsComponent>
      <CheckoutAccordionContext.Provider value={{ handleCloseAccordion, handleOpenItem }}>
        <div className='grid grid-cols-1 gap-8 items-start px-2 py-12 md:px-[20px] lg:px-[24px] lg:grid-cols-12'>
          <Accordion
            className='bg-[#4C3D3D3D] backdrop-blur-[10px] pt-10 !px-2 rounded-[10px] md:p-10 space-y-8 lg:col-span-7'
            type='single'
            value={openItem}
            onValueChange={setOpenItem}
          >
            {/* User Checkout Info Section */}
            <AccordionItem value='basic-checkout-info' className='border-none px-4'>
              {/* Note: AccordionTrigger is not needed if you only want programmable control */}
              <AccordionContent className='w-full'>
                <BasicCheckoutInfo />
              </AccordionContent>
            </AccordionItem>

            {/* Payment details section */}
            <AccordionItem value='payment-section' className='border-none px-4'>
              {/* Note: AccordionTrigger is not needed if you only want programmable control */}
              <AccordionContent>
                <PaymentSection />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Order Summary, on it's own */}
          <CheckoutPageOrderSummary />
        </div>
      </CheckoutAccordionContext.Provider>
    </ServerOrderDetailsComponent>
  );
};

export default CheckoutPage;
