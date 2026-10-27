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
  store.hydrateFromShopProfile(profile, 'account@example.test');
  const saved = useShopCheckoutStore.getState();
  assert.equal(saved.first_name, 'Gift');
  assert.equal(saved.last_name, 'Customer');
  assert.equal(saved.email, 'recipient@example.test');
  assert.equal(saved.delivery_address.shipping_address_line_1, '10 Profile Street');
  store.setDeliveryAddress({ ...saved.delivery_address, shipping_address_line_1: 'Guest Address' });
  store.hydrateFromShopProfile(profile, 'account@example.test');
  assert.equal(
    useShopCheckoutStore.getState().delivery_address.shipping_address_line_1,
    'Guest Address',
  );
});
