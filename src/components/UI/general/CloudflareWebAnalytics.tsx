'use client';

import Script from 'next/script';
import { useSyncExternalStore } from 'react';
import { usePublicRuntimeConfig } from '@/lib/runtime-config/hooks';

const BEACON_URL = 'https://static.cloudflareinsights.com/beacon.min.js';

function subscribeToLoad(onLoad: () => void) {
  window.addEventListener('load', onLoad, { once: true });
  return () => window.removeEventListener('load', onLoad);
}

const hasPageLoaded = () => document.readyState === 'complete';
const serverSnapshot = () => false;

export default function CloudflareWebAnalytics() {
  const pageLoaded = useSyncExternalStore(subscribeToLoad, hasPageLoaded, serverSnapshot);
  if (process.env.NODE_ENV !== 'production' || !pageLoaded) return null;
  return <ConfiguredAnalytics />;
}

const normalizedHost = (hostname: string) => hostname.replace(/^www\./, '');

function ConfiguredAnalytics() {
  const config = usePublicRuntimeConfig();
  if (!config) return null;
  const hostname = normalizedHost(window.location.hostname);
  const token =
    hostname === normalizedHost(new URL(config.siteUrl).hostname)
      ? config.analyticsOrgToken
      : hostname === normalizedHost(new URL(config.shopSiteUrl).hostname)
        ? config.analyticsShopToken
        : null;

  // Check after load so an automatic tag near the end of streamed HTML is not missed.
  if (!token?.trim() || document.querySelector(`script[src^="${BEACON_URL}"]`)) return null;

  return (
    <Script
      id='cloudflare-web-analytics'
      src={BEACON_URL}
      type='module'
      strategy='lazyOnload'
      fetchPriority='low'
      crossOrigin='anonymous'
      data-cf-beacon={JSON.stringify({ token: token.trim(), spa: true })}
    />
  );
}
