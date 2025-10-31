/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import en from "react-phone-number-input/locale/en";
import Image from "next/image";
import countryAlphaCodes from 'i18n-iso-countries';
import { getCountries } from "react-phone-number-input/input";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/UI/primitives/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/UI/primitives/popover";

export default function CurrencySelector() {
	const [open, setOpen] = React.useState(false);

	const [selectedCountryName, setSelectedCountryName] = React.useState("");

    const [searchTerm, setSearchTerm] = React.useState("");

	const [value, setValue] = React.useState("");

	const countries = getCountries()
		.map((code) => ({
			code,
			name: en[code as keyof typeof en],
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	const filteredCountries = countries.filter((c) =>
		c.name.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className='grid gap-0.5 fixed right-4 bottom-8 rounded-full bg-[#007AFF]/80'>
        <PopoverTrigger asChild>
          <button className='input border-none flex items-center gap-4 justify-between' type='button'>
            <span>
              {value
                ? String(en[value as keyof typeof en])
                : selectedCountryName
                  ? selectedCountryName
                  : 'Select country'}
            </span>

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
                    setSelectedCountryName(name);

                    setValue(code);

                    setOpen(false);

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
