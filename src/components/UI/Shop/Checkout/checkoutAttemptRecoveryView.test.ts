import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { build } from 'esbuild';

test('the original purchase action returns focus to the saved review without reloading or clearing consent', async () => {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'tsx',
      contents: `
        import assert from 'node:assert/strict';
        import { JSDOM } from 'jsdom';
        import React, { act } from 'react';

        async function verifyScenario(reducedMotion) {
          globalThis.fetch = async () => assert.fail('Recovery view tests cannot contact checkout services');
          const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'https://checkout.example.test' });
          globalThis.window = dom.window;
          globalThis.document = dom.window.document;
          globalThis.HTMLElement = dom.window.HTMLElement;
          globalThis.IS_REACT_ACT_ENVIRONMENT = true;
          window.matchMedia = query => {
            assert.equal(query, '(prefers-reduced-motion: reduce)');
            return { matches: reducedMotion };
          };
          const scrolls = [];
          window.HTMLElement.prototype.scrollIntoView = function (options) {
            scrolls.push({ element: this, options });
          };
          const deferred = () => {
            let resolve;
            let reject;
            const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
            return { promise, resolve, reject };
          };
          const checkout = {
            orderToken: 'fixture-order', paypalOrderId: 'fixture-paypal', reviewKey: 'fixture-review',
            customer: { name: 'Example Customer', email: 'customer@example.test' },
            deliveryAddress: { shipping_address_line_1: '12 Example Street', shipping_address_line_2: '', shipping_city: 'Los Angeles', shipping_state: 'CA', shipping_country: 'USA', zip_code: '90001' },
            countryCode: 'US', quote: { currency: 'USD', subtotal: 28, shipping: 6, total: 34 },
            lines: [{ id: 'fixture-line', title: 'Saved hoodie', image: null, quantity: 1, options: 'Size: M', unitAmount: '28.00', lineAmount: '28.00' }],
          };
          let loading = deferred();
          const calls = { loads: 0, status: 0, claims: 0 };
          const attempt = { attemptId: 'fixture-attempt', orderToken: checkout.orderToken, paypalOrderId: checkout.paypalOrderId };
          globalThis.__recovery = {
            auth: { accountOwnerId: 'fixture-owner', isAuthenticated: false },
            store: { checkoutAttempt: attempt, activeCheckout: { orderToken: checkout.orderToken, stage: 'paypal_cancelled' } },
            scope: 'fixture-scope',
            load: async captured => {
              assert.deepEqual(captured, attempt);
              calls.loads++;
              return loading.promise;
            },
            claim: async () => { calls.claims++; },
            readStatus: async orderToken => {
              assert.equal(orderToken, checkout.orderToken);
              calls.status++;
              return { data: { orderToken, status: 'pending', paypalRecoveryState: 'resumable' } };
            },
            unexpected: () => assert.fail('Review navigation must not change payment or cart state'),
          };
          const { createRoot } = require('react-dom/client');
          const { default: CheckoutAttemptRecovery } = require('./src/components/UI/Shop/Checkout/CheckoutAttemptRecovery');
          const container = document.getElementById('app');
          const root = createRoot(container);
          const button = text => [...container.querySelectorAll('button')].find(node => node.getAttribute('aria-label') === text || node.textContent.trim() === text);
          const click = async node => {
            assert.ok(node, 'The expected action must be visible');
            await act(async () => node.click());
          };
          const assertFocusedReview = () => {
            const heading = [...container.querySelectorAll('h2')].find(node => node.textContent === 'Your original purchase');
            assert.ok(heading);
            assert.equal(document.activeElement, heading);
            assert.equal(heading.tabIndex, -1);
            assert.deepEqual(scrolls.at(-1), { element: heading, options: { block: 'start', behavior: reducedMotion ? 'instant' : 'smooth' } });
            return heading;
          };

          try {
            await act(async () => root.render(<CheckoutAttemptRecovery><div data-current-cart>Current cart</div></CheckoutAttemptRecovery>));
            await click(button('Check PayPal Status'));
            assert.deepEqual(calls, { loads: 0, status: 1, claims: 1 });
            const initialAction = button('Review original purchase');
            assert.equal(initialAction.getAttribute('aria-label'), 'Review original purchase');
            assert.equal(initialAction.hasAttribute('aria-controls'), false);
            await click(initialAction);
            const pendingAction = button('Opening original purchase…');
            assert.equal(pendingAction.disabled, true);
            assert.equal(pendingAction.getAttribute('aria-label'), 'Opening original purchase…');
            assert.ok(container.querySelector('[data-current-cart]'));
            await act(async () => loading.resolve(checkout));

            const heading = assertFocusedReview();
            assert.equal(container.querySelector('[data-current-cart]'), null);
            const openAction = button('Go to original purchase');
            assert.equal(openAction.tagName, 'BUTTON');
            assert.equal(openAction.getAttribute('aria-label'), 'Go to original purchase');
            const review = document.getElementById(openAction.getAttribute('aria-controls'));
            assert.ok(review && review.contains(heading), 'The action identifies its saved review');
            assert.equal(review.getAttribute('aria-labelledby'), heading.id);
            assert.equal(container.querySelector('[data-payment-probe]'), null);
            await click(container.querySelector('input[value="card"]'));
            assert.equal(container.querySelector('[data-payment-probe]'), null, 'Payment still requires consent');
            const consent = container.querySelector('input[type="checkbox"]');
            await click(consent);
            const payment = container.querySelector('[data-payment-probe]');
            assert.ok(payment);
            assert.equal(payment.getAttribute('data-mode'), 'card');
            assert.equal(consent.checked, true);

            const scrollCount = scrolls.length;
            openAction.focus();
            assert.equal(document.activeElement, openAction);
            await click(openAction);
            assert.equal(assertFocusedReview(), heading, 'Returning to the review must preserve its DOM');
            assert.equal(scrolls.length, scrollCount + 1);
            assert.equal(container.querySelector('input[type="checkbox"]'), consent);
            assert.equal(consent.checked, true);
            assert.equal(container.querySelector('[data-payment-probe]'), payment);
            assert.deepEqual(calls, { loads: 1, status: 1, claims: 1 });

            // A zero-detail click exercises the same native button activation used by keyboards.
            openAction.focus();
            await act(async () => openAction.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 0 })));
            assert.equal(assertFocusedReview(), heading);
            assert.equal(container.querySelector('[data-payment-probe]'), payment);
            assert.deepEqual(calls, { loads: 1, status: 1, claims: 1 });

            await click(button('Back to current cart'));
            assert.ok(container.querySelector('[data-current-cart]'));
            assert.equal(button('Go to original purchase'), undefined);
            assert.equal(button('Review original purchase').hasAttribute('aria-controls'), false);
            assert.equal(container.querySelector('[data-payment-probe]'), null);

            loading = deferred();
            await click(button('Review original purchase'));
            await act(async () => loading.reject(new Error('We couldn’t load your purchase review. Please try again.')));
            assert.equal(container.querySelector('[role="alert"]').textContent, 'We couldn’t load your purchase review. Please try again.');
            assert.equal(button('Review original purchase').disabled, false);
            assert.ok(container.querySelector('[data-current-cart]'));
            loading = deferred();
            await click(button('Review original purchase'));
            assert.equal(container.querySelector('[role="alert"]'), null);
            await act(async () => loading.resolve(checkout));
            assertFocusedReview();
            assert.equal(container.querySelector('input[type="checkbox"]').checked, false, 'A reopened review still requires consent');
            assert.equal(container.querySelector('[data-payment-probe]'), null);
            assert.deepEqual(calls, { loads: 3, status: 1, claims: 1 });
          } finally {
            await act(async () => root.unmount());
            dom.window.close();
          }
        }

        (async () => {
          await verifyScenario(false);
          await verifyScenario(true);
          console.log('original purchase review interaction checks passed');
        })().catch(error => { console.error(error); process.exitCode = 1; });
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
        name: 'recovery-view-boundaries',
        setup(builder) {
          builder.onResolve({ filter: /^(react(?:\/.*)?|react-dom(?:\/.*)?)$/ }, (args) => ({
            path: args.path,
            external: true,
          }));
          const mocks: Record<string, string> = {
            'next/image':
              "import React from 'react'; export default function Image({src, ...props}) { return <img src={src} {...props} />; }",
            'next/dynamic':
              "import React from 'react'; export default () => function PaymentProbe({ mode }) { return <button data-payment-probe data-mode={mode}>Sandbox payment</button>; };",
            '@/assets/img/paypal.png': "export default '/paypal.png';",
            '@/stores/authStore':
              'export const useAuthStore = selector => selector(globalThis.__recovery.auth);',
            '@/stores/shop_stores/cartStore': 'export const useCartStore = () => null;',
            '@/stores/shop_stores/checkoutStore': 'export const useShopCheckoutStore = () => null;',
            '@/stores/shop_stores/checkoutStore/djangoOrderIntentStore':
              'export const useDjangoOrderIntentStore = () => null;',
            '@/stores/shop_stores/checkoutStore/paypalIntentStore': `
              export const usePayPalIntentStore = selector => selector(globalThis.__recovery.store);
              export const captureCheckoutAttempt = () => globalThis.__recovery.store.checkoutAttempt;
              export const isCurrentCheckoutAttempt = () => true;
              export const setCheckoutAttemptStage = () => globalThis.__recovery.unexpected();
            `,
            '@/stores/shop_stores/checkoutStore/storage':
              'export const flushCheckoutStorage = () => globalThis.__recovery.unexpected();',
            '@/lib/hooks/shopHooks/checkout/originalCheckout': `
              export const originalCheckoutScope = () => globalThis.__recovery.scope;
              export const loadOriginalCheckout = attempt => globalThis.__recovery.load(attempt);
              export const canReopenCheckoutPayment = () => true;
            `,
            '@/lib/hooks/shopHooks/checkout/claimCurrentCheckout':
              'export const claimCurrentCheckout = () => globalThis.__recovery.claim();',
            '@/lib/hooks/shopHooks/checkout/readCheckoutStatus':
              'export const readCheckoutStatus = (...args) => globalThis.__recovery.readStatus(...args);',
            '@/lib/hooks/shopHooks/checkout/checkoutAttemptRecovery': `
              export const canStartSeparateCheckout = () => false;
              export const startSeparateCheckout = () => globalThis.__recovery.unexpected();
            `,
            '@/lib/hooks/useShopRouter':
              'export const useShopRouter = () => ({ push: () => globalThis.__recovery.unexpected() });',
            '@/lib/error-toast': 'export default () => globalThis.__recovery.unexpected();',
            './ProductCheckout':
              "import React from 'react'; export const CheckoutAccordionContext = React.createContext({});",
            './ServerOrderDetailsComponent':
              "import React from 'react'; export const ServerOrderDetailsContext = React.createContext(null);",
          };
          builder.onResolve({ filter: /HelperComponents\/CustomShopLink$/ }, () => ({
            path: 'shop-link',
            namespace: 'recovery-view-fixture',
          }));
          builder.onResolve({ filter: /Paypal\/PayPalMainCheckoutComponent$/ }, () => ({
            path: 'payment-provider',
            namespace: 'recovery-view-fixture',
          }));
          builder.onResolve({ filter: /.*/ }, (args) =>
            Object.hasOwn(mocks, args.path)
              ? { path: args.path, namespace: 'recovery-view-fixture' }
              : undefined,
          );
          builder.onLoad({ filter: /.*/, namespace: 'recovery-view-fixture' }, ({ path }) => ({
            loader: 'jsx',
            contents:
              path === 'shop-link'
                ? "import React from 'react'; export default function Link(props) { return <a {...props} />; }"
                : path === 'payment-provider'
                  ? 'export default () => globalThis.__recovery.unexpected();'
                  : mocks[path],
          }));
        },
      },
    ],
  });
  // The checkout suite uses server React; run interactions with client React in a fresh process.
  const run = spawnSync(process.execPath, [], {
    cwd: process.cwd(),
    input: result.outputFiles[0].text,
    encoding: 'utf8',
    timeout: 15_000,
    maxBuffer: 100_000,
  });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /original purchase review interaction checks passed/);
});
