import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

test('saved-address and checkout fields display US state names and keep country-specific state values', async () => {
  const bundled = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'tsx',
      contents: `
        import assert from 'node:assert/strict';
        import { JSDOM } from 'jsdom';
        import React, { act } from 'react';

        async function verifySavedAddressEditor() {
          globalThis.fetch = async () => assert.fail('Saved-address form tests cannot call a provider');
          const dom = new JSDOM('<!doctype html><html><head><style>* { animation-name: none !important; transition-duration: 0s !important; }</style></head><body><div id="app"></div></body></html>', { url: 'https://shop.example.test', pretendToBeVisual: true });
          globalThis.window = dom.window;
          globalThis.document = dom.window.document;
          for (const name of ['HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLFormElement', 'HTMLButtonElement', 'Element', 'Node', 'NodeFilter', 'DocumentFragment', 'MutationObserver', 'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent']) globalThis[name] = dom.window[name];
          Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
          globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
          globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
          globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
          globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
          dom.window.ResizeObserver = globalThis.ResizeObserver;
          dom.window.PointerEvent = class extends dom.window.MouseEvent { pointerId = 1; pointerType = 'mouse'; };
          globalThis.PointerEvent = dom.window.PointerEvent;
          dom.window.HTMLElement.prototype.hasPointerCapture = () => false;
          dom.window.HTMLElement.prototype.setPointerCapture = () => {};
          dom.window.HTMLElement.prototype.releasePointerCapture = () => {};
          dom.window.HTMLElement.prototype.scrollIntoView = () => {};
          globalThis.IS_REACT_ACT_ENVIRONMENT = true;
          const { createRoot } = await import('react-dom/client');
          // Match the CommonJS React Hook Form instance used by the bundled components.
          const { useForm } = require('react-hook-form');
          const { default: ShippingAddressModal } = await import('./src/app/shop/account-overview/shipping-address/_components/shipping-address-modal');
          const { DeliveryAddressInputFields } = await import('./src/components/UI/Shop/Checkout/UserCheckoutSummary/DeliveryAddressInputFields');
          const { Form } = await import('./src/components/UI/primitives/form');
          const container = document.getElementById('app');
          const root = createRoot(container);
          globalThis.__savedAddresses = [];
          globalThis.__profileUpdates = [];
          globalThis.__addressErrors = [];
          globalThis.__profileStore = { userShopProfile: null, setUserShopProfile: (profile) => globalThis.__profileUpdates.push(profile) };
          const profile = { shipping_state: 'California', shipping_country: 'United States', shipping_city: 'Los Angeles', shipping_address: '12 Example Street' };
          const render = async (data, key) => {
            globalThis.__profileStore.userShopProfile = { data };
            await act(async () => { root.render(<ShippingAddressModal key={key} isActive={true} setIsActive={() => {}} />); await new Promise(setImmediate); });
          };
          const fieldElement = (field) => {
            if (field === 'adminArea1') {
              const label = [...container.querySelectorAll('label')].find((element) => ['State', 'State / province'].includes(element.textContent));
              if (label) return document.getElementById(label.htmlFor);
            }
            return container.querySelector('#' + field) ?? container.querySelector('[name="' + field + '"]');
          };
          const change = async (field, value) => {
            const element = fieldElement(field);
            assert.ok(element, field);
            await act(async () => {
              const prototype = element.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
              Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
              element.dispatchEvent(new window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
              await new Promise(setImmediate);
            });
          };
          const press = async (element, key) => {
            await act(async () => {
              element.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }));
              await new Promise((resolve) => setTimeout(resolve, 15));
            });
          };
          const openStates = async (field) => {
            const trigger = fieldElement(field);
            assert.equal(trigger.tagName, 'BUTTON');
            assert.equal(trigger.getAttribute('role'), 'combobox');
            await act(async () => { trigger.focus(); trigger.click(); await new Promise((resolve) => setTimeout(resolve, 15)); });
            const list = document.querySelector('[role="listbox"]');
            assert.ok(list, 'The actual styled state menu opens');
            assert.equal(trigger.getAttribute('aria-expanded'), 'true');
            const popup = document.getElementById(trigger.getAttribute('aria-controls'));
            assert.ok(popup && popup.contains(list), 'The trigger controls the rendered state popup');
            const search = [...document.querySelectorAll('input')].find((element) => element.placeholder.toLowerCase().startsWith('search states'));
            assert.ok(search, 'The styled menu provides a state search field');
            assert.ok(document.getElementById(search.getAttribute('aria-controls')) === list, 'State search controls the rendered list');
            return { list, search };
          };
          const searchStates = async (search, text) => {
            await act(async () => {
              search.focus();
              Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(search, text);
              search.dispatchEvent(new window.Event('input', { bubbles: true }));
              await new Promise((resolve) => setTimeout(resolve, 15));
            });
          };
          const chooseState = async (field, name) => {
            const { list, search } = await openStates(field);
            await searchStates(search, name);
            const option = [...list.querySelectorAll('[role="option"]')].find((element) => element.textContent.trim() === name);
            assert.ok(option, name + ' is available by its full name');
            await act(async () => { option.click(); await new Promise((resolve) => setTimeout(resolve, 15)); });
            assert.equal(fieldElement(field).textContent.trim(), name);
            assert.equal(fieldElement(field).getAttribute('aria-expanded'), 'false');
          };
          const save = async () => { await act(async () => { container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await new Promise(setImmediate); }); };

          for (const [index, state] of ['California', 'CA', ' ca '].entries()) {
            await render({ ...profile, shipping_state: state }, 'legacy-' + index);
            const select = container.querySelector('#shipping_state');
            assert.equal(select.tagName, 'BUTTON');
            assert.equal(select.getAttribute('role'), 'combobox');
            assert.equal(select.textContent.trim(), 'California');
            assert.equal(container.querySelector('label[for="shipping_state"]').firstElementChild.textContent, 'State / province');
            assert.equal(globalThis.__savedAddresses.length, index);
            assert.equal(container.querySelector('#save-changes').disabled, false);
            await save();
            assert.equal(globalThis.__savedAddresses.at(-1).shipping_state, 'CA');
            assert.equal(globalThis.__savedAddresses.at(-1).shipping_country, 'US');
          }

          await render(profile, 'country-changes');
          const savedBeforeChanges = globalThis.__savedAddresses.length;
          await change('shipping_country', 'CA');
          assert.equal(container.querySelector('#shipping_state').tagName, 'INPUT');
          assert.equal(container.querySelector('#shipping_state').value, '');
          assert.equal(container.querySelector('#save-changes').disabled, true);
          await change('shipping_state', 'Ontario');
          assert.equal(container.querySelector('#shipping_state').value, 'Ontario');
          assert.equal(container.querySelector('#save-changes').disabled, false);
          await save();
          assert.equal(globalThis.__savedAddresses.at(-1).shipping_state, 'Ontario');
          assert.equal(globalThis.__savedAddresses.at(-1).shipping_country, 'CA');
          await change('shipping_country', 'US');
          assert.equal(container.querySelector('#shipping_state').tagName, 'BUTTON');
          assert.equal(container.querySelector('#shipping_state').textContent.trim(), 'Choose a state');
          assert.equal(container.querySelector('#save-changes').disabled, true);
          await chooseState('shipping_state', 'New York');
          await save();
          assert.equal(globalThis.__savedAddresses.at(-1).shipping_state, 'NY');
          assert.equal(globalThis.__savedAddresses.length, savedBeforeChanges + 2);

          await render({ ...profile, shipping_state: 'Lagos' }, 'invalid-us');
          assert.equal(container.querySelector('#shipping_state').textContent.trim(), 'Choose a state');
          assert.equal(container.querySelector('#save-changes').disabled, true);
          const beforeInvalidSave = globalThis.__savedAddresses.length;
          await save();
          assert.equal(globalThis.__savedAddresses.length, beforeInvalidSave);
          await change('shipping_country', 'NG');
          assert.equal(container.querySelector('#shipping_state').tagName, 'INPUT');
          assert.equal(container.querySelector('#shipping_state').value, '');
          await change('shipping_state', 'Lagos');
          await save();
          assert.equal(globalThis.__savedAddresses.at(-1).shipping_state, 'Lagos');
          assert.equal(globalThis.__savedAddresses.at(-1).shipping_country, 'NG');
          assert.equal(globalThis.__profileUpdates.length, globalThis.__savedAddresses.length);
          assert.deepEqual(globalThis.__addressErrors, []);

          const CheckoutDelivery = ({ country, state }) => {
            const form = useForm({ defaultValues: { country, adminArea1: state, adminArea2: 'Example City', addressLine1: '12 Example Street', addressLine2: '', postalCode: '90001' } });
            globalThis.__checkoutForm = form;
            return <Form {...form}><form><DeliveryAddressInputFields currentZodForm={form} /></form></Form>;
          };
          await act(async () => root.render(<CheckoutDelivery key="checkout-us" country="USA" state="California" />));
          let checkoutState = fieldElement('adminArea1');
          assert.equal(checkoutState.tagName, 'BUTTON');
          assert.equal(checkoutState.getAttribute('role'), 'combobox');
          assert.equal(checkoutState.textContent.trim(), 'California');
          assert.equal(container.querySelector('label[for="' + checkoutState.id + '"]').textContent, 'State');
          await act(async () => { globalThis.__checkoutForm.setFocus('adminArea1'); await new Promise((resolve) => setTimeout(resolve, 15)); });
          assert.ok(document.activeElement === checkoutState, 'React Hook Form should focus the visible state trigger; focused ' + document.activeElement.tagName + '#' + document.activeElement.id);
          await chooseState('adminArea1', 'New York');
          assert.equal(globalThis.__checkoutForm.getValues('adminArea1'), 'NY');
          const menu = await openStates('adminArea1');
          await searchStates(menu.search, 'Cal');
          assert.ok([...menu.list.querySelectorAll('[role="option"]')].some((element) => element.textContent.trim() === 'California'));
          assert.equal([...menu.list.querySelectorAll('[role="option"]')].some((element) => element.textContent.trim() === 'Alaska'), false);
          await searchStates(menu.search, 'Alaska');
          assert.ok(document.activeElement === menu.search, 'Keyboard state search keeps focus in its input');
          await press(menu.search, 'ArrowDown');
          await press(menu.search, 'Enter');
          assert.equal(globalThis.__checkoutForm.getValues('adminArea1'), 'AK');
          assert.equal(fieldElement('adminArea1').textContent.trim(), 'Alaska');
          const unmatchedMenu = await openStates('adminArea1');
          await searchStates(unmatchedMenu.search, 'not-a-state');
          assert.ok(document.body.textContent.includes('No states found.'));
          assert.equal(unmatchedMenu.list.querySelectorAll('[role="option"]').length, 0);
          assert.equal(globalThis.__checkoutForm.getValues('adminArea1'), 'AK');
          await press(unmatchedMenu.search, 'Escape');
          assert.equal(fieldElement('adminArea1').getAttribute('aria-expanded'), 'false');
          assert.equal(globalThis.__checkoutForm.getValues('adminArea1'), 'AK');
          assert.equal(fieldElement('adminArea1').textContent.trim(), 'Alaska');
          const codeMenu = await openStates('adminArea1');
          await searchStates(codeMenu.search, 'CA');
          await press(codeMenu.search, 'Enter');
          assert.equal(globalThis.__checkoutForm.getValues('adminArea1'), 'CA');
          assert.equal(fieldElement('adminArea1').textContent.trim(), 'California');
          await act(async () => root.render(<CheckoutDelivery key="checkout-ca-code" country="US" state="CA" />));
          assert.equal(fieldElement('adminArea1').textContent.trim(), 'California');
          await act(async () => root.render(<CheckoutDelivery key="checkout-nigeria" country="NGA" state="Lagos" />));
          checkoutState = fieldElement('adminArea1');
          assert.equal(checkoutState.tagName, 'INPUT');
          assert.equal(checkoutState.value, 'Lagos');
          assert.equal(container.querySelector('label[for="' + checkoutState.id + '"]').textContent, 'State / province');
          await change('adminArea1', 'Kano');
          assert.equal(globalThis.__checkoutForm.getValues('adminArea1'), 'Kano');
          assert.equal(globalThis.__savedAddresses.at(-1).shipping_state, 'Lagos');
          await act(async () => root.unmount());
          dom.window.close();
          console.log('saved address editor passed');
        }
        verifySavedAddressEditor().catch((error) => { console.error(error); process.exitCode = 1; });
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
        name: 'saved-address-boundaries',
        setup(builder) {
          builder.onResolve({ filter: /^react(?:\/.*)?$/ }, (args) => ({
            path: args.path,
            external: true,
          }));
          const mocks: Record<string, string> = {
            '@/components/UI/profile/Edit/EditCountry': `import React from 'react'; export default function EditCountry({value,onChange}) { return <select id="shipping_country" value={value ?? ''} onChange={(event) => onChange(event.target.value)}><option value="">Choose country</option><option value="US">United States</option><option value="CA">Canada</option><option value="NG">Nigeria</option></select>; }`,
            '@/components/UI/primitives/drawer': `import React from 'react'; const Box = ({children}) => <div>{children}</div>; export {Box as Drawer,Box as DrawerContent,Box as DrawerDescription,Box as DrawerOverlay,Box as DrawerTitle};`,
            '@/stores/shop_stores/use-user-shop-profile':
              'export const useUserShopProfile = (selector) => selector(globalThis.__profileStore);',
            '@/actions/account/profile': `export async function updateMyShippingAddress(data) {globalThis.__savedAddresses.push(data); return {success:true,data:{data}};}`,
            '@/lib/auth/session-generation': 'export const getAuthGeneration = () => 1;',
            '@/components/UI/Auth/AccountAccessContext':
              'export const useAccountAccess = () => true;',
            '@/lib/loading-toast': 'export default () => 1;',
            '@/lib/error-toast':
              'export default (value) => globalThis.__addressErrors.push(value);',
            '@/lib/success-toast': 'export default () => {};',
            sonner: 'export const toast = { dismiss() {} };',
          };
          builder.onResolve({ filter: /.*/ }, (args) =>
            Object.hasOwn(mocks, args.path)
              ? { path: args.path, namespace: 'saved-address-mock' }
              : undefined,
          );
          builder.onLoad({ filter: /.*/, namespace: 'saved-address-mock' }, ({ path }) => ({
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
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /saved address editor passed/);
});
