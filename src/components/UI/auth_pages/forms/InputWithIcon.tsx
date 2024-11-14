import * as React from 'react';

import { cn } from '@/lib/utils';
import { IconBaseProps, IconType } from 'react-icons/lib';
import { Eye, EyeOff } from 'lucide-react';

type MyIconType =
  | IconType
  | React.ForwardRefExoticComponent<
      IconBaseProps & React.RefAttributes<SVGSVGElement>
    >;

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  startIcon?: MyIconType;
  endIcon?: MyIconType;
  iconProps?: IconBaseProps;
}

type LockIconInterface = IconBaseProps;

const LockIcon: React.FC<LockIconInterface> = (props) => {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='11'
      height='15.682'
      viewBox='-247 -6980.282 11 15.682'
      style={{ WebkitPrintColorAdjust: 'exact' }}
      fill='none'
      version='1.1'
      {...props}
    >
      <g data-testid='Union-28' opacity='1'>
        <path
          fill='#fff'
          d='M-241.5-6980.282a3.73 3.73 0 00-3.725 3.725v2.419A5.49 5.49 0 00-247-6970.1c0 3.03 2.464 5.5 5.5 5.5s5.5-2.47 5.5-5.5a5.49 5.49 0 00-1.775-4.038v-2.419a3.73 3.73 0 00-3.725-3.725zm2.604 5.338a5.459 5.459 0 00-2.604-.656c-.941 0-1.826.236-2.604.656v-1.613c0-1.44 1.17-2.605 2.604-2.605a2.606 2.606 0 012.604 2.605v1.613z'
          className='0'
        ></path>
      </g>
    </svg>
  );
};

// Input With Icon Main Component
const InputWithIcon = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, startIcon, endIcon, iconProps = {}, ...props }, ref) => {
    const [show, setShow] = React.useState(false);
    const StartIcon = startIcon;
    const EndIcon = endIcon;
    const { className: iconClassName, ...iconRest } = iconProps;

    if (type === 'password') {
      return (
        <div className='w-full relative'>
          <div className='absolute left-6 top-1/2 transform -translate-y-1/2'>
            <LockIcon
              size={18}
              className={cn('text-white/75', iconClassName)}
              {...iconRest}
            />
          </div>
          <input
            autoComplete='off'
            type={!show ? type : 'text'}
            className={cn(
              `flex h-10 w-full rounded-md border border-input bg-background py-2 
              px-14 text-sm ring-offset-background file:border-0 file:bg-transparent 
              file:text-sm file:font-medium focus-visible:outline-none 
              focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 
              disabled:cursor-not-allowed disabled:opacity-50
              } ${className}`
            )}
            ref={ref}
            {...props}
          />
          <button
            onClick={() => setShow((prev) => !prev)}
            className='absolute right-3 top-1/2 transform -translate-y-1/2'
            type='button'
          >
            {show ? (
              <Eye className='stroke-white/75' size={18} />
            ) : (
              <EyeOff className='stroke-white/75' size={18} />
            )}
          </button>
        </div>
      );
    }

    return (
      <div className='w-full relative'>
        {StartIcon && (
          <div className='absolute left-6 top-1/2 transform -translate-y-1/2'>
            <StartIcon size={18} className='text-white/75' />
          </div>
        )}
        <input
          type={type}
          className={cn(
            `peer flex h-10 w-full rounded-md border border-input bg-background py-2 px-4 
            text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm 
            file:font-medium focus-visible:outline-none focus-visible:ring-1 
            focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed 
            disabled:opacity-50 ${startIcon ? 'pl-14' : ''} ${
              endIcon ? 'pr-8' : ''
            } ${className}`
          )}
          ref={ref}
          {...props}
        />
        {EndIcon && (
          <div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
            <EndIcon className='text-white/75' size={18} />
          </div>
        )}
      </div>
    );
  }
);
InputWithIcon.displayName = 'InputWithIcon';

export { InputWithIcon };
