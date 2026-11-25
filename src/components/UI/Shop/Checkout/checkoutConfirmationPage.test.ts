import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { build } from 'esbuild';

async function checkConfirmationPage(contents: string) {
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
          let params = Promise.resolve({ orderToken: 'earlier-order' });
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
          ${contents}
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
                if (globalThis.__readStatus) return globalThis.__readStatus(orderToken);
                if (orderToken !== 'earlier-order') throw new Error('Unexpected order reference');
                return globalThis.__auth.accountOwnerId === 'owner-a'
                  ? { status: 200, data: globalThis.__paidStatus }
                  : new Promise((resolve) => { globalThis.__finishOtherStatus = resolve; });
              };
            `,
            '@/components/UI/Shop/Checkout/CheckoutStorageNotice':
              'export default function StorageNotice() { return null; }',
            '../HelperComponents/CustomShopLink':
              "import React from 'react'; export default function ShopLink({children,href,prefetch,...props}) { return <a href={href} {...props}>{children}</a>; }",
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
}

test('viewing earlier confirmation details never claims an order or clears the current cart and hides data after an account switch', async () => {
  await checkConfirmationPage(`
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
          assert.ok(container.textContent.includes('Verify access to this order'));
          assertReadOnly();
  `);
});

test('a missing order link offers this site’s order history without an access code form', async () => {
  await checkConfirmationPage(`
    globalThis.__auth = { isAuthenticated: false, accountOwnerId: null };
    globalThis.__readStatus = async () => ({status:404,data:null});
    await render();
    assert.equal(container.querySelector('h1').textContent,'Order link unavailable');
    assert.match(container.textContent,/This order link isn’t available on this site. Check the link or look in Order History/u);
    const history = [...container.querySelectorAll('a')].find(link => link.textContent.includes('View order history'));
    assert.ok(history);
    assert.equal(new URL(history.href).origin,window.location.origin);
    assert.equal(new URL(history.href).pathname,'/shop/account-overview/order-history');
    assert.equal(container.querySelector('form'),null);
    assert.equal(container.querySelector('input'),null);
    assert.equal(container.querySelector('[role="alert"]'),null);
    assert.doesNotMatch(container.textContent,/Verify access|Send order access code|Try again|PayPal|payment|does not exist|couldn’t find/iu);
    assertReadOnly();
  `);
});

test('an order that requires access offers a code or sign in without claiming to check payment', async () => {
  await checkConfirmationPage(`
    globalThis.__auth = { isAuthenticated: false, accountOwnerId: null };
    globalThis.__readStatus = async () => ({status:403,data:null});
    await render();
    assert.equal(container.querySelector('h1').textContent,'Verify access to this order');
    assert.match(container.textContent,/Use the email address from checkout to get a code and view this order/u);
    assert.ok(container.querySelector('form'));
    assert.equal(container.querySelector('input[type="email"]').required,true);
    assert.ok([...container.querySelectorAll('button')].some(button => button.textContent.trim() === 'Send order access code'));
    const signIn = [...container.querySelectorAll('a')].find(link => link.textContent.trim() === 'Sign in');
    assert.ok(signIn);
    assert.doesNotMatch(container.textContent,/Order link unavailable|PayPal|payment|Try again/iu);
    assert.equal(container.querySelector('[role="alert"]'),null);
    assertReadOnly();
  `);
});

test('a verified signed-in owner sees the saved order without an access code form', async () => {
  await checkConfirmationPage(`
    globalThis.__readStatus = async () => ({status:200,data:globalThis.__paidStatus});
    await render();
    assert.match(container.textContent,/earlier-order/u);
    assert.match(container.textContent,/Paid \\$35\\.00/u);
    assert.equal(container.querySelector('form'),null);
    assert.equal(container.querySelector('input'),null);
    assert.doesNotMatch(container.textContent,/Verify access|Send order access code|Sign in/u);
    assertReadOnly();
  `);
});

test('temporary status failures offer retry instead of a missing-link message or code form', async () => {
  await checkConfirmationPage(`
    globalThis.__auth = { isAuthenticated: false, accountOwnerId: null };
    let failure = 'network';
    globalThis.__readStatus = async () => {
      if (failure === 'network') throw new Error('Offline fixture');
      if (failure === 'server') return {status:503,data:null};
      return {status:200,data:globalThis.__paidStatus};
    };
    const retryButton = () => [...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Try again');
    const assertTemporaryFailure = () => {
      assert.equal(container.querySelector('h1').textContent,'Order status unavailable');
      assert.ok(container.querySelector('[role="alert"]'));
      assert.equal(retryButton().disabled,false);
      assert.equal(container.querySelector('form'),null);
      assert.doesNotMatch(container.textContent,/Order link unavailable|Verify access|Send order access code|Checking your payment|Please wait/iu);
    };
    await render();
    assertTemporaryFailure();
    failure = 'server';
    await act(async () => { retryButton().click(); await new Promise(setImmediate); });
    assertTemporaryFailure();
    failure = 'success';
    await act(async () => { retryButton().click(); await new Promise(setImmediate); });
    assert.equal(globalThis.__calls.reads,3);
    assert.match(container.textContent,/Paid \\$35\\.00/u);
    assert.equal(container.querySelector('[role="alert"]'),null);
    assert.doesNotMatch(container.textContent,/Order status unavailable|Try again|Send order access code/u);
    assertReadOnly();
  `);
});

test('changing accounts clears unavailable and access-required outcomes before showing an owned order', async () => {
  await checkConfirmationPage(`
    globalThis.__auth = { isAuthenticated: false, accountOwnerId: null };
    const pending = [];
    globalThis.__readStatus = () => new Promise(resolve => pending.push(resolve));
    await render();
    await act(async () => { pending.shift()({status:404,data:null}); await new Promise(setImmediate); });
    assert.equal(container.querySelector('h1').textContent,'Order link unavailable');

    globalThis.__auth = { isAuthenticated: true, accountOwnerId: 'owner-b' };
    await render();
    await act(async () => { pending.shift()({status:403,data:null}); await new Promise(setImmediate); });
    assert.equal(container.querySelector('h1').textContent,'Verify access to this order');
    assert.ok(container.querySelector('input[type="email"]'));
    assert.equal([...container.querySelectorAll('a')].some(link => link.textContent.trim() === 'Sign in'),false);
    assert.doesNotMatch(container.textContent,/Order link unavailable/u);

    globalThis.__auth = { isAuthenticated: true, accountOwnerId: 'owner-a' };
    await render();
    await act(async () => { pending.shift()({status:200,data:globalThis.__paidStatus}); await new Promise(setImmediate); });
    assert.match(container.textContent,/Paid \\$35\\.00/u);
    assert.equal(container.querySelector('form'),null);
    assert.doesNotMatch(container.textContent,/Order link unavailable|Verify access|Send order access code/u);
    assertReadOnly();
  `);
});

test('an earlier account’s delayed status response cannot replace the current missing-link state', async () => {
  await checkConfirmationPage(`
    const pending = [];
    globalThis.__readStatus = () => new Promise(resolve => pending.push(resolve));
    await render();
    globalThis.__auth = { isAuthenticated: true, accountOwnerId: 'owner-b' };
    await render();
    await act(async () => { pending[1]({status:404,data:null}); await new Promise(setImmediate); });
    assert.equal(container.querySelector('h1').textContent,'Order link unavailable');
    await act(async () => { pending[0]({status:200,data:globalThis.__paidStatus}); await new Promise(setImmediate); });
    assert.equal(container.querySelector('h1').textContent,'Order link unavailable');
    assert.doesNotMatch(container.textContent,/Paid \\$35\\.00|Verify access|Send order access code/u);
    assert.equal(container.querySelector('form'),null);
    assertReadOnly();
  `);
});

test('a guest’s delayed access denial cannot ask a verified account owner for a code', async () => {
  await checkConfirmationPage(`
    globalThis.__auth = { isAuthenticated:false,accountOwnerId:null };
    const pending=[];
    globalThis.__readStatus = () => new Promise(resolve => pending.push(resolve));
    await render();
    globalThis.__auth = { isAuthenticated:true,accountOwnerId:'owner-a' };
    await render();
    await act(async () => { pending[1]({status:200,data:globalThis.__paidStatus}); await new Promise(setImmediate); });
    assert.match(container.textContent,/Paid \\$35\\.00/u);
    await act(async () => { pending[0]({status:403,data:null}); await new Promise(setImmediate); });
    assert.match(container.textContent,/Paid \\$35\\.00/u);
    assert.equal(container.querySelector('form'),null);
    assert.doesNotMatch(container.textContent,/Verify access|Send order access code|Sign in/u);
    assertReadOnly();
  `);
});

test('changing the order link hides the previous order’s access form while its status loads', async () => {
  await checkConfirmationPage(`
    globalThis.__auth = { isAuthenticated:false,accountOwnerId:null };
    const pending=[];
    globalThis.__readStatus = orderToken => new Promise(resolve => pending.push({orderToken,resolve}));
    await render();
    await act(async () => { pending[0].resolve({status:403,data:null}); await new Promise(setImmediate); });
    assert.equal(container.querySelector('h1').textContent,'Verify access to this order');
    assert.ok(container.querySelector('input[type="email"]'));

    params=Promise.resolve({orderToken:'other-fixture-order'});
    await render();
    assert.equal(pending[1].orderToken,'other-fixture-order');
    assert.equal(container.querySelector('form'),null);
    assert.doesNotMatch(container.textContent,/Verify access to this order|Send order access code/u);
    await act(async () => { pending[1].resolve({status:404,data:null}); await new Promise(setImmediate); });
    assert.equal(container.querySelector('h1').textContent,'Order link unavailable');
    assert.equal(container.querySelector('form'),null);
    assert.match(container.textContent,/other-fixture-order/u);
    assert.doesNotMatch(container.textContent,/earlier-order|Verify access|Send order access code/u);
    assertReadOnly();
  `);
});
