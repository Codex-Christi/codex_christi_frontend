// src/components/UI/Shop/GlobalShopComponents/CountryDropdownServerFloating.tsx
import { getDefaultStorefrontISO3 } from '@/lib/utils/shop/geo/getDefaultISO3.server';
import CountryDropdownClientFloating, {
  type FloatingDropdownProps,
} from './CountryDropDownClientFloating';

export default async function CountryDropdownServerFloating(
  props: Omit<FloatingDropdownProps, 'initialIso3'>,
) {
  const iso3 = await getDefaultStorefrontISO3(); // cookie/request headers, zero profile network
  return <CountryDropdownClientFloating initialIso3={iso3} {...props} />;
}
