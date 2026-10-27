import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import PDFDocument from 'pdfkit';
import type { OrderResponseBody } from '@paypal/paypal-js';
import { finalizeCanonicalOrderSnapshot } from '@/lib/paypal/orderSnapshot/canonicalize';
import { createPaypalShopInvoicePDF } from './createShopInvoicePDF';

const customer = { name: 'Receipt Test', email: 'receipt@example.test' };

function order(countryField = 'country_code'): OrderResponseBody {
  return {
    id: 'SANDBOX-ORDER',
    status: 'COMPLETED',
    create_time: '2026-10-27T12:00:00.000Z',
    purchase_units: [{ shipping: { address: { [countryField]: 'US' } } }],
  } as unknown as OrderResponseBody;
}

function snapshot(titles: string[]) {
  const currency = 'USD';
  const subtotal = `${titles.length * 10}.00`;
  return finalizeCanonicalOrderSnapshot({
    version: 'shop-alpha-order-v1',
    hashAlgorithm: 'sha256',
    createdAt: '2026-10-27T12:00:00.000Z',
    destination: { countryIso3: 'USA', region: 'CA' },
    currency,
    lines: titles.map((title, index) => ({
      lineId: `product:variant-${index}`,
      productId: 'product',
      variantId: `variant-${index}`,
      supplierProductId: 'supplier-product',
      supplierVariantId: `supplier-variant-${index}`,
      sku: `SKU-${index}`,
      sellerSku: null,
      title,
      selectedOptions: [],
      imageUrl: 'https://example.test/product.jpg',
      quantity: 1,
      unitAmount: { currency, value: '10.00' },
      lineAmount: { currency, value: '10.00' },
      shippingAllocation: { currency, value: index === 0 ? '5.00' : '0.00' },
    })),
    subtotal: { currency, value: subtotal },
    shipping: { currency, value: '5.00' },
    total: { currency, value: `${titles.length * 10 + 5}.00` },
  });
}

// Observe actual PDFKit drawing geometry without replacing its rendering or measuring behavior.
async function render(authData: OrderResponseBody, titles: string[], checkoutCustomer = customer) {
  const draws: Array<{ text: string; x: number; y: number; height: number; page: number }> = [];
  const pages = new Map<PDFKit.PDFPage, number>();
  const original = PDFDocument.prototype.text as (
    this: PDFKit.PDFDocument,
    text: string,
    ...args: unknown[]
  ) => PDFKit.PDFDocument;
  const spy = mock.method(
    PDFDocument.prototype,
    'text',
    function (this: PDFKit.PDFDocument, text: string, ...args: unknown[]) {
      if (!pages.has(this.page)) pages.set(this.page, pages.size);
      const positioned = typeof args[0] === 'number';
      const options = (positioned ? args[2] : args[0]) as PDFKit.Mixins.TextOptions | undefined;
      draws.push({
        text,
        x: positioned ? (args[0] as number) : this.x,
        y: positioned ? (args[1] as number) : this.y,
        height: this.heightOfString(text, options),
        page: pages.get(this.page)!,
      });
      return original.call(this, text, ...args);
    },
  );
  try {
    const pdf = await createPaypalShopInvoicePDF(
      authData,
      undefined,
      undefined,
      snapshot(titles),
      checkoutCustomer,
    );
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.match(pdf.subarray(-20).toString(), /%%EOF/);
    return { draws, pageCount: pages.size };
  } finally {
    spy.mock.restore();
  }
}

test('card receipts include the checkout customer and both PayPal country formats', async () => {
  for (const countryField of ['country_code', 'countryCode']) {
    const { draws } = await render(order(countryField), ['Short title']);
    const text = draws.map((draw) => draw.text);
    assert.ok(text.includes(customer.name));
    assert.ok(text.includes(customer.email));
    assert.ok(text.includes('US'));
    assert.ok(text.includes('15.00 USD'));
  }
});

test('wrapped product titles leave enough room before the following row', async () => {
  const titles = [
    'A long product title with enough detail to wrap across several lines in the receipt',
    'Following product',
  ];
  const { draws } = await render(order(), titles);
  const first = draws.find((draw) => draw.text === titles[0])!;
  const next = draws.find((draw) => draw.text === titles[1])!;
  assert.equal(first.page, next.page);
  assert.ok(next.y > first.y + first.height, 'the next item must start below the wrapped title');
});

test('wrapped contact details stay separated and above the product table', async () => {
  const longCustomer = {
    name: 'Christopher Alexander Montgomery Saint James Wellington',
    email: 'christopher.alexander.montgomery.saint.james.wellington@example.test',
  };
  const authData = {
    ...order(),
    purchase_units: [
      {
        shipping: {
          name: { full_name: longCustomer.name },
          address: {
            address_line_1:
              '123 Wellington Avenue, Montgomery Residential Estate near the central park',
            address_line_2: 'Building Alexandra, third floor, apartment twelve',
            admin_area_2: 'Saint Christopher Metropolitan District',
            admin_area_1: 'California',
            postal_code: '95131',
            country_code: 'US',
          },
        },
      },
    ],
  } as unknown as OrderResponseBody;
  const { draws } = await render(authData, ['Following product'], longCustomer);
  const table = draws.find((draw) => draw.text === 'Description')!;
  const contactRows = draws.filter((draw) => draw.y >= 150 && draw.y < table.y);

  assert.ok(contactRows.some((draw) => draw.text === longCustomer.email && draw.height > 15));
  assert.ok(table.y > 270, 'the table must move down when contact details wrap');
  for (const x of [50, 400]) {
    const column = contactRows.filter((draw) => draw.x === x);
    assert.ok(
      column.some((draw) => draw.height > 15),
      'each contact column must exercise wrapping',
    );
    for (let index = 1; index < column.length; index++) {
      const previous = column[index - 1];
      assert.ok(column[index].y > previous.y + previous.height, 'contact rows must not overlap');
    }
    for (const draw of column) {
      assert.equal(draw.page, table.page);
      assert.ok(draw.y + draw.height < table.y, 'the table must start below every contact row');
    }
  }
});

test('long carts repeat headings, preserve every item and keep content above each footer', async () => {
  const titles = Array.from({ length: 40 }, (_, index) => `Product ${index + 1}`);
  const { draws, pageCount } = await render(order(), titles);
  assert.ok(pageCount > 1);
  for (const title of titles) {
    assert.equal(draws.filter((draw) => draw.text === title).length, 1);
  }
  for (let page = 0; page < pageCount; page++) {
    const pageDraws = draws.filter((draw) => draw.page === page);
    assert.equal(pageDraws.filter((draw) => draw.text === 'Description').length, 1);
    const footer = pageDraws.find((draw) => draw.text === 'Thank you for your purchase!')!;
    for (const draw of pageDraws.filter((draw) => titles.includes(draw.text))) {
      assert.ok(draw.y + draw.height < footer.y, 'items must not overlap the footer');
    }
  }
  assert.ok(draws.some((draw) => draw.text === '405.00 USD'));
});
