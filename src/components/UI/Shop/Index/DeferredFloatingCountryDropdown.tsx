'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CircleFlag } from 'react-circle-flags';
import { useCurrencyCookie } from '@/lib/utils/shop/globalFXProductPrice/currencyCookieStore';
import { getStorefrontCountryIdentity } from '@/lib/utils/shop/geo/storefrontCountryIndex';

type LoadedDropdown = (typeof import('./CountryDropDownClientFloating'))['default'];
let dropdownImport: Promise<LoadedDropdown> | undefined;

function loadDropdown() {
  return (dropdownImport ??= import('./CountryDropDownClientFloating')
    .then((module) => module.default)
    .catch((error) => {
      dropdownImport = undefined;
      throw error;
    }));
}

const warmDropdown = () => void loadDropdown().catch(() => {});
const wrapperClassName =
  'fixed right-4 bottom-8 lg:bottom-20 z-[500] rounded-full bg-[#242121c7] backdrop-blur-[10px] shadow-md shadow-slate-200 font-ocr font-bold';
const triggerClassName =
  'input border-none inline-flex items-center gap-2 justify-between h-10 px-4 text-white bg-transparent rounded-full whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 relative';

export default function DeferredFloatingCountryDropdown({ initialIso3 }: { initialIso3: string }) {
  const iso3 = useCurrencyCookie((state) => state.iso3);
  const country = getStorefrontCountryIdentity(iso3 || initialIso3 || 'USA');
  const [Dropdown, setDropdown] = useState<LoadedDropdown | null>(null);
  const [requestedOpen, setRequestedOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const isLoading = requestedOpen && !Dropdown && !loadError;

  useEffect(() => {
    if (!requestedOpen || Dropdown || loadError) return;
    let cancelled = false;
    void loadDropdown()
      .then((component) => {
        if (!cancelled) setDropdown(() => component);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [requestedOpen, Dropdown, loadError]);

  useEffect(() => {
    if (!requestedOpen) return;
    const cancelOpening = () => {
      setRequestedOpen(false);
      setLoadError(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      cancelOpening();
      if (!Dropdown) {
        event.preventDefault();
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      // Consume the initial opening before a later country change remounts the chooser.
      if (Dropdown) {
        setRequestedOpen(false);
      } else if (
        event.target instanceof Node &&
        !triggerRef.current?.contains(event.target) &&
        !errorRef.current?.contains(event.target)
      ) {
        cancelOpening();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [requestedOpen, Dropdown]);

  if (Dropdown) {
    return (
      <Dropdown
        initialIso3={initialIso3}
        initiallyOpen={requestedOpen}
        onCountryChange={() => setRequestedOpen(false)}
        triggerLabel='Choose storefront country'
        wrapperClassName={wrapperClassName}
        classNames={{ trigger: triggerClassName }}
      />
    );
  }

  return (
    <div className={wrapperClassName}>
      <div>
        <button
          ref={triggerRef}
          type='button'
          className={triggerClassName}
          aria-label='Choose storefront country'
          aria-haspopup='listbox'
          aria-expanded={false}
          aria-busy={isLoading}
          onPointerEnter={warmDropdown}
          onFocus={warmDropdown}
          onClick={() => {
            setLoadError(false);
            setRequestedOpen((open) => loadError || !open);
          }}
        >
          {country ? (
            <span
              className={`flex items-center gap-2 overflow-hidden flex-grow min-w-0 ${isLoading ? 'invisible' : ''}`}
            >
              <span className='inline-flex items-center justify-center w-5 h-5 shrink-0 overflow-hidden rounded-full'>
                <CircleFlag countryCode={country.alpha2.toLowerCase()} height={20} />
              </span>
              <span className='overflow-hidden text-ellipsis whitespace-nowrap'>
                {country.name}
              </span>
            </span>
          ) : (
            <span className={isLoading ? 'invisible' : undefined}>Select country</span>
          )}
          <ChevronDown
            size={25}
            className={`ml-2 shrink-0 opacity-90 ${isLoading ? 'invisible' : ''}`}
          />
          {isLoading && (
            <span aria-hidden='true' className='absolute inset-0 flex items-center justify-center'>
              Loading...
            </span>
          )}
        </button>
      </div>
      {loadError && (
        <div
          ref={errorRef}
          role='alert'
          className='absolute bottom-full right-0 mb-2 w-56 rounded-md border border-white/20 bg-black px-3 py-2 text-sm text-white shadow-lg'
        >
          <p>Country options could not load.</p>
          <button
            type='button'
            className='mt-1 underline underline-offset-4'
            onClick={() => setLoadError(false)}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
