import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryLegacyStorage } from '@/lib/cart/test-support';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { flushCheckoutStorage } from '@/stores/shop_stores/checkoutStore/storage';
import {
  getCheckoutAccountEmail,
  getCheckoutValuesFromStore,
  saveBasicCheckoutInfoToStore,
  toDjangoOrderIntentPayload,
} from './basicCheckoutInfoHelpers';

const accountDefault = {
  accountEmail: 'new-account@example.test',
  emailIsCustom: false,
  emailIsDirty: false,
  hasExistingOrder: false,
};

test('an untouched draft can use the current account email even with a saved delivery address', (t) => {
  const before = useShopCheckoutStore.getState();
  t.after(() => useShopCheckoutStore.setState(before));
  useShopCheckoutStore.setState({ email: 'old-account@example.test', emailIsCustom: false });
  const draft = { ...getCheckoutValuesFromStore(), addressLine1: 'Test Street' };
  saveBasicCheckoutInfoToStore(draft, false);
  const saved = useShopCheckoutStore.getState();

  assert.equal(
    getCheckoutAccountEmail({ ...accountDefault, emailIsCustom: saved.emailIsCustom }),
    accountDefault.accountEmail,
  );
  assert.equal(saved.delivery_address.shipping_address_line_1, draft.addressLine1);
});

test('does not replace an edited field or the email for an existing order', () => {
  assert.equal(getCheckoutAccountEmail({ ...accountDefault, emailIsDirty: true }), null);
  assert.equal(getCheckoutAccountEmail({ ...accountDefault, hasExistingOrder: true }), null);
  assert.equal(getCheckoutAccountEmail({ ...accountDefault, accountEmail: null }), null);
});

test('an explicitly entered guest email survives sign-in and draft saves', (t) => {
  const before = useShopCheckoutStore.getState();
  t.after(() => useShopCheckoutStore.setState(before));
  before.resetCheckoutToInitial();
  const draft = { ...getCheckoutValuesFromStore(), email: 'recipient@example.test' };
  saveBasicCheckoutInfoToStore(draft, true);
  saveBasicCheckoutInfoToStore(draft, false);
  const saved = useShopCheckoutStore.getState();

  assert.equal(saved.email, draft.email);
  assert.equal(
    getCheckoutAccountEmail({ ...accountDefault, emailIsCustom: saved.emailIsCustom }),
    null,
  );
});

test('an unsubmitted custom email survives a reload separately from the saved checkout email', async (t) => {
  const before = useShopCheckoutStore.getState();
  const storage = new MemoryLegacyStorage();
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    assert.equal(input, '/next-api/runtime-config');
    return Response.json({
      siteUrl: 'https://codexchristi.org',
      shopSiteUrl: 'https://codexchristi.shop',
      paymentMode: 'sandbox',
      paymentClientId: 'checkout-test-client',
      cartKey: 'checkout-test-cart-key',
      analyticsOrgToken: null,
      analyticsShopToken: null,
    });
  });
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage },
  });
  t.after(async () => {
    try {
      useShopCheckoutStore.setState(before);
      await flushCheckoutStorage('checkout-storage');
    } finally {
      if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
      else Reflect.deleteProperty(globalThis, 'window');
    }
  });

  before.resetCheckoutToInitial();
  useShopCheckoutStore.setState({ email: accountDefault.accountEmail });
  before.setDraftEmail('  recipient@example.test  ');
  await flushCheckoutStorage('checkout-storage');
  const stored = storage.getItem('checkout-storage:v2');
  assert.ok(stored);

  before.resetCheckoutToInitial();
  await flushCheckoutStorage('checkout-storage');
  storage.setItem('checkout-storage:v2', stored);
  await useShopCheckoutStore.persist.rehydrate();

  const reopened = useShopCheckoutStore.getState();
  assert.equal(reopened.email, accountDefault.accountEmail);
  assert.equal(reopened.draftEmail, 'recipient@example.test');
  const values = getCheckoutValuesFromStore();
  assert.equal(values.email, reopened.draftEmail);

  // A restored input is pristine. Submitting it still records the explicit choice.
  saveBasicCheckoutInfoToStore(values, false);
  const submitted = useShopCheckoutStore.getState();
  assert.equal(submitted.email, 'recipient@example.test');
  assert.equal(submitted.emailIsCustom, true);
  assert.equal(submitted.draftEmail, null);
});

test('clearing, invalidating, or reverting the email edit removes the pending draft', (t) => {
  const before = useShopCheckoutStore.getState();
  t.after(() => useShopCheckoutStore.setState(before));
  useShopCheckoutStore.setState({ email: accountDefault.accountEmail, draftEmail: null });

  for (const value of ['', 'incomplete@', accountDefault.accountEmail.toUpperCase()]) {
    before.setDraftEmail('recipient@example.test');
    assert.equal(getCheckoutValuesFromStore().email, 'recipient@example.test');
    before.setDraftEmail(value);
    assert.equal(useShopCheckoutStore.getState().draftEmail, null);
    assert.equal(getCheckoutValuesFromStore().email, accountDefault.accountEmail);
  }
});

test('checkout loads old U.S. state names and saves only their postal code', (t) => {
  const before = useShopCheckoutStore.getState();
  t.after(() => useShopCheckoutStore.setState(before));
  before.resetCheckoutToInitial();
  for (const state of ['California', 'ca', ' CA ']) {
    useShopCheckoutStore.setState({
      delivery_address: {
        ...before.delivery_address,
        shipping_country: 'USA',
        shipping_state: state,
      },
    });
    const draft = getCheckoutValuesFromStore('USA');
    assert.equal(draft.adminArea1, 'CA');
    saveBasicCheckoutInfoToStore({ ...draft, adminArea1: 'California' }, false);
    assert.equal(useShopCheckoutStore.getState().delivery_address.shipping_state, 'CA');
    assert.equal(toDjangoOrderIntentPayload({ ...draft, adminArea1: 'California' }).state, 'CA');
  }
});

test('a country override clears the old state while non-U.S. drafts keep free text', (t) => {
  const before = useShopCheckoutStore.getState();
  t.after(() => useShopCheckoutStore.setState(before));
  useShopCheckoutStore.setState({
    delivery_address: { ...before.delivery_address, shipping_country: 'USA', shipping_state: 'CA' },
  });
  assert.equal(getCheckoutValuesFromStore('CAN').adminArea1, '');
  useShopCheckoutStore.setState({
    delivery_address: {
      ...before.delivery_address,
      shipping_country: 'NGA',
      shipping_state: 'Lagos',
    },
  });
  const draft = getCheckoutValuesFromStore('NGA');
  assert.equal(draft.adminArea1, 'Lagos');
  assert.equal(toDjangoOrderIntentPayload(draft).state, 'Lagos');
  saveBasicCheckoutInfoToStore(draft, false);
  assert.equal(useShopCheckoutStore.getState().delivery_address.shipping_state, 'Lagos');
  assert.equal(getCheckoutValuesFromStore('USA').adminArea1, '');
});
