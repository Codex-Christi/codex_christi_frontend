import 'server-only';

import {
  sendMerchizeOrderDetailsToBackend,
  type MerchizeBackendOrderProps,
} from '@/actions/shop/checkout/createMerchizeOrder/sendMerchizeOrderDetailsToBackend';
import { encryptForPostProcessingServerAction } from '@/lib/utils/shop/checkout/serverPostProcessingCrypto';

export type MerchizeFulfillmentOrderArgs = {
  orderVariants: MerchizeBackendOrderProps['orderVariants'];
  deliveryAddress: MerchizeBackendOrderProps['orderRecipientInfo']['delivery_address'];
  customer: MerchizeBackendOrderProps['orderRecipientInfo']['customer'];
  countryIso2: string;
  orderCustomId: string;
};

// This keeps the runner readable while isolating the current Merchize-specific
// fulfillment payload shape in one place.
export async function sendMerchizeFulfillmentOrder(args: MerchizeFulfillmentOrderArgs) {
  const response = await sendMerchizeOrderDetailsToBackend(
    encryptForPostProcessingServerAction(
      JSON.stringify({
        orderVariants: args.orderVariants,
        orderRecipientInfo: {
          delivery_address: args.deliveryAddress,
          customer: args.customer,
        },
        country_iso2: args.countryIso2,
        order_custom_id: args.orderCustomId,
      } satisfies MerchizeBackendOrderProps),
    ),
  );

  if (!response.ok) {
    throw new Error(response.error?.message ?? 'Fulfillment push failed');
  }

  return response;
}
