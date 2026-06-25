import 'server-only';

import { resolveServerDjangoApiBaseUrl } from './resolveServerDjangoApiBaseUrl';

export function getServerDjangoApiBaseUrl() {
  return resolveServerDjangoApiBaseUrl();
}
