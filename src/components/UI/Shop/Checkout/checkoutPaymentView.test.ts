import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

test('the rendered review lists every option and clears payment consent when reviewed facts change', async () => {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'tsx',
      contents: `
        import assert from 'node:assert/strict';
        import { JSDOM } from 'jsdom';
        import React, { act } from 'react';
        import { createRoot } from 'react-dom/client';
        import { CheckoutPaymentView, CheckoutPaymentReviewContext } from './src/components/UI/Shop/Checkout/PaymentSection';
        import OriginalCheckoutReview from './src/components/UI/Shop/Checkout/OriginalCheckoutReview';

        async function verifyRenderedReview() {
        globalThis.fetch = async () => assert.fail('Rendered review tests cannot call a provider');
        const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'https://checkout.example.test' });
        globalThis.window = dom.window;
        globalThis.document = dom.window.document;
        globalThis.HTMLElement = dom.window.HTMLElement;
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        const container = document.getElementById('app');
        const root = createRoot(container);
        const customer = { first_name: 'Example', last_name: 'Customer', email: 'customer@example.test', delivery_address: { shipping_address_line_1: '12 Example Street', shipping_address_line_2: 'Apartment 4', shipping_city: 'Los Angeles', shipping_state: 'CA', shipping_country: 'USA', zip_code: '90001' } };
        const item = { productId: 'product-a', variantId: 'variant-a', title: 'Verified hoodie', selectedOptions: [{ name: 'Product', value: 'Hoodie Midweight' }, { name: 'Size', value: 'M' }, { name: 'Color', value: 'Royal Blue' }, { name: 'Label', value: 'Grace design' }], quantity: 2, unitAmount: '20.00', lineAmount: '40.00' };
        const prices = { currency: 'USD', multiplier: 1, retailPriceTotalNum: 40, shippingPriceNum: 10, totalPriceNum: 50, linePricesByVariantId: { 'variant-a': { unitPriceNum: 20, lineTotalNum: 40 } } };
        const details = { finalPricesWithShippingFee: prices, countrySupport: { country: { country_name: 'United States' } }, reviewLines: [item], reviewItemsHash: 'trusted-hash' };
        const cart = [{ variantId: 'variant-a', quantity: 2, title: 'Stale cart title', slug: 'hoodie', itemDetail: { product: 'product-a', options: [] } }];
        const PaymentProbe = () => {
          const context = React.useContext(CheckoutPaymentReviewContext);
          return <><button data-payment-control data-items-hash={context.review?.itemsHash ?? ''}>Sandbox payment</button><button data-payment-failure onClick={() => context.onPaymentError('Review changed', 'CHECKOUT_REVIEW_CHANGED')}>Report setup failure</button></>;
        };
        const base = { cart, checkout: customer, details, canContinue: true, onEdit() {}, onRefreshQuote() {}, onVerificationRequired() {}, renderPayment: () => <PaymentProbe /> };
        const render = async (props = {}) => { await act(async () => root.render(<CheckoutPaymentView {...base} {...props} />)); };
        const acknowledge = async () => { await act(async () => container.querySelector('input[type="checkbox"]').click()); };
        const choosePayment = async () => { await act(async () => container.querySelector('input[value="card"]').click()); };
        await render();
        const text = container.textContent;
        for (const fact of ['Verified hoodie', 'Product:', 'Hoodie Midweight', 'Size:', 'M', 'Color:', 'Royal Blue', 'Label:', 'Grace design', 'Quantity: 2', '12 Example Street', 'Apartment 4', 'customer@example.test', '50.00']) assert.ok(text.includes(fact), fact);
        assert.ok(!text.includes('Stale cart title'));
        const items = container.querySelector('[aria-labelledby="checkout-items-to-review"]');
        assert.ok(items && !items.hidden && !items.closest('[hidden]'));
        assert.ok(items.compareDocumentPosition(container.querySelector('input[type="checkbox"]')) & window.Node.DOCUMENT_POSITION_FOLLOWING);
        await choosePayment();
        assert.equal(container.querySelector('[data-payment-control]'), null);
        await acknowledge();
        assert.ok(container.querySelector('[data-payment-control]'));
        assert.equal(container.querySelector('[data-payment-control]').getAttribute('data-items-hash'), 'trusted-hash');

        for (const change of [
          { title: 'A new design title' },
          { productId: 'different-product' },
          { selectedOptions: [{ name: 'Size', value: 'L' }, { name: 'Design', value: 'Different artwork' }] },
          { quantity: 3 },
        ]) {
          await render({ details: { ...details, reviewLines: [{ ...item, ...change }] } });
          assert.equal(container.querySelector('input[type="checkbox"]').checked, false);
          assert.equal(container.querySelector('[data-payment-control]'), null);
          await acknowledge();
          assert.ok(container.querySelector('[data-payment-control]'));
        }
        await render();
        await acknowledge();
        await render({ details: { ...details, reviewLines: [{ ...item, selectedOptions: [...item.selectedOptions].reverse() }] } });
        assert.equal(container.querySelector('input[type="checkbox"]').checked, true);
        assert.ok(container.querySelector('[data-payment-control]'));
        await act(async () => container.querySelector('[data-payment-failure]').click());
        assert.equal(container.querySelector('input[type="checkbox"]').checked, false);
        assert.equal(container.querySelector('[data-payment-control]'), null);
        await acknowledge();
        assert.ok(container.querySelector('[data-payment-control]'));
        await render({ canContinue: false });
        assert.equal(container.querySelector('input[type="checkbox"]').disabled, true);
        assert.equal(container.querySelector('[data-payment-control]'), null);
        await render({ details: { ...details, reviewLines: [] } });
        assert.equal(container.querySelector('input[type="checkbox"]').disabled, true);
        assert.equal(container.querySelector('[data-payment-control]'), null);
        await render({ details: { ...details, reviewItemsHash: '' } });
        assert.equal(container.querySelector('input[type="checkbox"]').disabled, true);
        assert.equal(container.querySelector('[data-payment-control]'), null);

        const original = { orderToken: 'saved-order', paypalOrderId: 'saved-paypal-order', reviewKey: 'saved-review', customer: { name: 'Saved Customer', email: 'saved@example.test' }, deliveryAddress: customer.delivery_address, countryCode: 'US', quote: { currency: 'USD', subtotal: 40, shipping: 10, total: 50 }, lines: [{ id: 'saved-line', title: 'Saved hoodie', image: null, quantity: 2, options: 'Size: M, Label: Saved design', unitAmount: '20.00', lineAmount: '40.00' }] };
        await act(async () => root.render(<OriginalCheckoutReview checkout={original} onBack={() => {}} renderPayment={base.renderPayment} />));
        await choosePayment();
        await acknowledge();
        assert.ok(container.querySelector('[data-payment-control]'));
        await act(async () => root.render(<OriginalCheckoutReview checkout={{ ...original, reviewKey: 'changed-review' }} onBack={() => {}} renderPayment={base.renderPayment} />));
        assert.equal(container.querySelector('input[type="checkbox"]').checked, false);
        assert.equal(container.querySelector('[data-payment-control]'), null);
        await act(async () => root.unmount());
        dom.window.close();
        console.log('rendered checkout review passed');
        }
        verifyRenderedReview().catch((error) => { console.error(error); process.exitCode = 1; });
      `,
    },
    write: false,
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
    plugins: [
      {
        name: 'checkout-ui-boundaries',
        setup(builder) {
          builder.onResolve({ filter: /^(react(?:\/.*)?|react-dom(?:\/.*)?)$/ }, (args) => ({
            path: args.path,
            external: true,
          }));
          builder.onResolve({ filter: /^next\/image$/ }, () => ({
            path: 'image',
            namespace: 'ui-boundary',
          }));
          builder.onResolve({ filter: /^next\/dynamic$/ }, () => ({
            path: 'dynamic',
            namespace: 'ui-boundary',
          }));
          builder.onResolve({ filter: /Paypal\/PayPalMainCheckoutComponent$/ }, () => ({
            path: 'payment-provider',
            namespace: 'ui-boundary',
          }));
          builder.onResolve({ filter: /paypal\.png$/ }, () => ({
            path: 'asset',
            namespace: 'ui-boundary',
          }));
          builder.onResolve({ filter: /HelperComponents\/CustomShopLink$/ }, () => ({
            path: 'link',
            namespace: 'ui-boundary',
          }));
          builder.onResolve({ filter: /^\.\/ProductCheckout$/ }, () => ({
            path: 'checkout-context',
            namespace: 'ui-boundary',
          }));
          builder.onResolve({ filter: /^\.\/ServerOrderDetailsComponent$/ }, () => ({
            path: 'details-context',
            namespace: 'ui-boundary',
          }));
          builder.onResolve({ filter: /^@\/stores\/shop_stores\// }, (args) => ({
            path: args.path,
            namespace: 'store-boundary',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'ui-boundary' }, ({ path }) => ({
            loader: 'jsx',
            contents:
              path === 'image'
                ? "import React from 'react'; export default function Image({src, ...props}) {return <img src={src} {...props} />;}"
                : path === 'link'
                  ? "import React from 'react'; export default function Link(props) {return <a {...props} />;}"
                  : path === 'dynamic' || path === 'payment-provider'
                    ? 'export default () => () => null;'
                    : path === 'checkout-context'
                      ? "import React from 'react'; export const CheckoutAccordionContext = React.createContext({});"
                      : path === 'details-context'
                        ? "import React from 'react'; export const ServerOrderDetailsContext = React.createContext(null);"
                        : "export default '/paypal.png';",
          }));
          builder.onLoad({ filter: /.*/, namespace: 'store-boundary' }, () => ({
            contents:
              'export const useCartStore = () => null; export const useShopCheckoutStore = () => null; export const useDjangoOrderIntentStore = () => null; export const usePayPalIntentStore = () => null;',
          }));
        },
      },
    ],
  });
  // Use client React in a fresh process; the checkout test suite itself uses react-server.
  const run = spawnSync(process.execPath, [], {
    cwd: process.cwd(),
    input: result.outputFiles[0].text,
    encoding: 'utf8',
    timeout: 15_000,
    maxBuffer: 100_000,
  });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /rendered checkout review passed/);
});
