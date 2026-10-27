import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

function setEnv(t: TestContext, key: string, value: string) {
  const previous = process.env[key];
  process.env[key] = value;
  t.after(() => {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  });
}
import { authFlowUrl, getAuthRoutes, publicShopPath, safeAuthReturnPath } from './domain-routing';
import { profileUpdateForm, shippingAddressPayload } from './account-validation';
import { MAX_PROFILE_PIC_SIZE } from './profile-limits';
import { readProfileData, readShopProfileData } from './account-data';
import { allowAuthAttempt } from './rate-limit';
import { isSameOriginMutation } from './request-origin';
import { signInSchema } from '../formSchemas/signInSchema';
import { SignUpFormSchemaWithRefine } from '../formSchemas/signUpFormSchema';
import { resetPasswordSchema } from '../formSchemas/resetPasswordSchema';
import { verifyOTPSchema } from '../formSchemas/verifyOTPSchema';
import { PatchUserProfileSchema } from '../formSchemas/editUserProfileSchema';

test('shop links work on both hosts without stripping unrelated path segments', () => {
  assert.equal(publicShopPath('/shop', 'codexchristi.shop'), '/');
  assert.equal(publicShopPath('/shop?sort=price', 'www.codexchristi.shop'), '/?sort=price');
  assert.equal(publicShopPath('/shop/account-overview', 'codexchristi.shop'), '/account-overview');
  assert.equal(publicShopPath('/shopping', 'codexchristi.shop'), '/shopping');
  assert.equal(publicShopPath('/shop/cart', 'codexchristi.org'), '/shop/cart');
  assert.equal(getAuthRoutes('codexchristi.shop').login, '/auth/login');
  assert.equal(getAuthRoutes('localhost:3000', true).login, '/shop/auth/login');
  assert.equal(getAuthRoutes('localhost:3000').login, '/auth/sign-in');
});

test('Register links use main signup, including the production origin', (t) => {
  setEnv(t, 'NODE_ENV', 'production');
  setEnv(t, 'NEXT_PUBLIC_SITE_URL', 'https://codexchristi.org');
  assert.equal(getAuthRoutes('codexchristi.shop').signup, 'https://codexchristi.org/auth/signup');
  setEnv(t, 'NODE_ENV', 'development');
  assert.equal(getAuthRoutes('localhost:3000', true).signup, '/auth/signup');
});

test('login destinations reject external, encoded, auth-loop and unapproved paths', () => {
  const routes = getAuthRoutes('codexchristi.shop');
  for (const path of [
    '//evil.test',
    'https://evil.test',
    '/\\evil.test',
    '/%2f%2fevil.test',
    '/%252fevil.test',
    '/auth/login',
    '/api/logout',
    '/admin',
    '/account-overview\n',
  ]) {
    assert.equal(safeAuthReturnPath(path, routes), null, path);
  }
  assert.equal(safeAuthReturnPath('/checkout?step=payment', routes), '/checkout?step=payment');
  assert.equal(
    safeAuthReturnPath('/shop/checkout', getAuthRoutes('localhost', true)),
    '/shop/checkout',
  );
  assert.equal(safeAuthReturnPath('/profile/edit', getAuthRoutes('localhost')), '/profile/edit');
});

test('email plus signs and next queries survive the entire URL encoding round trip', () => {
  const url = new URL(
    authFlowUrl('/auth/verify-otp', {
      email: 'person+shop@example.com',
      next: '/shop/checkout?step=1&gift=yes',
    }),
    'https://local.test',
  );
  assert.equal(url.searchParams.get('email'), 'person+shop@example.com');
  assert.equal(url.searchParams.get('next'), '/shop/checkout?step=1&gift=yes');
});

test('login validates email and required password without changing the password', () => {
  assert.equal(signInSchema.safeParse({ email: 'bad', password: '' }).success, false);
  const password = '  legacy password  ';
  assert.deepEqual(signInSchema.parse({ email: ' person+shop@example.com ', password }), {
    email: 'person+shop@example.com',
    password,
  });
});

test('signup validates names, terms and confirmation and accepts short real names', () => {
  const valid = {
    firstname: 'Li',
    lastname: "O'Neil",
    email: 'person+shop@example.com',
    password: 'NewPassword1!',
    confirm_password: 'NewPassword1!',
    terms_and_policy: true,
  };
  assert.equal(SignUpFormSchemaWithRefine.safeParse(valid).success, true);
  for (const patch of [
    { firstname: '   ' },
    { email: 'bad' },
    { password: 'short' },
    { confirm_password: 'Different1!' },
    { terms_and_policy: false },
  ]) {
    assert.equal(SignUpFormSchemaWithRefine.safeParse({ ...valid, ...patch }).success, false);
  }
});

test('verify/reset forms validate email, six numeric digits and matching new passwords', () => {
  assert.equal(
    verifyOTPSchema.safeParse({ email: 'person@example.com', otp: '123456' }).success,
    true,
  );
  assert.equal(verifyOTPSchema.safeParse({ email: 'bad', otp: 'abc123' }).success, false);
  const reset = {
    email: 'person@example.com',
    otp: '123456',
    password: 'NewPassword1!',
    confirm_password: 'NewPassword1!',
  };
  assert.equal(resetPasswordSchema.safeParse(reset).success, true);
  for (const patch of [{ email: '' }, { otp: '12345x' }, { confirm_password: 'OtherPassword1!' }])
    assert.equal(resetPasswordSchema.safeParse({ ...reset, ...patch }).success, false);
});

