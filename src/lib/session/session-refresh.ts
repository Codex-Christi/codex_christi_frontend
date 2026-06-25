import { resolveServerDjangoApiBaseUrl } from '../django/resolveServerDjangoApiBaseUrl';
import {
  getDjangoAuthErrorMessage,
  getNestedAuthToken,
} from './django-auth-response';

export interface RefreshedDjangoTokens {
  accessToken: string;
  refreshToken: string;
}

export class SessionRefreshError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionRefreshError';
  }
}

function getDjangoRefreshPath() {
  const configuredPath = process.env.DJANGO_AUTH_REFRESH_PATH?.trim();
  const path = configuredPath || '/auth/token/refresh';

  return path.startsWith('/') ? path : `/${path}`;
}

export async function refreshDjangoSessionTokens(
  currentRefreshToken: string,
): Promise<RefreshedDjangoTokens> {
  const response = await fetch(`${resolveServerDjangoApiBaseUrl()}${getDjangoRefreshPath()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ refresh: currentRefreshToken }),
    cache: 'no-store',
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new SessionRefreshError(
      getDjangoAuthErrorMessage(payload, 'Session refresh failed.'),
    );
  }

  const accessToken = getNestedAuthToken(payload, 'access');
  const refreshToken = getNestedAuthToken(payload, 'refresh') ?? currentRefreshToken;

  if (!accessToken) {
    throw new SessionRefreshError('Session refresh response did not include an access token.');
  }

  return {
    accessToken,
    refreshToken,
  };
}
