'use client';

import * as React from 'react';
import en from 'react-phone-number-input/locale/en';
import Image from 'next/image';
import countryAlphaCodes from 'i18n-iso-countries';
import { getCountries } from 'react-phone-number-input/input';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/UI/primitives/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/primitives/popover';
import { GlobeIcon } from 'lucide-react';

export default function CurrencySelector() {
  const [open, setOpen] = React.useState(false);

  const [searchTerm, setSearchTerm] = React.useState('');

  const [value, setValue] = React.useState('');

  const countries = getCountries()
    .map((code) => ({
      name: en[code as keyof typeof en],
      code: code,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className='grid gap-0.5 fixed right-4 font-ocr font-bold bottom-8 lg:bottom-20 rounded-full bg-[#242121c7] backdrop-blur-[10px]
      shadow-md shadow-slate-200 '
      >
        <PopoverTrigger asChild>
          <button
            className='input border-none flex items-center gap-4 justify-between'
            type='button'
            aria-label='Select currency'
          >
            <GlobeIcon />
          </button>
        </PopoverTrigger>
      </div>

      <PopoverContent className='w-full p-0 !z-[500]'>
        <Command className='bg-[#0D0D0DFA] text-white'>
          <CommandInput
            placeholder='Search country...'
            value={searchTerm}
            onValueChange={(val) => setSearchTerm(val)}
          />

          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>

            <CommandGroup>
              {filteredCountries.map(({ code, name }) => (
                <CommandItem
                  className='text-white'
                  key={code}
                  value={name}
                  onSelect={() => {
                    setOpen(false);

                    setValue(code);

                    const getAlpha3Code = countryAlphaCodes.alpha2ToAlpha3(code) ?? 'USA';

                    localStorage.setItem('codex-selected-currency', getAlpha3Code);

                    window.dispatchEvent(new Event('currency-change'));
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 text-black',
                      value === code ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <Image
                    alt={name}
                    src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${code}.svg`}
                    width={16}
                    height={16}
                  />
                  {name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
