import { cache } from 'react';
import { CompletedTxInterface } from '.';

export const postOrderTOBackend = cache(async (paymentAndOrderData: CompletedTxInterface) => {});
