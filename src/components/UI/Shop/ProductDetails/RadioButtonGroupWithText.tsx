import React, { useEffect } from 'react';
import { Input } from '../../primitives/input';
import { cn } from '@/lib/utils';
import { useCurrentVariant } from './currentVariantStore';

interface RadioOption {
  value: string | { name: string; value: string } | null | undefined;
  label: string | undefined;
  key: string;
}

interface RadioButtonGroupProps {
  props: RadioOption[];
  onChange: (value: string | { name: string; value: string }) => void;
}

const RadioButtonGroup: React.FC<RadioButtonGroupProps> = ({ props, onChange }) => {
  const [selectedValue, setSelectedValue] = React.useState<string | undefined>();

  // Hooks
  const { currentVariantOptions } = useCurrentVariant();

  // useEffect
  useEffect(() => {
    const isMatchingVariantsAvailable = currentVariantOptions.some(
      (elem) => elem != null && elem !== undefined && elem.value.length > 0,
    );
    if (!isMatchingVariantsAvailable) {
      setSelectedValue(undefined);
    }
  }, [currentVariantOptions]);

  // JSX
  return (
    <div className='flex py-3 gap-8 flex-wrap justify-start items-center'>
      {props.map((prop) => {
        const radioValue = typeof prop.value === 'string' ? prop.value : prop.value?.value;
        const isSelected = selectedValue === radioValue;
        const isColorValue = radioValue
          ? radioValue.startsWith('#') && radioValue.length === 7
          : false;
        const hexCode = isColorValue ? radioValue : null;

        return (
          <div key={radioValue} className='flex flex-col items-center'>
            <Input
              className='bg-transparent w-0 h-0 invisible'
              type='radio'
              id={radioValue}
              name='radio-group'
              value={radioValue}
              checked={isSelected}
              onChange={() => {
                if (prop.value != null) {
                  setSelectedValue(radioValue);
                  onChange(prop.value);
                }
              }}
            />
            {isColorValue ? (
              <label
                onClick={() => scrollToSection('mainGallery')}
                htmlFor={radioValue}
                className={cn(
                  'w-6 h-6 rounded-full border-2 cursor-pointer flex items-center justify-center transition-all',
                  isSelected ? 'border-black ring-2 ring-black scale-150' : 'border-gray-300',
                )}
                style={{
                  backgroundColor: hexCode ?? '#fff',
                  color: hex_is_light(hexCode ?? '#fff') ? 'black' : 'white',
                }}
                title={prop.label}
              >
                {/* Optional: show checkmark if selected */}
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
                className={cn(
                  '!text-[.8rem] font-semibold border px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-500',
                  isSelected &&
                    `bg-gray-600 text-white border-[2.5px] font-extrabold border-gray-600 
                    hover:bg-gray-600 shadow-gray-200 shadow-md hover:text-white font-ocr`,
                )}
                htmlFor={radioValue}
              >
                {prop.label}
              </label>
            )}
            {/* Optional: show color name below swatch */}
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
  console.log(element);

  if (element && typeof window !== 'undefined') {
    element.scrollIntoView({ behavior: 'smooth' }); // 'smooth' for animated scroll
  }
};

export default RadioButtonGroup;