test('existing Nigeria addresses are saved as Nigeria; unknown countries never default to USA', () => {
  const address = {
    shipping_address: '42 Test Street',
    shipping_city: 'Lagos',
    shipping_state: 'Lagos',
    shipping_country: 'Nigeria',
  };
  for (const country of ['Nigeria', 'NG', 'NGA'])
    assert.equal(
      shippingAddressPayload({ ...address, shipping_country: country }).shipping_country,
      'Nigeria',
    );
  assert.throws(() => shippingAddressPayload({ ...address, shipping_country: 'Invalid country' }));
  assert.throws(() => shippingAddressPayload({ ...address, user_id: 'someone-else' }));
});

function photo(size: number, type = 'image/png', name = 'avatar.png') {
  const bytes = new Uint8Array(size);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  return new File([bytes], name, { type });
}

test('the maximum allowed profile photo leaves space under the 1 MiB proxy body limit', async () => {
  const input = new FormData();
  input.set('profile_pic', photo(MAX_PROFILE_PIC_SIZE));
  input.set('bio', 'a'.repeat(1000));
  const output = await profileUpdateForm(input);
  const body = await new Response(output).arrayBuffer();
  assert.ok(body.byteLength < 1024 * 1024);
});

test('profile mutations reject oversized, disguised, duplicate and read-only fields', async () => {
  for (const value of [
    photo(MAX_PROFILE_PIC_SIZE + 1),
    photo(32, 'image/png', 'avatar.html'),
    new File(['not an image'], 'avatar.png', { type: 'image/png' }),
  ]) {
    const form = new FormData();
    form.set('profile_pic', value);
    await assert.rejects(profileUpdateForm(form));
  }
  for (const name of ['id', 'age', 'date_created', 'mainAccessToken']) {
    const form = new FormData();
    form.set(name, '1');
    await assert.rejects(profileUpdateForm(form));
  }
  const duplicate = new FormData();
  duplicate.append('first_name', 'A');
  duplicate.append('first_name', 'B');
  await assert.rejects(profileUpdateForm(duplicate));
});

test('client and server share the profile field contract', async () => {
  const valid = {
    first_name: 'Li',
    currency: 'NGN',
    date_of_birth: '2000-01-02',
    gender: 'female',
  };
  assert.equal(PatchUserProfileSchema.safeParse(valid).success, true);
  const form = new FormData();
  for (const [key, value] of Object.entries(valid)) form.set(key, value);
  assert.deepEqual(Object.fromEntries(await profileUpdateForm(form)), valid);
  for (const invalid of [
    { age: 20 },
    { date_created: '2000-01-01' },
    { gender: 'unsupported' },
    { currency: 'ngn' },
    { date_of_birth: 'not-a-date' },
  ]) {
    assert.equal(PatchUserProfileSchema.safeParse(invalid).success, false);
  }
});

test('account DTOs strip upstream tokens and refuse a different profile identity', () => {
  const payload = {
    success: true,
    data: {
      id: 'user-a',
      email: 'a@example.com',
      first_name: null,
      access: 'secret',
      refresh: 'secret',
      is_staff: true,
    },
  };
  assert.deepEqual(readProfileData(payload, 'user-a'), { id: 'user-a', email: 'a@example.com' });
  assert.throws(() => readProfileData(payload, 'user-b'));
  const shop = readShopProfileData({
    success: true,
    status: 200,
    message: 'ok',
    refresh: 'secret',
    data: {
      first_name: 'A',
      last_name: 'B',
      bio: null,
      profile_pic: null,
      username: 'a',
      favorite_products: [],
      payment_methods: '',
      shipping_address: null,
      shipping_city: null,
      shipping_state: null,
      shipping_country: null,
      access: 'secret',
    },
  });
  assert.equal(JSON.stringify(shop).includes('secret'), false);
});

test('unused payment/favorites fields cannot break account loading or leak into its DTO', () => {
  const data = {
    first_name: 'A',
    last_name: 'B',
    bio: null,
    profile_pic: null,
    username: 'a',
    shipping_address: null,
    shipping_city: null,
    shipping_state: null,
    shipping_country: null,
  };
  for (const payment_methods of [
    null,
    [],
    [{ id: 'method', privateValue: 'do-not-serialize' }],
    '',
    undefined,
  ]) {
    const result = readShopProfileData({
      success: true,
      status: 200,
      message: 'ok',
      data: { ...data, payment_methods, favorite_products: null },
    });
    assert.equal('payment_methods' in result.data, false);
    assert.equal('favorite_products' in result.data, false);
    assert.equal(JSON.stringify(result).includes('do-not-serialize'), false);
  }
});

test('mutation handlers reject GET-style, cross-origin and missing-Origin requests', (t) => {
  setEnv(t, 'NODE_ENV', 'production');
  const make = (origin?: string, extra = {}) =>
    new Request('https://codexchristi.shop/next-api/logout', {
      method: 'POST',
      headers: {
        host: 'codexchristi.shop',
        'x-forwarded-proto': 'https',
        ...(origin ? { origin } : {}),
        ...extra,
      },
    });
  assert.equal(isSameOriginMutation(make('https://codexchristi.shop')), true);
  assert.equal(isSameOriginMutation(make('https://evil.test')), false);
  assert.equal(isSameOriginMutation(make()), false);
  assert.equal(
    isSameOriginMutation(make('https://codexchristi.shop', { 'sec-fetch-site': 'cross-site' })),
    false,
  );
});

test('bounded login/code limiter rejects repeated attempts and permits a later window', () => {
  assert.equal(allowAuthAttempt('test', 'identity', 1, 30_000, 100), true);
  assert.equal(allowAuthAttempt('test', 'identity', 1, 30_000, 101), false);
  assert.equal(allowAuthAttempt('test', 'identity', 1, 30_000, 30_101), true);
});
