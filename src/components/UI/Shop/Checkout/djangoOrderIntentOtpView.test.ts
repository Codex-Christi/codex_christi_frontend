import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

test('checkout verification closes before review, preserves the drawer, and rejects stale completions', async () => {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'tsx',
      contents: `
        import assert from 'node:assert/strict';
        import { JSDOM } from 'jsdom';
        import React, { act } from 'react';
        import { DjangoOrderIntentOtpController } from './src/components/UI/Shop/Checkout/UserCheckoutSummary/DjangoOrderIntentOtpController';

        async function verifyDialog() {
          globalThis.fetch = async () => assert.fail('Verification view tests cannot call a provider');
          const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'https://checkout.example.test' });
          globalThis.window = dom.window;
          globalThis.document = dom.window.document;
          globalThis.HTMLElement = dom.window.HTMLElement;
          globalThis.IS_REACT_ACT_ENVIRONMENT = true;
          const { createRoot } = require('react-dom/client');
          const root = createRoot(document.getElementById('app'));
          const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
          const verified = { data: { otp_status: 'verified', order_id: 'fixture-order' } };
          const events = [];
          const codes = [];
          let verification = async () => undefined;
          let resend = async () => {};
          let review = Promise.resolve();

          function Harness() {
            const [open, setOpen] = React.useState(true);
            const [verifying, setVerifying] = React.useState(false);
            const [resending, setResending] = React.useState(false);
            const [step, setStep] = React.useState('Contact');
            const currentOpen = React.useRef(open);
            const changeOpen = (next) => { currentOpen.current = next; events.push(next ? 'open' : 'close'); setOpen(next); };
            return <>
              <p data-step>{step}</p>
              <button data-open onClick={() => changeOpen(true)}>Open verification</button>
              <DjangoOrderIntentOtpController
                isOpen={open}
                email="customer@example.test"
                onOpenChange={changeOpen}
                proceedToPaymentTrigger={async () => {
                  assert.equal(currentOpen.current, false, 'OTP must close before Review is presented');
                  events.push('review');
                  setStep('Review');
                  await review;
                }}
                djangoOrderIntentEmailVerification={{
                  djangoOrderIntentResp: { data: { order_id: 'fixture-order' } },
                  isVerifying: verifying,
                  isResending: resending,
                  isDjangoOrderIntentLoading: false,
                  triggerVerifyDjangoOrderIntentOTP: async ({ otp }) => {
                    codes.push(otp);
                    setVerifying(true);
                    try { return await verification(); }
                    finally { setVerifying(false); }
                  },
                  resendDjangoOrderIntentOTP: async () => {
                    setResending(true);
                    try { await resend(); }
                    finally { setResending(false); }
                  },
                }}
              />
            </>;
          }

          const dialog = () => document.querySelector('[role="dialog"]');
          const input = () => dialog().querySelector('input');
          const verifyButton = () => dialog().querySelector('button[type="submit"]');
          const sendButton = () => [...dialog().querySelectorAll('button')].find(button => /another code/.test(button.textContent));
          const fill = async (code) => act(async () => {
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input(), code);
            input().dispatchEvent(new window.Event('input', { bubbles: true }));
          });
          const submit = () => dialog().querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
          const close = async () => act(async () => dialog().querySelector('[aria-label="Close email verification"]').click());
          const reopen = async () => act(async () => document.querySelector('[data-open]').click());
          await act(async () => root.render(<Harness />));
          const drawer = document.querySelector('[data-drawer-root]');

          // An expired/invalid result stays in the same dialog and can be retried.
          await fill('111111');
          await act(async () => submit());
          assert.equal(dialog().hidden, false);
          assert.equal(document.querySelector('[data-step]').textContent, 'Contact');
          assert.equal(verifyButton().disabled, false);

          const sending = deferred();
          resend = () => sending.promise;
          await act(async () => sendButton().click());
          assert.equal(verifyButton().disabled, true);
          assert.equal(verifyButton().textContent, 'Verify email');
          await act(async () => submit());
          assert.equal(codes.length, 1, 'Resend and verify must not run together');
          await act(async () => sending.resolve());
          assert.equal(verifyButton().disabled, false);

          const checking = deferred();
          const reviewing = deferred();
          verification = () => checking.promise;
          review = reviewing.promise;
          await fill('654321');
          await act(async () => { submit(); submit(); });
          assert.deepEqual(codes, ['111111', '654321'], 'Repeated submits share the active verification');
          await act(async () => checking.resolve(verified));
          assert.equal(document.querySelector('[data-step]').textContent, 'Review');
          assert.equal(dialog().hidden, true, 'OTP must already be closed while Review is pending');
          assert.ok(document.querySelector('[data-drawer-root]') === drawer, 'Closing must not remount the drawer');
          assert.equal(dialog().querySelector('form'), null, 'Closing must not mount a fresh code entry');
          assert.equal(dialog().querySelector('input'), null, 'Closed content must not autofocus a new input');
          assert.notEqual(document.activeElement?.tagName, 'INPUT');
          assert.deepEqual(events.slice(-2), ['close', 'review']);

          // Finishing the earlier continuation cannot close a newly opened code entry.
          await reopen();
          assert.equal(input().value, '', 'Reopening starts with a fresh code entry');
          await fill('222222');
          await act(async () => reviewing.resolve());
          assert.equal(dialog().hidden, false);
          assert.equal(input().value, '222222');
          assert.ok(document.querySelector('[data-drawer-root]') === drawer);

          const late = deferred();
          verification = () => late.promise;
          await act(async () => submit());
          const reviewsBeforeClose = events.filter(event => event === 'review').length;
          await close();
          await reopen();
          await fill('333333');
          await act(async () => late.resolve(verified));
          assert.equal(events.filter(event => event === 'review').length, reviewsBeforeClose);
          assert.equal(dialog().hidden, false);
          assert.equal(input().value, '333333', 'A dismissed verification cannot change the new entry');

          verification = async () => { throw new Error('Synthetic verification failure'); };
          await act(async () => submit());
          assert.match(dialog().querySelector('[role="alert"]').textContent, /couldn’t verify/);
          assert.equal(verifyButton().disabled, false);
          await close();
          await reopen();
          assert.equal(input().value, '');
          assert.equal(dialog().querySelector('[role="alert"]'), null);
          assert.ok(document.querySelector('[data-drawer-root]') === drawer);

          await act(async () => root.unmount());
          dom.window.close();
          console.log('verification dialog regression passed');
        }
        verifyDialog().catch(error => { console.error(error); process.exitCode = 1; });
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
        name: 'verification-view-boundaries',
        setup(builder) {
          builder.onResolve({ filter: /^(react(?:\/.*)?|react-dom(?:\/.*)?)$/ }, (args) => ({
            path: args.path,
            external: true,
          }));
          builder.onResolve({ filter: /^@\/components\/UI\/primitives\/drawer$/ }, () => ({
            path: 'drawer',
            namespace: 'verification-fixture',
          }));
          builder.onResolve({ filter: /(?:loading-toast|error-toast)$|^sonner$/ }, () => ({
            path: 'toast',
            namespace: 'verification-fixture',
          }));
          builder.onLoad({ filter: /^toast$/, namespace: 'verification-fixture' }, () => ({
            contents: 'export default () => 1; export const toast = { dismiss() {} };',
          }));
          builder.onLoad({ filter: /^drawer$/, namespace: 'verification-fixture' }, () => ({
            loader: 'jsx',
            contents: `
              import React from 'react';
              const Context = React.createContext({});
              export function Drawer({ open, onOpenChange, children }) {
                return <Context.Provider value={{ open, onOpenChange }}><div data-drawer-root>{children}</div></Context.Provider>;
              }
              export const DrawerOverlay = () => null;
              // Keep closed content mounted, as an exit transition may do.
              export function DrawerContent({ children }) {
                const { open } = React.useContext(Context);
                return <div role="dialog" hidden={!open}>{children}</div>;
              }
              export const DrawerTitle = props => <h2 {...props} />;
              export const DrawerDescription = props => <p {...props} />;
              export function DrawerClose(props) {
                const { onOpenChange } = React.useContext(Context);
                return <button {...props} onClick={() => onOpenChange(false)} />;
              }
            `,
          }));
        },
      },
    ],
  });
  const run = spawnSync(process.execPath, [], {
    cwd: process.cwd(),
    input: result.outputFiles[0].text,
    encoding: 'utf8',
    timeout: 15_000,
    maxBuffer: 100_000,
  });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /verification dialog regression passed/);
});
