'use client';

import { CountryDropdown, type Country } from '@/components/UI/primitives/country-dropdown';
import { useCurrencyCookie } from '@/lib/utils/shop/globalFXProductPrice/currencyCookieStore';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';

export type FloatingDropdownProps = {
  initialIso3: string;
  classNames?: React.ComponentProps<typeof CountryDropdown>['classNames'];
  unstyled?: boolean;
  placeholder?: string;
  slim?: boolean;
};

export default function CountryDropdownClientFloating({
  initialIso3,
  classNames,
  unstyled,
  placeholder = 'Select country',
  slim = false,
}: FloatingDropdownProps) {
  const iso3 = useCurrencyCookie((s) => s.iso3);
  const changeCountry = useCurrencyCookie((s) => s.changeCountry);
  const setCheckoutStoreCountry = useShopCheckoutStore((s) => s.setShippingCountryISO3);

  const defaultValue = iso3 || initialIso3 || 'USA';
  const key = defaultValue;

  return (
    <div
      className='
        fixed right-4 bottom-8 lg:bottom-20
        z-[500]
        rounded-full bg-[#242121c7] backdrop-blur-[10px]
        shadow-md shadow-slate-200 font-ocr font-bold
      '
    >
      <CountryDropdown
        key={key}
        defaultValue={defaultValue}
        onChange={(c: Country) => {
          if (c.alpha3 && c.alpha3 !== iso3) {
            changeCountry(c.alpha3);
            setCheckoutStoreCountry(c.alpha3);
          }
        }}
        disableAutoFocusOnOpen
        // Optional extra guard:
        searchReadOnlyUntilInteract
        placeholder={placeholder}
        slim={slim}
        unstyled={unstyled ?? true}
        classNames={{
          trigger:
            classNames?.trigger ??
            'input border-none flex items-center gap-4 justify-between h-10 px-4 ' +
              'text-white bg-transparent rounded-full',
          popover: classNames?.popover ?? 'w-[320px] p-0 !z-[500]',
          command: classNames?.command ?? 'bg-[#0D0D0DFA] text-white',
          commandList: classNames?.commandList ?? '',
          commandInput: classNames?.commandInput ?? 'bg-transparent placeholder:text-white/60',
          commandItem: classNames?.commandItem ?? 'text-white',
          name: classNames?.name ?? 'overflow-hidden text-ellipsis whitespace-nowrap',
          chevron: classNames?.chevron ?? '',
          ...(classNames || {}),
        }}
      />

      {/**
       * ===============================
       * OPTION B — Inline non-floating version (for reuse)
       * ===============================
       *
       * <CountryDropdown
       *   defaultValue={defaultValue}
       *   onChange={(c) => changeCountry(c.alpha3)}
       *   unstyled
       *   classNames={{
       *     trigger: "h-10 px-3 rounded-xl text-sm border border-white/10 bg-black/60 backdrop-blur",
       *     popover: "w-[360px] p-0 rounded-2xl border border-white/10 bg-black/85 backdrop-blur",
       *     command: "max-h-80",
       *     commandItem: "hover:bg-white/5 text-white",
       *     commandInput: "bg-transparent placeholder:text-white/50",
       *   }}
       * />
       */}

      {/**
       * ===============================
       * OPTION C — Slim icon-only trigger version (for compact layouts)
       * ===============================
       *
       * <CountryDropdown
       *   defaultValue={defaultValue}
       *   onChange={(c) => changeCountry(c.alpha3)}
       *   slim
       *   unstyled
       *   classNames={{
       *     trigger: "h-9 w-10 rounded-full flex items-center justify-center",
       *     popover: "w-[280px] p-0",
       *     command: "bg-[#0D0D0DFA] text-white",
       *     commandInput: "bg-transparent",
       *     commandItem: "text-white",
       *   }}
       * />
       */}
    </div>
  );
}
