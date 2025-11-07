// src/components/UI/Shop/GlobalShopComponents/CountryDropdownServerFloating.tsx
import { getDefaultISO3 } from '@/lib/utils/shop/geo/getDefaultISO3.server';
import CountryDropdownClientFloating, {
  type FloatingDropdownProps,
} from './CountryDropDownClientFloating';

export default async function CountryDropdownServerFloating(
  props: Omit<FloatingDropdownProps, 'initialIso3'>,
) {
  const iso3 = await getDefaultISO3(); // cookie/Accept-Language, zero network
  return <CountryDropdownClientFloating initialIso3={iso3} {...props} />;
}
