'use client';

import * as React from 'react';
import en from 'react-phone-number-input/locale/en';
import Locale from 'react-phone-number-input/locale/en';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/UI/primitives/popover';

export default function EditCountry() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState('');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className='grid gap-0.5'>
        <p className='text-white/70'>Nationality</p>

        <PopoverTrigger asChild>
          <button
            className='input flex items-center gap-4 justify-between'
            type='button'
          >
            <span>{value !== '' ? value : 'Select country'}</span>

            <svg width='11' height='8' viewBox='0 0 11 8' fill='none'>
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
          <CommandInput placeholder='Search country...' />

          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>

            <CommandGroup>
              {getCountries().map((country) => (
                <CommandItem
                  className={cn('text-white', {
                    'bg-white text-black': value === country,
                  })}
                  key={country}
                  value={country}
                  onSelect={(currentValue) => {
                    setValue(
                      currentValue === value
                        ? ''
                        : en[currentValue as keyof typeof Locale]
                    );

                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 text-black',
                      value === country ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <Image
                    alt='United States'
                    src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${country}.svg`}
                    width={16}
                    height={16}
                  />

                  {en[country]}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
