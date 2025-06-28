// POST /api/paypal/orders/create-order
import { NextResponse } from 'next/server';
import {
  OrdersController,
  CheckoutPaymentIntent,
} from '@paypal/paypal-server-sdk';
import { paypalClient } from '@/lib/paymentClients/paypalClient';
import { CreateOrderActionInterface } from '@/actions/shop/paypal/createOrderAction';
import { getOrderFinalDetails } from '@/actions/shop/checkout/getOrderFinalDetails';
import { currencyCodesWithoutDecimalPrecision } from '@/datasets/shop_general/paypal_currency_specifics';

const orders = new OrdersController(paypalClient);

export async function POST(req: Request) {
  const body: CreateOrderActionInterface = await req.json();
  const { cart, customer, country, country_iso_3 } = body;
  try {
    if (!cart) {
      throw new Error('Missing cart');
    }
    // if (!billingAddress && acceptBilling === true) {
    //   throw new Error('Missing billingAddress');
    // }
    if (!customer) {
      throw new Error('Missing customer');
    }

    // 🛡 Validate cart on server (don't trust client prices)
    const orderDetailsFromServer = await getOrderFinalDetails(
      cart,
      country_iso_3 ? country_iso_3 : 'USA',
      'merchize'
    );

    const { finalPricesWithShippingFee } = orderDetailsFromServer || {};
    const { currency, retailPriceTotalNum, shippingPriceNum } =
      finalPricesWithShippingFee || {};

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
              },
              customId: customer?.email ?? '',
            },
          ],
          payer: {
            name: { givenName: customer.name },
            // address: billingAddress,
            address: { countryCode: country },
            emailAddress: customer.email,
          },
        },
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
