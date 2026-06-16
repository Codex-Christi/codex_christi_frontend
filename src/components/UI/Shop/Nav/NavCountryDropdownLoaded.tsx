'use client';

import CountryDropdown from '@/components/UI/Shop/Index/CountryDropDownClientFloating';
import { getDefaultISO3 } from '@/lib/utils/shop/geo/getDefaultISO3.client';

export default function NavCountryDropdownLoaded({
  initiallyOpen = false,
}: {
  initiallyOpen?: boolean;
}) {
  const defaultISO3 = getDefaultISO3();

  return (
    <CountryDropdown
      initialIso3={defaultISO3}
      initiallyOpen={initiallyOpen}
      slim
      chevronClassName='ml-2 shrink-0 opacity-100 size-[1.5rem] text-white'
      classNames={{
        trigger: ` hidden md:inline-flex items-center gap-2 h-9 px-3 rounded-full border border-white/20 bg-black/60 text-white whitespace-nowrap
            hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60`,
      }}
    />
  );
}
