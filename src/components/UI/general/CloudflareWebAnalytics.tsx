'use client';

import Script from 'next/script';
import { useSyncExternalStore } from 'react';

const BEACON_URL = 'https://static.cloudflareinsights.com/beacon.min.js';
const SITE_TOKENS: Record<string, string | undefined> = {
  'codexchristi.org': process.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_ORG_TOKEN,
  'codexchristi.shop': process.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_SHOP_TOKEN,
};

function subscribeToLoad(onLoad: () => void) {
  window.addEventListener('load', onLoad, { once: true });
  return () => window.removeEventListener('load', onLoad);
}

const hasPageLoaded = () => document.readyState === 'complete';
const serverSnapshot = () => false;

export default function CloudflareWebAnalytics() {
  const pageLoaded = useSyncExternalStore(subscribeToLoad, hasPageLoaded, serverSnapshot);
  if (process.env.NODE_ENV !== 'production' || !pageLoaded) return null;

  const hostname = window.location.hostname.replace(/^www\./, '');
  const token = SITE_TOKENS[hostname]?.trim();

  // Check after load so an automatic tag near the end of streamed HTML is not missed.
  if (!token || document.querySelector(`script[src^="${BEACON_URL}"]`)) return null;

  return (
    <Script
      id='cloudflare-web-analytics'
      src={BEACON_URL}
      type='module'
      strategy='lazyOnload'
      fetchPriority='low'
      crossOrigin='anonymous'
      data-cf-beacon={JSON.stringify({ token, spa: true })}
    />
  );
}
