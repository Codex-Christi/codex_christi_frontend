import assert from 'node:assert/strict';
import test from 'node:test';
import { useShopCheckoutStore } from './index';
import type { IUserShopProfile } from '@/lib/types/user-shop-interface';

const profile: IUserShopProfile = {
  status: 200,
  success: true,
  message: '',
  data: {
    first_name: 'Account',
    last_name: 'Customer',
    bio: '',
    profile_pic: '',
    username: 'account',
    shipping_address: '10 Profile Street',
    shipping_city: 'Profile City',
    shipping_state: 'Profile State',
    shipping_country: 'USA',
  },
};

test('sign-in profile autofill preserves the guest recipient and fills only missing details', (t) => {
  const before = useShopCheckoutStore.getState();
  t.after(() => useShopCheckoutStore.setState(before));
  const store = useShopCheckoutStore.getState();
  store.resetCheckoutToInitial();
  store.setFirstName('Gift');
  store.setEmail('recipient@example.test');
  store.hydrateFromShopProfile(profile);
  const saved = useShopCheckoutStore.getState();
  assert.equal(saved.first_name, 'Gift');
  assert.equal(saved.last_name, 'Customer');
  assert.equal(saved.email, 'recipient@example.test');
  assert.equal(saved.emailIsCustom, true);
  assert.equal(saved.delivery_address.shipping_address_line_1, '10 Profile Street');
  store.setDeliveryAddress({ ...saved.delivery_address, shipping_address_line_1: 'Guest Address' });
  store.hydrateFromShopProfile(profile);
  assert.equal(
    useShopCheckoutStore.getState().delivery_address.shipping_address_line_1,
    'Guest Address',
  );
});

test('country changes clear the previous state in the saved checkout draft', (t) => {
  const before = useShopCheckoutStore.getState();
  t.after(() => useShopCheckoutStore.setState(before));
  before.setDeliveryAddress({
    ...before.delivery_address,
    shipping_country: 'USA',
    shipping_state: 'California',
  });
  before.setShippingCountryISO3('USA');
  assert.equal(useShopCheckoutStore.getState().delivery_address.shipping_state, 'CA');
  before.setShippingCountryISO3('CAN');
  assert.equal(useShopCheckoutStore.getState().delivery_address.shipping_state, '');
  before.setDeliveryAddress({
    ...before.delivery_address,
    shipping_country: 'CAN',
    shipping_state: 'Ontario',
  });
  before.setShippingCountryISO3('CAN');
  assert.equal(useShopCheckoutStore.getState().delivery_address.shipping_state, 'Ontario');
  before.setShippingCountryISO3('USA');
  assert.equal(useShopCheckoutStore.getState().delivery_address.shipping_state, '');
});

test('profile autofill never attaches a state from another country to the selected destination', (t) => {
  const before = useShopCheckoutStore.getState();
  t.after(() => useShopCheckoutStore.setState(before));
  before.resetCheckoutToInitial();
  before.setShippingCountryISO3('NGA');
  before.hydrateFromShopProfile({
    ...profile,
    data: { ...profile.data, shipping_state: 'California' },
  });
  assert.equal(useShopCheckoutStore.getState().delivery_address.shipping_country, 'NGA');
  assert.equal(useShopCheckoutStore.getState().delivery_address.shipping_state, '');
  before.resetCheckoutToInitial();
  before.hydrateFromShopProfile({
    ...profile,
    data: { ...profile.data, shipping_state: 'California' },
  });
  assert.equal(useShopCheckoutStore.getState().delivery_address.shipping_state, 'CA');
});
