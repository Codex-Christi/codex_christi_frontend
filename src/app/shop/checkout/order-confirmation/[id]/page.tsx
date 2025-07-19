'use client';
import { notFound } from 'next/navigation';
import { use } from 'react';
import { usePaymentConfirmationStore } from './store';

type PageProps = {
  params: Promise<{ id: string }>;
};

const OrderConfirmation = ({ params }: PageProps) => {
  const { id: capturedOrderID } = use(params);

  // Hooks
  const { pdfLink, serverData } = usePaymentConfirmationStore((state) => state);
  const { capturedOrderPaypalID } = serverData || {};

  if (capturedOrderID !== capturedOrderPaypalID) {
    return notFound();
  }

  return <h1>Success</h1>;
};

export default OrderConfirmation;
