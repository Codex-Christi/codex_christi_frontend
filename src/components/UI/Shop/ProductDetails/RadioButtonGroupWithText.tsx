import React, { useEffect, useId } from 'react';
import { Input } from '../../primitives/input';
import { cn } from '@/lib/utils';
import { useCurrentVariant } from './currentVariantStore';

interface RadioOption {
  value: string | { name: string; value: string } | null | undefined;
  label: string | undefined;
  key: string;
}

interface RadioButtonGroupProps {
  /** The list of radio options to render */
  props: RadioOption[];
  /** Called when selection changes (native radio change) */
  onChange: (value: string | { name: string; value: string }) => void;
  /** Optional accessible name for the radio group */
  groupLabel?: string;
}

const RadioButtonGroup: React.FC<RadioButtonGroupProps> = ({ props, onChange, groupLabel }) => {
  const [selectedValue, setSelectedValue] = React.useState<string | undefined>();
  const groupId = useId();
  const groupName = `radio-group-${groupId}`;

  // Hooks
  const { currentVariantOptions } = useCurrentVariant();

  // useEffect
  useEffect(() => {
    // currentVariantOptions is now a map of attributeName -> selectedValue (string | null)
    // We clear the local selection when there are no active selections in the store.
    const hasAnySelection = Object.values(currentVariantOptions).some(
      (value) => value !== null && value !== '',
    );

    if (!hasAnySelection) {
      setSelectedValue(undefined);
    }
  }, [currentVariantOptions]);

  // Helpers
  const handleSelect = (prop: RadioOption, radioValue: string | undefined, scroll = false) => {
    if (prop.value != null && radioValue != null) {
      setSelectedValue(radioValue);
      onChange(prop.value);
      if (scroll) scrollToSection('mainGallery');
    }
  };

  // JSX
  return (
    <div
      role='radiogroup'
      aria-label={groupLabel}
      className='flex py-3 gap-8 flex-wrap justify-start items-center'
    >
      {props.map((prop) => {
        const radioValue = typeof prop.value === 'string' ? prop.value : prop.value?.value;
        const isSelected = selectedValue === radioValue;
        const isColorValue = radioValue
          ? radioValue.startsWith('#') && radioValue.length === 7
          : false;
        const hexCode = isColorValue ? radioValue : null;
        const inputId = `radio-${groupId}-${prop.key}`;
        const labelId = `radio-label-${groupId}-${prop.key}`;
        const isDisabled = prop.value == null || radioValue == null;

        return (
          <div key={prop.key} className='flex flex-col items-center'>
            {/* Native radio controls keyboard behavior (arrow keys, space, tab). Keep it visible to AT via sr-only. */}
            <Input
              className='sr-only peer'
              type='radio'
              id={inputId}
              name={groupName}
              value={radioValue ?? ''}
              checked={!!isSelected}
              onChange={() => handleSelect(prop, radioValue)}
              aria-labelledby={labelId}
              disabled={isDisabled}
              aria-disabled={isDisabled}
            />

            {isColorValue ? (
              <label
                id={labelId}
                htmlFor={inputId}
                aria-disabled={isDisabled}
                className={cn(
                  'w-6 h-6 rounded-full border-2 cursor-pointer flex items-center justify-center transition-all',
                  'focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-black',
                  isDisabled && 'opacity-40 cursor-not-allowed',
                  isSelected ? 'border-black ring-2 ring-black scale-150' : 'border-gray-300',
                )}
                style={{
                  backgroundColor: hexCode ?? '#fff',
                  color: hex_is_light(hexCode ?? '#fff') ? 'black' : 'white',
                }}
                title={prop.label}
              >
                {isSelected && (
                  <span
                    style={{
                      fontSize: '1.2rem',
                      fontWeight: 'bold',
                      color: hex_is_light(hexCode ?? '#fff') ? 'black' : 'white',
                    }}
                  >
                    ✓
                  </span>
                )}
              </label>
            ) : (
              <label
                id={labelId}
                htmlFor={inputId}
                aria-disabled={isDisabled}
                className={cn(
                  '!text-[.8rem] font-semibold border px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-500',
                  'focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-black',
                  isDisabled && 'opacity-40 cursor-not-allowed',
                  isSelected &&
                    `bg-gray-600 text-white border-[2.5px] font-extrabold border-gray-600 
                    hover:bg-gray-600 shadow-gray-200 shadow-md hover:text-white font-ocr`,
                )}
              >
                {prop.label}
              </label>
            )}

            {isColorValue && prop.label && (
              <span
                className={cn(
                  'mt-1 text-[.7rem] text-center',
                  isSelected ? 'scale-125 font-semibold font-ocr' : '',
                )}
              >
                {prop.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

function hex_is_light(color: string) {
  const hex = color.replace('#', '');
  const c_r = parseInt(hex.substring(0, 2), 16);
  const c_g = parseInt(hex.substring(2, 4), 16);
  const c_b = parseInt(hex.substring(4, 6), 16);
  const brightness = (c_r * 299 + c_g * 587 + c_b * 114) / 1000;
  return brightness > 155;
}

const scrollToSection = (id: string) => {
  const element = document.getElementById(id);
  if (element && typeof window !== 'undefined') {
    element.scrollIntoView({ behavior: 'smooth' });
  }
};

export default RadioButtonGroup;
