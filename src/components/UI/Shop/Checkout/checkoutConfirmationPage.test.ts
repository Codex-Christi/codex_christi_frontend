import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { build } from 'esbuild';

test('viewing earlier confirmation details never claims an order or clears the current cart and hides data after an account switch', async () => {
  const bundled = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'tsx',
      contents: `
        const assert = require('node:assert/strict');
        const { JSDOM } = require('jsdom');
        const React = require('react');
        const { act, Suspense } = React;

        async function verify() {
          globalThis.fetch = async () => assert.fail('Confirmation page checks cannot call a provider');
          const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'https://shop.example.test/shop/checkout/confirmation/earlier-order?view=details' });
          globalThis.window = dom.window;
          globalThis.document = dom.window.document;
          globalThis.HTMLElement = dom.window.HTMLElement;
          globalThis.IS_REACT_ACT_ENVIRONMENT = true;
          globalThis.__calls = { reads: 0, claim: 0, consume: 0, captureAttempt: 0, clearAttempt: 0, legacyCleanup: 0, intentCleanup: 0, draftCleanup: 0 };
          globalThis.__auth = { isAuthenticated: true, accountOwnerId: 'owner-a' };
          globalThis.__cart = { consumePurchase: async () => { globalThis.__calls.consume++; } };
          globalThis.__draft = { resetCheckoutToStoreDefaults: () => { globalThis.__calls.draftCleanup++; } };
          globalThis.__intent = { clearDjangoOrderIntent: () => { globalThis.__calls.intentCleanup++; } };
          globalThis.__paidStatus = {
            orderToken: 'earlier-order', status: 'completed',
            paidAmountLabel: '$35.00', receiptReady: true, paymentSaved: true, paymentProgressed: true,
            receiptLink: '/next-api/shop/orders/earlier-order/receipt', receiptFile: 'Codex-Christi-receipt',
            processingCompletedAt: '2026-11-21T12:00:00.000Z', updatedAt: '2026-11-21T12:00:00.000Z',
            cartPurchase: { orderId: 'earlier-order', lines: [{ productId: 'sample-product', variantId: 'sample-variant', quantity: 1 }] },
          };
          const { createRoot } = require('react-dom/client');
          const { default: ConfirmationPage } = require('./src/app/shop/checkout/confirmation/[orderToken]/page');
          const container = document.getElementById('app');
          const root = createRoot(container);
          const params = Promise.resolve({ orderToken: 'earlier-order' });
          const searchParams = Promise.resolve({ view: 'details' });
          const render = async () => {
            await act(async () => {
              root.render(<Suspense fallback={<p>Loading confirmation</p>}><ConfirmationPage params={params} searchParams={searchParams} /></Suspense>);
              await params;
              await searchParams;
              await new Promise(setImmediate);
            });
          };
          const assertReadOnly = () => {
            const { reads, ...changes } = globalThis.__calls;
            assert.deepEqual(changes, { claim: 0, consume: 0, captureAttempt: 0, clearAttempt: 0, legacyCleanup: 0, intentCleanup: 0, draftCleanup: 0 });
          };
          await render();
          assert.equal(globalThis.__calls.reads, 1);
          assert.ok(container.textContent.includes('earlier-order'));
          assert.ok(container.textContent.includes('$35.00'));
          assertReadOnly();

          globalThis.__auth.accountOwnerId = 'owner-b';
          await render();
          assert.equal(globalThis.__calls.reads, 2);
          assert.equal(container.textContent.includes('$35.00'), false);
          assertReadOnly();
          await act(async () => {
            globalThis.__finishOtherStatus({ status: 403, data: null });
            await new Promise(setImmediate);
          });
          assert.equal(container.textContent.includes('$35.00'), false);
          assert.ok(container.textContent.includes('View your order'));
          assertReadOnly();
          await act(async () => root.unmount());
          dom.window.close();
          console.log('confirmation page checks passed');
        }
        verify().catch((error) => { console.error(error); process.exitCode = 1; });
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
        name: 'confirmation-page-boundaries',
        setup(builder) {
          builder.onResolve({ filter: /^react(?:\/.*)?$/ }, (args) => ({
            path: args.path,
            external: true,
          }));
          const mocks: Record<string, string> = {
            '@/stores/authStore':
              'export const useAuthStore = (selector) => selector(globalThis.__auth);',
            '@/stores/shop_stores/cartStore':
              'export const useCartStore = (selector) => selector(globalThis.__cart);',
            '@/stores/shop_stores/checkoutStore':
              'export const useShopCheckoutStore = { getState: () => globalThis.__draft };',
            '@/stores/shop_stores/checkoutStore/djangoOrderIntentStore':
              'export const useDjangoOrderIntentStore = { getState: () => globalThis.__intent };',
            '@/stores/shop_stores/checkoutStore/storage':
              'export const clearLegacyCheckoutCaches = async () => { globalThis.__calls.legacyCleanup++; };',
            '@/stores/shop_stores/checkoutStore/paypalIntentStore': `
              export const captureCheckoutAttempt = (orderToken) => { globalThis.__calls.captureAttempt++; return { orderToken, attemptId: 'current-attempt' }; };
              export const isCurrentCheckoutAttempt = () => true;
              export const clearCheckoutAttempt = () => { globalThis.__calls.clearAttempt++; };
            `,
            '@/lib/hooks/shopHooks/checkout/claimCurrentCheckout':
              'export const claimCurrentCheckout = async () => { globalThis.__calls.claim++; };',
            '@/lib/hooks/shopHooks/checkout/readCheckoutStatus': `
              export const readCheckoutStatus = async (orderToken) => {
                globalThis.__calls.reads++;
                if (orderToken !== 'earlier-order') throw new Error('Unexpected order reference');
                return globalThis.__auth.accountOwnerId === 'owner-a'
                  ? { status: 200, data: globalThis.__paidStatus }
                  : new Promise((resolve) => { globalThis.__finishOtherStatus = resolve; });
              };
            `,
            '@/components/UI/Shop/Checkout/CheckoutStorageNotice':
              'export default function StorageNotice() { return null; }',
            '@/components/UI/Shop/Checkout/CheckoutAccessRecovery':
              'export default function AccessRecovery() { return null; }',
            '../HelperComponents/CustomShopLink':
              "import React from 'react'; export default function ShopLink({children,href,...props}) { return <a href={href} {...props}>{children}</a>; }",
          };
          builder.onResolve({ filter: /.*/ }, (args) =>
            Object.hasOwn(mocks, args.path)
              ? { path: args.path, namespace: 'confirmation-page-mock' }
              : undefined,
          );
          builder.onLoad({ filter: /.*/, namespace: 'confirmation-page-mock' }, ({ path }) => ({
            loader: 'jsx',
            contents: mocks[path],
          }));
        },
      },
    ],
  });
  const run = spawnSync(process.execPath, [], {
    cwd: process.cwd(),
    input: bundled.outputFiles[0].text,
    encoding: 'utf8',
    timeout: 15_000,
    maxBuffer: 100_000,
  });
  assert.equal(run.status, 0, `${run.error?.message ?? ''}\n${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /confirmation page checks passed/);
});
