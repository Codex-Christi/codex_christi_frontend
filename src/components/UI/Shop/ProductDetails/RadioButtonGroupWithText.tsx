import { useId, type FC } from 'react';
import { Input } from '../../primitives/input';
import { cn } from '@/lib/utils';

interface RadioOption {
  value: string | { name: string; value: string } | null | undefined;
  label: string | undefined;
  key: string;
}

interface RadioButtonGroupProps {
  options: RadioOption[];
  selectedValue?: string | null;
  onChange: (value: string | { name: string; value: string }) => void;
  groupLabel?: string;
  isLoading?: boolean;
}

const RadioButtonGroup: FC<RadioButtonGroupProps> = ({
  options,
  selectedValue,
  onChange,
  groupLabel,
  isLoading = false,
}) => {
  const groupId = useId();
  const groupName = `radio-group-${groupId}`;

  const handleSelect = (prop: RadioOption, radioValue: string | undefined) => {
    if (prop.value != null && radioValue != null) {
      onChange(prop.value);
    }
  };

  return (
    <div
      role='radiogroup'
      aria-label={groupLabel}
      aria-hidden={isLoading || undefined}
      inert={isLoading || undefined}
      className='flex py-3 gap-8 flex-wrap justify-start items-center'
    >
      {options.map((prop) => {
        const radioValue = typeof prop.value === 'string' ? prop.value : prop.value?.value;
        const isSelected = !isLoading && selectedValue === radioValue;
        const isColorValue = radioValue
          ? radioValue.startsWith('#') && radioValue.length === 7
          : false;
        const hexCode = isColorValue ? radioValue : null;
        const contrastColor = hexCode && isLightHexColor(hexCode) ? 'black' : 'white';
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
              disabled={isDisabled || isLoading}
              aria-disabled={isDisabled || isLoading}
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
                  isLoading && 'animate-pulse !border-transparent !bg-white/10 !text-transparent',
                )}
                style={{
                  backgroundColor: hexCode ?? '#fff',
                  color: contrastColor,
                }}
                title={prop.label}
              >
                {isSelected && (
                  <span
                    style={{
                      fontSize: '1.2rem',
                      fontWeight: 'bold',
                      color: contrastColor,
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
                  isLoading && 'animate-pulse !border-transparent !bg-white/10 !text-transparent',
                )}
              >
                {prop.label}
              </label>
            )}

            {isColorValue && prop.label && (
              <span
                className={cn(
                  'mt-1 text-[.7rem] text-center',
                  isLoading && 'invisible',
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

function isLightHexColor(color: string) {
  const hex = color.replace('#', '');
  const red = parseInt(hex.substring(0, 2), 16);
  const green = parseInt(hex.substring(2, 4), 16);
  const blue = parseInt(hex.substring(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 155;
}

export default RadioButtonGroup;
