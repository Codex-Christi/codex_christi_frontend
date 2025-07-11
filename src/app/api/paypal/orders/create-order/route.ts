// POST /api/paypal/orders/create-order
import { NextResponse } from 'next/server';
import {
  OrdersController,
  CheckoutPaymentIntent,
  OrderRequest,
  ItemCategory,
  Item,
} from '@paypal/paypal-server-sdk';
import { paypalClient } from '@/lib/paymentClients/paypalClient';
import { CreateOrderActionInterface } from '@/actions/shop/paypal/createOrderAction';
import { getOrderFinalDetails } from '@/actions/shop/checkout/getOrderFinalDetails';
import { PAYPAL_CURRENCY_CODES } from '@/datasets/shop_general/paypal_currency_specifics';
import { removeOrKeepDecimalPrecision } from '@/actions/merchize/getMerchizeTotalWithShipping';
import { randomUUID } from 'crypto';
import { format } from 'date-fns';

// Import the OrdersController from PayPal SDK
const orders = new OrdersController(paypalClient);

// Define the no shipping preference for PayPal
const no_Shipping_Prefernce = {
  experienceContext: {
    shippingPreference: 'NO_SHIPPING',
    brandName: 'Codex Christi',
  },
};

// Main POST endpoint receiver
export async function POST(req: Request) {
  // const { origin } = new URL(req.url); // ← Edge‑safe way to get your app's origin

  const body: CreateOrderActionInterface = await req.json();
  const { cart, customer, country, country_iso_3, initialCurrency } = body;
  try {
    if (!cart) {
      throw new Error('Missing cart');
    }
    if (!customer) {
      throw new Error('Missing customer');
    }
    // To check if paypal supports country's currency
    const payPalSupportsCurrency = PAYPAL_CURRENCY_CODES.includes(
      initialCurrency as (typeof PAYPAL_CURRENCY_CODES)[number]
    );

    // 🛡 Validate cart on server (don't trust client prices)
    const orderDetailsFromServer = await getOrderFinalDetails(
      cart,
      country_iso_3 ? country_iso_3 : 'USA',
      'merchize'
    );
    const { finalPricesWithShippingFee } = orderDetailsFromServer || {};
    const { currency, retailPriceTotalNum, shippingPriceNum, multiplier } =
      finalPricesWithShippingFee || {};

    // Extract the currency code, defaulting to 'USD' if not supported
    // or if the currency is not provided
    const currencyCode = currency && payPalSupportsCurrency ? currency : 'USD';

    // Adjust total and shipping prices and item prices based on currency
    const getAdjAmount = (num: number) =>
      payPalSupportsCurrency ? num : num / (multiplier ?? 1);

    // const adjTotal = getAdjAmount(retailPriceTotalNum!);
    const adjShipping = getAdjAmount(shippingPriceNum!);

    // Traverse, copy and format cart for context
    const cartItemsForPaypalBodyContext = cart.map(
      async ({ title, itemDetail, quantity }) =>
        ({
          name: title,
          unitAmount: {
            currencyCode: currency,
            value: String(
              await removeOrKeepDecimalPrecision(
                currency!,
                getAdjAmount(itemDetail.retail_price * (multiplier ?? 1))
              )
            ),
          },
          quantity: String(quantity),
          description: title,
          sku: itemDetail.sku,
          url: `https://codexchristi.shop/product/${itemDetail.product}`,
          category: ItemCategory.PhysicalGoods,
        }) as Item
    );

    if (retailPriceTotalNum && shippingPriceNum) {
      // Calculate total amount with shipping
      // const totalAmountWithShipping = Number(adjTotal) + Number(adjShipping); // TODO: calculate securely from SKU/DB

      // Resolve all cart items to ensure they are ready for the order payload
      const resolvedCartItems = await Promise.all(
        cartItemsForPaypalBodyContext
      );

      const itemsContextTotal = await removeOrKeepDecimalPrecision(
        currencyCode,
        resolvedCartItems.reduce(
          (accum, itm) =>
            accum + Number(itm.unitAmount.value) * Number(itm.quantity),
          0
        )
      );

      // Create the order payload
      // Note: `currencyCode` is used for the currency of the order
      // and `value` is the total amount for the order.
      const payload = {
        body: {
          intent: 'AUTHORIZE' as CheckoutPaymentIntent,
          purchaseUnits: [
            {
              description: `Codex Christi Shop Order for ${customer.name} on ${format(new Date(Date.now()), "EEEE d 'of' MMMM yyyy hh:mm a")}`,
              amount: {
                currencyCode,
                value: String(
                  await removeOrKeepDecimalPrecision(
                    currencyCode,
                    itemsContextTotal + adjShipping
                  )
                ),
                breakdown: {
                  itemTotal: {
                    currencyCode: currencyCode,
                    value: String(itemsContextTotal),
                  },
                  shipping: {
                    currencyCode,
                    value: String(
                      await removeOrKeepDecimalPrecision(
                        currencyCode,
                        adjShipping
                      )
                    ),
                  },
                },
              },
              shipping: {
                name: {
                  fullName: customer.name,
                },

                emailAddress: customer.email,
              },
              customId: randomUUID() ?? customer?.email ?? '',
              items: payPalSupportsCurrency
                ? // && !currencyCodesWithoutDecimalPrecision.includes(currencyCode)
                  resolvedCartItems
                : undefined,
              // Send items if paypal supports currency and currency has decimal precision
            },
          ],
          payer: {
            name: { givenName: customer.name },
            // address: billingAddress,
            address: { countryCode: country },
            emailAddress: customer.email,
          },
          paymentSource: {
            paypal: no_Shipping_Prefernce,
            card: {
              ...no_Shipping_Prefernce,
              attributes: {
                verification: {
                  method: 'SCA_WHEN_REQUIRED',
                },
              },
            },
            venmo: no_Shipping_Prefernce,
          },
        } as OrderRequest,
        prefer: 'return=representation',
      };

      // Order Creation time...
      const { body: resBody } = await orders.createOrder(payload);

      return NextResponse.json(resBody);
    } else {
      throw new Error('Invalid Price!! Aborting...');
    }
  } catch (err: unknown) {
    console.error('Create Order Error', err);

    return NextResponse.json(err);
  }
}
