import 'server-only';

import { readRuntimeSiteOrigins } from '../siteBaseUrls.server';
import * as routing from './domain-routing';

export function publicShopPath(path: string, hostname: string) {
  return routing.publicShopPath(path, hostname, readRuntimeSiteOrigins());
}

export function getAuthRoutes(hostname: string, shop = false) {
  return routing.getAuthRoutes(hostname, shop, readRuntimeSiteOrigins());
}

export { authFlowUrl, safeAuthReturnPath } from './domain-routing';
