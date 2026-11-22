'use client';

import { forwardRef, useState, type AriaAttributes, type FocusEventHandler, type Ref } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Input } from '@/components/UI/primitives/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/UI/primitives/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/primitives/popover';
import { cn } from '@/lib/utils';
import { isUsCountry, normalizeUsState, US_STATE_OPTIONS } from '@/lib/shop/address/usStates';

export type ShippingStateFieldProps = {
  country: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: FocusEventHandler<HTMLInputElement | HTMLButtonElement>;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
  autoComplete?: string;
  'aria-invalid'?: AriaAttributes['aria-invalid'];
  'aria-describedby'?: string;
};

const UsStateCombobox = forwardRef<
  HTMLButtonElement,
  Omit<ShippingStateFieldProps, 'country' | 'placeholder' | 'autoComplete'>
>(function UsStateCombobox(
  { value, onChange, className, name, disabled, required, ...props },
  ref,
) {
  const [open, setOpen] = useState(false);
  const stateCode = normalizeUsState(value);
  const selectedState = US_STATE_OPTIONS.find(({ code }) => code === stateCode);

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      {name && <input type='hidden' name={name} value={stateCode ?? ''} disabled={disabled} />}
      <PopoverTrigger
        {...props}
        ref={ref}
        type='button'
        role='combobox'
        aria-expanded={open}
        aria-required={required}
        disabled={disabled}
        data-placeholder={!selectedState ? '' : undefined}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          'flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-white/35 bg-transparent px-3 py-2 text-left text-base text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <span className={cn('truncate', !selectedState && 'text-white/50')}>
          {selectedState?.name ?? 'Choose a state'}
        </span>
        <ChevronDown className='size-4 shrink-0 opacity-60' aria-hidden='true' />
      </PopoverTrigger>
      <PopoverContent
        align='start'
        collisionPadding={12}
        className='z-[600] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1.5rem)] overflow-hidden border-white/20 bg-zinc-950 p-0 text-white'
      >
        <Command
          defaultValue={stateCode ?? undefined}
          className='max-h-[min(24rem,var(--radix-popover-content-available-height))] bg-zinc-950 text-white [&_[cmdk-input-wrapper]]:border-white/15'
        >
          <CommandInput
            placeholder='Search states...'
            aria-label='Search U.S. states'
            className='text-base text-white placeholder:text-white/50'
          />
          <CommandList className='max-h-64 min-h-0 overscroll-contain'>
            <CommandEmpty>No states found.</CommandEmpty>
            <CommandGroup className='text-white'>
              {US_STATE_OPTIONS.map(({ code, name: stateName }) => (
                <CommandItem
                  key={code}
                  value={code}
                  keywords={[stateName]}
                  onSelect={() => {
                    onChange(code);
                    setOpen(false);
                  }}
                  className='min-h-11 text-base data-[selected=true]:bg-white/15 data-[selected=true]:text-white'
                >
                  <Check
                    className={cn('size-4', stateCode !== code && 'opacity-0')}
                    aria-hidden='true'
                  />
                  {stateName}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});

/** Controlled field only: choosing a state updates the form through its own change handler. */
export const ShippingStateField = forwardRef<
  HTMLInputElement | HTMLButtonElement,
  ShippingStateFieldProps
>(function ShippingStateField(
  {
    country,
    value,
    onChange,
    className,
    placeholder,
    name,
    disabled,
    required,
    autoComplete = 'address-level1',
    ...props
  },
  ref,
) {
  if (!isUsCountry(country))
    return (
      <Input
        {...props}
        name={name}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        ref={ref as Ref<HTMLInputElement>}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? 'State / province'}
        className={className}
      />
    );

  return (
    <UsStateCombobox
      {...props}
      ref={ref as Ref<HTMLButtonElement>}
      name={name}
      disabled={disabled}
      required={required}
      value={value}
      onChange={onChange}
      className={className}
    />
  );
});

ShippingStateField.displayName = 'ShippingStateField';
export default ShippingStateField;
