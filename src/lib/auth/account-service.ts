import 'server-only';

import { authenticatedDjangoFetch } from './authenticated-django-fetch';
import { AccountRequestError } from './errors';
import { readProfileData, readShopProfileData } from './account-data';
import { readDjangoJson, safeDjangoMessage } from '../django/request';
import { getServerUserID } from '../session/server-session';

type RequestOptions = Parameters<typeof authenticatedDjangoFetch>[2];

export async function requestAccountData<T>(
  path: string,
  parse: (payload: unknown) => T | Promise<T>,
  init: RequestInit = {},
  options: RequestOptions = {},
) {
  const response = await authenticatedDjangoFetch(path, init, options);
  const payload = await readDjangoJson(response);
  if (!response.ok)
    throw new AccountRequestError(
      response.status >= 500 || response.status === 429
        ? 'unavailable'
        : response.status === 404
          ? 'not_found'
          : 'invalid_input',
      safeDjangoMessage(payload, 'The request could not be completed.'),
      response.status,
    );
  return parse(payload);
}

export async function readCurrentProfileData(payload: unknown) {
  return readProfileData(payload, (await getServerUserID()) ?? '');
}

// Rendering defaults to read-only. Only server actions opt into refreshing cookies.
export const getMainAccountProfile = (options: RequestOptions = {}) =>
  requestAccountData('/account/my-profile', readCurrentProfileData, {}, options);
export const getShopAccountProfile = (options: RequestOptions = {}) =>
  requestAccountData('/shop/my-shop-profile', readShopProfileData, {}, options);
