'use client';
import React, { useCallback, useState, forwardRef, useEffect, useMemo } from 'react';

// shadcn
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/UI/primitives/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/primitives/popover';

// utils
import { cn } from '@/lib/utils';

// assets
import { ChevronDown, CheckIcon, Globe } from 'lucide-react';
import { CircleFlag } from 'react-circle-flags';

// data
import { countries } from 'country-data-list';

// Country interface
export interface Country {
  alpha2: string;
  alpha3: string;
  countryCallingCodes: string[];
  currencies: string[];
  emoji?: string;
  ioc: string;
  languages: string[];
  name: string;
  status: string;
}

// Slot class names for full external customization
type ClassNames = {
  root?: string; // wrapper around Popover
  trigger?: string; // PopoverTrigger button
  flagWrapper?: string; // little circle flag container
  name?: string; // selected country text
  chevron?: string; // chevron icon
  popover?: string; // PopoverContent wrapper
  command?: string; // Command
  commandList?: string; // CommandList
  commandGroup?: string; // CommandGroup
  commandItem?: string; // CommandItem
  commandInput?: string; // CommandInput
  empty?: string; // CommandEmpty
};

// Dropdown props
interface CountryDropdownProps {
  options?: Country[];
  onChange?: (country: Country) => void;
  defaultValue?: string; // ISO3
  disabled?: boolean;
  placeholder?: string;
  slim?: boolean;

  classNames?: ClassNames;

  /**
   * true: remove ONLY the trigger’s built-in styles.
   * Internal popover/menu retains sane defaults for sizing & alignment.
   */
  unstyled?: boolean;

  /**
   * When true, prevents Radix from auto-focusing inside the popover on open
   * (stops mobile keyboard from appearing until user taps the search box).
   * Default: false
   */
  disableAutoFocusOnOpen?: boolean;

  /**
   * When true, the search input starts readOnly and becomes editable only after
   * user taps/focuses it (extra safeguard for stubborn mobile browsers).
   * Default: false
   */
  searchReadOnlyUntilInteract?: boolean;
}

const CountryDropdownComponent = (
  {
    options = countries.all.filter(
      (country: Country) => country.emoji && country.status !== 'deleted' && country.ioc !== 'PRK',
    ),
    onChange,
    defaultValue,
    disabled = false,
    placeholder = 'Select a country',
    slim = false,
    classNames,
    unstyled = false,
    disableAutoFocusOnOpen = false,
    searchReadOnlyUntilInteract = false,
    ...restTriggerProps
  }: CountryDropdownProps,
  ref: React.ForwardedRef<HTMLButtonElement>,
) => {
  const [open, setOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country | undefined>(undefined);
  const [searchRO, setSearchRO] = useState<boolean>(searchReadOnlyUntilInteract);

  // fast lookup for defaultValue selection
  const optionsMapAlpha3 = useMemo(() => {
    const m = new Map<string, Country>();
    for (const c of options) if (c.alpha3) m.set(c.alpha3.toUpperCase(), c);
    return m;
  }, [options]);

  useEffect(() => {
    if (defaultValue) {
      const initial = optionsMapAlpha3.get(defaultValue.toUpperCase());
      setSelectedCountry(initial);
    } else {
      setSelectedCountry(undefined);
    }
  }, [defaultValue, optionsMapAlpha3]);

  const handleSelect = useCallback(
    (country: Country) => {
      setSelectedCountry(country);
      onChange?.(country);
      setOpen(false);
    },
    [onChange],
  );

  // ⬇︎ unstyled now affects only the TRIGGER.
  const triggerClasses = cn(
    unstyled
      ? undefined
      : `flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input
         bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground
         focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50
         [&>span]:line-clamp-1 autofill:!bg-transparent rounded-3xl`,
    slim === true && !unstyled && 'w-20',
    classNames?.trigger,
  );

  // Keep minimal base sizing for flags even when unstyled=true
  const flagWrapperClasses = cn(
    'inline-flex items-center justify-center w-5 h-5 shrink-0 overflow-hidden rounded-full',
    classNames?.flagWrapper,
  );

  const nameClasses = cn('overflow-hidden text-ellipsis whitespace-nowrap', classNames?.name);

  const chevronClasses = cn('', classNames?.chevron);

  const popoverClasses = cn(
    'min-w-[--radix-popper-anchor-width] p-0 !bg-transparent',
    classNames?.popover,
  );

  const commandClasses = cn(
    'w-full max-h-[200px] sm:max-h-[270px] bg-gray-950 bg-opacity-50 backdrop-blur-2xl',
    classNames?.command,
  );

  const commandListClasses = cn('!text-white bg-gray-950 bg-opacity-50', classNames?.commandList);

  const commandGroupClasses = cn('', classNames?.commandGroup);

  const commandItemClasses = cn(
    'flex items-center w-full gap-2 text-white',
    classNames?.commandItem,
  );

  const commandInputClasses = cn('!text-white !bg-black', classNames?.commandInput);

  const emptyClasses = cn('', classNames?.empty);

  // Helper UI for trigger content
  const TriggerContent = () => {
    if (selectedCountry) {
      return (
        <div
          className={cn('flex items-center gap-2 overflow-hidden', !slim && 'flex-grow min-w-0')}
        >
          {/* fixed-size flag */}
          <div className={flagWrapperClasses}>
            <CircleFlag countryCode={selectedCountry.alpha2.toLowerCase()} height={20} />
          </div>
          {/* show name only when not slim */}
          {slim === false && <span className={nameClasses}>{selectedCountry.name}</span>}
        </div>
      );
    }
    return <span>{slim === false ? placeholder : <Globe size={20} />}</span>;
  };

  return (
    <div className={classNames?.root}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          ref={ref}
          className={triggerClasses}
          disabled={disabled}
          {...restTriggerProps}
        >
          <TriggerContent />
          <ChevronDown size={16} className={chevronClasses} />
        </PopoverTrigger>

        <PopoverContent
          collisionPadding={10}
          side='bottom'
          className={popoverClasses}
          onOpenAutoFocus={(e) => {
            if (disableAutoFocusOnOpen) e.preventDefault();
          }}
        >
          <Command className={commandClasses}>
            <CommandList className={commandListClasses}>
              <div className='sticky top-0 z-10 !text-white !bg-black'>
                <CommandInput
                  className={commandInputClasses}
                  placeholder='Search country...'
                  readOnly={searchRO}
                  onPointerDownCapture={() => searchRO && setSearchRO(false)}
                  onFocus={() => searchRO && setSearchRO(false)}
                />
              </div>

              <CommandEmpty className={emptyClasses}>No country found.</CommandEmpty>

              <CommandGroup className={commandGroupClasses}>
                {options
                  .filter((x) => x.name)
                  .map((option, key: number) => (
                    <CommandItem
                      className={commandItemClasses}
                      key={key}
                      onSelect={() => handleSelect(option)}
                    >
                      <div className='flex items-center gap-2 overflow-hidden flex-1 min-w-0'>
                        <div className={flagWrapperClasses}>
                          <CircleFlag countryCode={option.alpha2.toLowerCase()} height={20} />
                        </div>
                        <span className={nameClasses}>{option.name}</span>
                      </div>
                      <CheckIcon
                        className={cn(
                          'ml-auto h-4 w-4 shrink-0',
                          option.name === selectedCountry?.name ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

CountryDropdownComponent.displayName = 'CountryDropdownComponent';

export const CountryDropdown = forwardRef(CountryDropdownComponent);
