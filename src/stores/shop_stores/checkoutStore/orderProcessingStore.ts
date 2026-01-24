'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { encrypt, decrypt } from '@/stores/shop_stores/cartStore';
import { createEncryptedStorage } from '.';

export type ProcessingStepKey = 'receiptUpload' | 'paymentSave' | 'orderPush';
export type ProcessingStepStatus = 'idle' | 'pending' | 'success' | 'error';

export type OrderProcessingStep = {
  key: ProcessingStepKey;
  label: string;
  description: string;
  status: ProcessingStepStatus;
  errorMessage?: string;
};

type FlowStatus = 'idle' | 'processing' | 'completed' | 'error';

const createDefaultSteps = (): OrderProcessingStep[] => [
  {
    key: 'receiptUpload',
    label: 'Secure Receipt Upload',
    description: 'Saving your receipt to our encrypted storage.',
    status: 'idle',
  },
  {
    key: 'paymentSave',
    label: 'Confirming Payment',
    description: 'Recording your transaction in our order system.',
    status: 'idle',
  },
  {
    key: 'orderPush',
    label: 'Sending Order to Fulfillment',
    description: 'Forwarding your items to our production partner.',
    status: 'idle',
  },
];

type ProcessingBaseFields = {
  orderId?: string;
  orderString?: string;
  customerName?: string;
  customerEmail?: string;
  orderCustomId?: string;
  pdfReceiptLink?: string;
  receiptFileName?: string;
  flowStatus: FlowStatus;
  modalVisible: boolean;
};

const baseState: ProcessingBaseFields = {
  orderId: undefined,
  orderString: undefined,
  customerName: undefined,
  customerEmail: undefined,
  orderCustomId: undefined,
  pdfReceiptLink: undefined,
  receiptFileName: undefined,
  flowStatus: 'idle',
  modalVisible: false,
};

interface OrderProcessingState extends ProcessingBaseFields {
  steps: OrderProcessingStep[];
  initializeProcessing: (payload: {
    orderId: string;
    orderString?: string;
    customerName?: string;
    customerEmail?: string;
  }) => void;
  setStepStatus: (key: ProcessingStepKey, status: ProcessingStepStatus, error?: string) => void;
  setReceiptDetails: (payload: { pdfReceiptLink?: string; receiptFileName?: string }) => void;
  setOrderCustomId: (orderCustomId?: string) => void;
  setFlowStatus: (status: FlowStatus) => void;
  setModalVisible: (visible: boolean) => void;
  resetProcessingState: () => void;
}

const initialState = (): OrderProcessingState => ({
  ...baseState,
  steps: createDefaultSteps(),
  initializeProcessing: () => {},
  setStepStatus: () => {},
  setReceiptDetails: () => {},
  setOrderCustomId: () => {},
  setFlowStatus: () => {},
  setModalVisible: () => {},
  resetProcessingState: () => {},
});

export const useOrderProcessingStore = create<OrderProcessingState>()(
  persist(
    (set) => ({
      ...initialState(),
      initializeProcessing: ({ orderId, orderString, customerEmail, customerName }) =>
        set(() => ({
          ...baseState,
          orderId,
          orderString,
          customerEmail,
          customerName,
          flowStatus: 'processing',
          modalVisible: true,
          steps: createDefaultSteps().map((step, index) => ({
            ...step,
            status: index === 0 ? 'pending' : 'idle',
          })),
        })),
      setStepStatus: (key, status, errorMessage) =>
        set((state) => ({
          steps: state.steps.map((step) =>
            step.key === key ? { ...step, status, errorMessage } : step,
          ),
        })),
      setReceiptDetails: ({ pdfReceiptLink, receiptFileName }) =>
        set((state) => ({
          ...state,
          pdfReceiptLink: pdfReceiptLink ?? state.pdfReceiptLink,
          receiptFileName: receiptFileName ?? state.receiptFileName,
        })),
      setOrderCustomId: (orderCustomId) => set(() => ({ orderCustomId })),
      setFlowStatus: (flowStatus) => set(() => ({ flowStatus })),
      setModalVisible: (modalVisible) => set(() => ({ modalVisible })),
      resetProcessingState: () =>
        set(() => ({
          ...baseState,
          steps: createDefaultSteps(),
        })),
    }),
    {
      name: 'order-processing-store',
      storage: createEncryptedStorage<OrderProcessingState>({ encrypt, decrypt }),
    },
  ),
);
