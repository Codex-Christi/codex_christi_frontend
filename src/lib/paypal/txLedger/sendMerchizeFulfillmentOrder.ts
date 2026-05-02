import 'server-only';

import { sendMerchizeOrderDetailsToBackend } from '@/actions/shop/checkout/createMerchizeOrder/sendMerchizeOrderDetailsToBackend';
import type { CartVariant } from '@/stores/shop_stores/cartStore';
import type { PaymentSavingActionProps } from '@/actions/shop/paypal/processAndUploadCompletedTx/savePaymentDataToBackend';
import { encryptForPostProcessingServerAction } from '@/lib/utils/shop/checkout/serverPostProcessingCrypto';

export type MerchizeFulfillmentOrderArgs = {
  cartSnapshot: CartVariant[];
  djangoPaymentSaveCustomId: string;
  identifier: string;
  currency: string;
  customerName: string;
  fulfillmentAddress: PaymentSavingActionProps['delivery_address'];
};

type OrderProcessingItem = {
  product_id: string;
  sku: string;
  merchize_sku: string;
  quantity: number;
  price: number;
  currency: string;
  image: string;
};

type MerchizeFulfillmentProcessPayload = {
  identifier: string;
  items: OrderProcessingItem[];
  first_name: string;
  last_name: string;
  address: string;
  address_2: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
};

type MerchizeFulfillmentProcessProps = {
  djangoPaymentSaveCustomId: string;
  payload: MerchizeFulfillmentProcessPayload;
};

function mapCartToProcessingItems(cart: CartVariant[], currency: string): OrderProcessingItem[] {
  return cart.map((item) => ({
    product_id: item.itemDetail.product ?? item.variantId,
    sku: item.itemDetail.sku_seller ?? '',
    merchize_sku: item.itemDetail.sku ?? item.variantId,
    quantity: item.quantity,
    price: item.itemDetail.retail_price,
    currency,
    image: item.itemDetail.image ?? item.itemDetail.image_uris?.[0] ?? '',
  }));
}

function assertProcessingItems(items: OrderProcessingItem[]) {
  for (const item of items) {
    if (!item.product_id) throw new Error('Missing product_id for fulfillment item');
    if (!item.merchize_sku) throw new Error('Missing merchize_sku for fulfillment item');
    if (!item.image) throw new Error('Missing image for fulfillment item');
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error('Invalid quantity for fulfillment item');
    }
    if (typeof item.price !== 'number' || item.price < 0) {
      throw new Error('Invalid price for fulfillment item');
    }
    if (!item.currency) throw new Error('Missing currency for fulfillment item');
  }
}

function splitCustomerName(fullName: string) {
  const [firstName = '', ...rest] = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    first_name: firstName,
    last_name: rest.join(' '),
  };
}

function buildFulfillmentPayload(
  args: MerchizeFulfillmentOrderArgs,
  items: OrderProcessingItem[],
): MerchizeFulfillmentProcessPayload {
  const { first_name, last_name } = splitCustomerName(args.customerName);
  const address = args.fulfillmentAddress;

  return {
    identifier: args.identifier,
    items,
    first_name,
    last_name,
    address: address?.shipping_address_line_1 ?? '',
    address_2: address?.shipping_address_line_2 ?? '',
    city: address?.shipping_city ?? '',
    state: address?.shipping_state ?? '',
    zip_code: address?.zip_code ?? '',
    country: address?.shipping_country ?? '',
  };
}

export async function sendMerchizeFulfillmentOrder(args: MerchizeFulfillmentOrderArgs) {
  const items = mapCartToProcessingItems(args.cartSnapshot, args.currency);
  assertProcessingItems(items);
  const requestPayload = buildFulfillmentPayload(args, items);

  const payload = {
    djangoPaymentSaveCustomId: args.djangoPaymentSaveCustomId,
    payload: requestPayload,
  } satisfies MerchizeFulfillmentProcessProps;

  const response = await sendMerchizeOrderDetailsToBackend(
    encryptForPostProcessingServerAction(JSON.stringify(payload)),
  );

  if (!response.ok) {
    throw new Error(response.error?.message ?? 'Fulfillment push failed');
  }

  return { ...response, requestPayload };
}
