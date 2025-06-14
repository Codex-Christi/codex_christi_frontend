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

const RadioButtonGroup: React.FC<RadioButtonGroupProps> = ({
  props,
  onChange,
}) => {
  const [selectedValue, setSelectedValue] = React.useState<
    string | undefined
  >();

  // Hooks
  const { currentVariantOptions } = useCurrentVariant();

  // useEffect
  useEffect(() => {
    const isMatchingVariantsAvailable = currentVariantOptions.some(
      (elem) => elem != null && elem !== undefined && elem.value.length > 0
    );
    if (!isMatchingVariantsAvailable) {
      setSelectedValue(undefined);
    }
  }, [currentVariantOptions]);

  // JSX
  return (
    <div className='flex py-3 gap-8 flex-wrap justify-start items-center'>
      {props.map((prop) => {
        const radioValue =
          typeof prop.value === 'string' ? prop.value : prop.value?.value;

        const isSelected = selectedValue === radioValue;
        const isColorValue = radioValue
          ? radioValue.startsWith('#') && radioValue.length === 7
          : false;
        const hexCode = isColorValue ? radioValue : null; // Default color if not a hex code

        // Each radio button is wrapped in a div for styling
        // JSX Starts here
        return (
          <div key={radioValue} className=''>
            <Input
              className='bg-transparent w-0 h-0 invisible'
              type='radio'
              id={radioValue}
              name='radio-group' // Use the same name for all radio buttons in the group
              value={radioValue}
              checked={isSelected}
              onChange={() => {
                if (prop.value != null) {
                  setSelectedValue(radioValue);
                  if (typeof prop.value === 'string') {
                    // Handle string value
                    // You can add any specific logic here if needed
                    onChange(prop.value);
                  } else {
                    // Handle object value
                    // You can add any specific logic here if needed
                    onChange(prop.value);
                  }
                }
              }}
            />
            <label
              className={cn(
                'text-[1rem] border px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-500',
                isSelected &&
                  !isColorValue &&
                  `bg-gray-600 text-white border-[2.5px] font-extrabold border-gray-600 
                  hover:bg-gray-600 shadow-gray-200 shadow-md hover:text-white font-ocr`,
                isColorValue &&
                  isSelected &&
                  `text-white border-[2.5px] font-extrabold shadow-gray-200 shadow-md
                  font-ocr hover:text-white`
              )}
              style={
                isColorValue && isSelected && hexCode
                  ? {
                      backgroundColor: hexCode,
                      borderColor: hexCode,
                      color: hex_is_light(hexCode) ? 'black' : 'white',
                    }
                  : undefined
              }
              htmlFor={radioValue}
            >
              {isColorValue && prop.label
                ? prop.label?.slice(0, 1).toUpperCase() +
                  prop.label?.slice(1).toLowerCase()
                : prop.label}
            </label>
          </div>
        );
      })}
    </div>
  );
};

function hex_is_light(color: string) {
  const hex = color.replace('#', '');
  const c_r = parseInt(hex.substring(0, 0 + 2), 16);
  const c_g = parseInt(hex.substring(2, 2 + 2), 16);
  const c_b = parseInt(hex.substring(4, 4 + 2), 16);
  const brightness = (c_r * 299 + c_g * 587 + c_b * 114) / 1000;
  return brightness > 155;
}

export default RadioButtonGroup;
