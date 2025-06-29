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
import {
  currencyCodesWithoutDecimalPrecision,
  PAYPAL_CURRENCY_CODES,
} from '@/datasets/shop_general/paypal_currency_specifics';

const orders = new OrdersController(paypalClient);

const no_Shipping_Prefernce = {
  experienceContext: {
    shippingPreference: 'NO_SHIPPING',
  },
};

const isDevelopemnt = process.env.NODE_ENV === 'development';

// Main POST endpoint receiver
export async function POST(req: Request) {
  const { origin } = new URL(req.url); // ← Edge‑safe way to get your app's origin

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
      country_iso_3 ? (payPalSupportsCurrency ? country_iso_3 : 'USA') : 'USA',
      'merchize'
    );

    const { finalPricesWithShippingFee } = orderDetailsFromServer || {};
    const { currency, retailPriceTotalNum, shippingPriceNum, multiplier } =
      finalPricesWithShippingFee || {};

    // Traverse, copy and format cart for context
    const cartItemsForPaypalBodyContext = cart.map((cartItem) => {
      const { title, itemDetail, quantity } = cartItem;
      const { image, product: productID, sku, retail_price } = itemDetail;
      const itemConvertedPrice = retail_price * (multiplier ?? 1);

      return {
        name: title,
        unitAmount: {
          currencyCode: currency,
          value: String(
            currencyCodesWithoutDecimalPrecision.includes(currency ?? 'USD')
              ? Math.ceil(itemConvertedPrice)
              : itemConvertedPrice
          ),
        },
        quantity: String(quantity),
        description: title,
        sku,
        url: `https://codexchristi.shop/product/${productID}`,
        category: ItemCategory.PhysicalGoods,
        imageUrl: `${isDevelopemnt ? 'https://codexchristi.shop' : origin}/next-api/img-proxy?src=${encodeURIComponent(image ?? '')}`,
      } as Item;
    });

    if (retailPriceTotalNum && shippingPriceNum) {
      const totalAmount = currencyCodesWithoutDecimalPrecision.includes(
        currency ?? 'USD'
      )
        ? Math.ceil(retailPriceTotalNum + shippingPriceNum)
        : Math.ceil((retailPriceTotalNum + shippingPriceNum) * 100) / 100; // TODO: calculate securely from SKU/DB

      const currencyCode = currency ?? 'USD';

      const payload = {
        body: {
          intent: 'AUTHORIZE' as CheckoutPaymentIntent,
          purchaseUnits: [
            {
              amount: {
                currencyCode,
                value: totalAmount.toString(),
                breakdown: {
                  itemTotal: {
                    currencyCode: currencyCode,
                    value: String(retailPriceTotalNum),
                  },
                  shipping: { currencyCode, value: String(shippingPriceNum) },
                },
              },
              shipping: {
                name: {
                  fullName: customer.name,
                },
                emailAddress: customer.email,
              },
              customId: customer?.email ?? '',
              items: cartItemsForPaypalBodyContext,
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
