import 'server-only';

import { getServerAccessToken } from '../session/server-session';
import { deleteSession, refreshSession } from '../session/main-session';
import { djangoRequest } from '../django/request';
import { AccountRequestError } from './errors';

// Only actions/handlers may opt into cookie writes. Rendering code must use the default.
export async function authenticatedDjangoFetch(
  path: string,
  init: RequestInit = {},
  options: { writable?: boolean; retryUnauthorized?: boolean } = {},
) {
  let token = await getServerAccessToken();
  let refreshed = false;
  const refresh = async () => {
    if (!options.writable)
      throw new AccountRequestError('sign_in_required', 'Sign in again to continue.', 401);
    const result = await refreshSession();
    if (!result.success)
      throw new AccountRequestError(
        result.unavailable ? 'unavailable' : 'sign_in_required',
        result.error,
        result.unavailable ? 503 : 401,
      );
    token = await getServerAccessToken();
    refreshed = true;
  };
  if (!token) await refresh();
  const send = () =>
    djangoRequest(path, {
      ...init,
      headers: {
        ...Object.fromEntries(new Headers(init.headers)),
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
  let response = await send();
  if (
    response.status === 401 &&
    !refreshed &&
    options.writable &&
    (init.method === undefined || init.method === 'GET' || options.retryUnauthorized)
  ) {
    await response.body?.cancel();
    await refresh();
    response = await send();
  }
  if (response.status === 401) {
    await response.body?.cancel();
    if (options.writable) await deleteSession();
    throw new AccountRequestError('sign_in_required', 'Sign in again to continue.', 401);
  }
  if (response.status === 403) {
    await response.body?.cancel();
    throw new AccountRequestError('forbidden', 'You do not have permission for this request.', 403);
  }
  return response;
}
