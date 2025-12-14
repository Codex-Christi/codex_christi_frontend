/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useMemo, useState } from 'react';
import en from 'react-phone-number-input/locale/en';
import Image from 'next/image';
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

export default function EditCountry({
  onChange,
  value,
  showLabel = true,
  className,
}: {
  onChange: (e: any) => void;
  value: string | null | number;
  showLabel?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const countries = useMemo(
    () =>
      getCountries()
        .map((code) => ({
          code,
          name: en[code as keyof typeof en],
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const filteredCountries = useMemo(
    () =>
      countries.filter((c) =>
        c.name.toLowerCase().includes(searchTerm.trim().toLowerCase()),
      ),
    [countries, searchTerm],
  );

  const selectedLabel =
    (value && en[value as keyof typeof en]) ||
    (typeof value === 'string' && en[value as keyof typeof en]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className='grid gap-0.5'>
        {showLabel && <p className='text-white/70'>Nationality</p>}

        <PopoverTrigger asChild>
          <button
            className={cn('input flex items-center justify-between gap-4', className)}
            type='button'
            aria-expanded={open}
            aria-haspopup='listbox'
          >
            <span>{selectedLabel ?? 'Select country'}</span>

            <svg width='11' height='8' viewBox='0 0 11 8' fill='none' aria-hidden='true'>
              <path
                d='M10.6876 2.14168C11.0781 1.75115 11.0781 1.11799 10.6876 0.727464C10.2971 0.336939 9.66389 0.336939 9.27336 0.727464L10.6876 2.14168ZM9.27336 0.727464L4.14201 5.85881L5.55623 7.27302L10.6876 2.14168L9.27336 0.727464Z'
                fill='white'
              />
              <path
                d='M1.70711 0.727464C1.31658 0.336939 0.683418 0.336939 0.292893 0.727464C-0.0976311 1.11799 -0.0976311 1.75115 0.292893 2.14168L1.70711 0.727464ZM0.292893 2.14168L4.90396 6.75274L6.31817 5.33853L1.70711 0.727464L0.292893 2.14168Z'
                fill='white'
              />
            </svg>
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
                    onChange(code);
                    setOpen(false);
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
