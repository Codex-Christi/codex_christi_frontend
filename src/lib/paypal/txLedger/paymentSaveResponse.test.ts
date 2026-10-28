import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePaymentSaveResponse, InvalidPaymentSaveResponseError } from './paymentSaveResponse';

function response() {
  return {
    status: 201,
    success: true,
    message: 'Saved',
    data: {
      id: 'd73b4b97-3ec0-4163-8a34-55d649404f81',
      custom_id: 'django-payment-reference',
      recipient_email: 'customer@example.test',
      user: null,
      order_intent_order_id: 'ORD-1',
      captured_order_paypal_id: 'PAYPAL-1',
      payment_data: { extra: 'Retained, not exposed to history' },
    },
  };
}

test('validated success retains the Django namespace and unknown response fields', () => {
  const result = parsePaymentSaveResponse(response(), {
    recipientEmail: 'Customer@example.test',
    orderId: 'ORD-1',
    paypalOrderId: 'PAYPAL-1',
  });
  assert.equal(result.data.custom_id, 'django-payment-reference');
  assert.deepEqual(result.data.payment_data, response().data.payment_data);
});

test('business failure, missing IDs, malformed bodies and identity mismatches are rejected', () => {
  for (const value of [
    null,
    [],
    {},
    { ...response(), success: false },
    { ...response(), status: 400 },
    { ...response(), data: { ...response().data, id: 'not-a-uuid' } },
    { ...response(), data: { ...response().data, custom_id: ' ' } },
    {
      ...response(),
      data: {
        ...response().data,
        recipient_email: undefined,
        receipient_email: 'typo@example.test',
      },
    },
  ])
    assert.throws(() => parsePaymentSaveResponse(value), InvalidPaymentSaveResponseError);
  for (const expected of [
    { recipientEmail: 'other@example.test' },
    { paypalOrderId: 'OTHER' },
    { orderId: 'OTHER' },
  ])
    assert.throws(
      () => parsePaymentSaveResponse(response(), expected),
      InvalidPaymentSaveResponseError,
    );
});

test('the real payment-save action accepts only validated success and never retries failed POSTs', async (t) => {
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, {
    NEXT_PUBLIC_DJANGO_API_BASE_URL: 'https://django.example/api/v1',
    SHOP_CHECKOUT_SERVER_ACTIONS_POST_PROCESSING_CRYPTO_SECRET: 'payment-save-fixture-secret',
    SHOP_CHECKOUT_OTP_VERIFICATION_API_KEY: 'payment-save-signature-fixture',
  });
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  });
  const { encryptForPostProcessingServerAction } =
    await import('@/lib/utils/shop/checkout/serverPostProcessingCrypto');
  const { savePaymentDataToBackend } =
    await import('@/actions/shop/paypal/processAndUploadCompletedTx/savePaymentDataToBackend');
  const encrypted = encryptForPostProcessingServerAction(
    JSON.stringify({
      authData: {
        id: 'AUTH-1',
        purchaseUnits: [
          { customId: 'local-order-token', amount: { value: '35.00', currencyCode: 'USD' } },
        ],
      },
      capturedOrderPaypalID: 'PAYPAL-1',
      finalCapturedOrder: { id: 'PAYPAL-1' },
      customer: { email: 'customer@example.test', name: 'Customer' },
      ORD_string: 'ORD-1',
      pdfReceiptLink: 'https://payment-receipts.codexchristi.shop/paypal/fixture.pdf',
      receiptFileName: 'fixture',
    }),
    'payment-save',
  );
  for (const [payload, status, ok] of [
    [response(), 201, true],
    [{ ...response(), success: false }, 200, false],
    [{ ...response(), data: { ...response().data, custom_id: undefined } }, 201, false],
    [
      { ...response(), data: { ...response().data, captured_order_paypal_id: 'OTHER' } },
      201,
      false,
    ],
    [{ message: 'Duplicate payment' }, 409, false],
  ] as const) {
    let calls = 0;
    globalThis.fetch = async (input, init) => {
      calls++;
      assert.equal(String(input), 'https://django.example/api/v1/orders/order-payment');
      assert.equal(init?.method, 'POST');
      const body = JSON.parse(String(init?.body));
      assert.equal(body.paypal_payload.paymentJSONData.custom_id, 'local-order-token');
      return Response.json(payload, { status });
    };
    const result = await savePaymentDataToBackend(encrypted);
    assert.equal(result.ok, ok);
    assert.equal(calls, 1);
    if (!ok) assert.equal('data' in result, false);
  }
  globalThis.fetch = async () => new Response('<html>not JSON</html>', { status: 200 });
  assert.equal((await savePaymentDataToBackend(encrypted)).ok, false);

  const { sendMerchizeOrderDetailsToBackend } =
    await import('@/actions/shop/checkout/createMerchizeOrder/sendMerchizeOrderDetailsToBackend');
  globalThis.fetch = async (input) => {
    assert.equal(
      String(input),
      'https://django.example/api/v1/orders/process/payment%2Freference%3Frevision%3D1',
    );
    return Response.json({
      status: 201,
      success: true,
      data: { processing_status: 'completed', error_message: null },
    });
  };
  const processing = encryptForPostProcessingServerAction(
    JSON.stringify({
      djangoPaymentSaveCustomId: 'payment/reference?revision=1',
      payload: { identifier: 'fixture', items: [] },
    }),
    'fulfillment',
  );
  assert.equal((await sendMerchizeOrderDetailsToBackend(processing)).ok, true);
});
