'use client';

import { ClientCurrencyBootstrap } from './ClientCurrencyBootstrap';
import { CurrencyCookiePersist } from './CurrencyCookiePersist';

export default function CurrencyCookieEffects() {
  return (
    <>
      <ClientCurrencyBootstrap />
      <CurrencyCookiePersist />
    </>
  );
}
