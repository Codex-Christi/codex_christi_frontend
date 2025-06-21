'use server';

import fs from 'fs/promises';
import path from 'path';

export type ShippingCountryObj = {
  country_iso2: string;
  country_iso3: string;
  country_name: string;
  currency: string;
  printful: boolean;
  merchize: boolean;
  both: boolean;
  // ...other fields
};

export type dropShippingSupplier = 'merchize' | 'printful';

let catalogMap: Map<string, ShippingCountryObj> | null = null;

export async function loadCatalog() {
  if (catalogMap) return catalogMap;
  const json = await fs.readFile(
    path.join(
      process.cwd(),
      'src/datasets/shop_general/country_shipping_support.json'
    ),
    'utf8'
  );
  const arr: ShippingCountryObj[] = JSON.parse(json);
  catalogMap = new Map(arr.map((item) => [item.country_iso3, item]));
  return catalogMap;
}

export async function getCountrySupport(
  country_iso3: ShippingCountryObj['country_iso3'],
  supplier: dropShippingSupplier
) {
  const map = await loadCatalog();
  const country = map.get(country_iso3);
  const isCountrySupported = country ? country[supplier] : false;

  return { country, isCountrySupported };
}

export async function getCurrency(
  country_iso3: ShippingCountryObj['country_iso3']
) {
  const map = await loadCatalog();
  const country = map.get(country_iso3);

  return country?.currency;
}
