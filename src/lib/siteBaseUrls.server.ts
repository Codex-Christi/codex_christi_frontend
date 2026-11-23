import 'server-only';

import { readRuntimeSetting } from '../../scripts/runtime-config.mjs';
import * as siteUrls from './siteBaseUrls';

// Read deployment configuration only while executing on the server. Existing
// runtime environment names remain supported without inlining public values.
export function readRuntimeSiteOrigins(): siteUrls.SiteOrigins {
  return {
    siteUrl: readRuntimeSetting(process.env, 'SITE_URL', 'NEXT_PUBLIC_SITE_URL'),
    shopSiteUrl: readRuntimeSetting(process.env, 'SHOP_SITE_URL', 'NEXT_PUBLIC_SHOP_SITE_URL'),
  };
}

export function getMainSiteBaseUrl() {
  return siteUrls.getMainSiteBaseUrl(readRuntimeSiteOrigins());
}

export function getShopSiteBaseUrl() {
  return siteUrls.getShopSiteBaseUrl(readRuntimeSiteOrigins());
}

export function getMainSiteUrl(path = '/') {
  return siteUrls.getMainSiteUrl(path, readRuntimeSiteOrigins());
}

export function getShopSiteUrl(path = '/') {
  return siteUrls.getShopSiteUrl(path, readRuntimeSiteOrigins());
}

export function getMainSiteHostname() {
  return siteUrls.getMainSiteHostname(readRuntimeSiteOrigins());
}

export function getShopSiteHostname() {
  return siteUrls.getShopSiteHostname(readRuntimeSiteOrigins());
}

export function getRequestOrigin(headers: Pick<Headers, 'get'>, fallbackUrl?: string) {
  return siteUrls.getRequestOrigin(headers, fallbackUrl, readRuntimeSiteOrigins());
}

export function getRequestUrl(path: string, headers: Pick<Headers, 'get'>, fallbackUrl?: string) {
  return siteUrls.getRequestUrl(path, headers, fallbackUrl, readRuntimeSiteOrigins());
}

export function isShopSiteHostname(hostname: string | null | undefined) {
  return siteUrls.isShopSiteHostname(hostname, readRuntimeSiteOrigins());
}

export { getHostnameFromHostHeader, getSiteHostnameAliases } from './siteBaseUrls';
