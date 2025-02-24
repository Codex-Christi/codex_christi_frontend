import React from 'react';
import clsx from 'clsx';

interface DividerProps {
  horizontal?: boolean;
  vertical?: boolean;
  className?: string;
  thickness?: string; // e.g., "2px"
  color?: string; // Tailwind border color classes
  dashed?: boolean;
  length?: string; // Width for horizontal, height for vertical
  text?: string; // Optional text in center
  component?: React.ReactNode; // Accepts a React component instead of text
}

const Divider: React.FC<DividerProps> = (props) => {
  const {
    thickness = '1px',
    color = 'border-gray-300',
    dashed = false,
    length,
    text,
    component,
  } = props;

  // Check if `horizontal` or `vertical` was explicitly passed (even if undefined)
  const hasHorizontal = Object.prototype.hasOwnProperty.call(
    props,
    'horizontal'
  );
  const hasVertical = Object.prototype.hasOwnProperty.call(props, 'vertical');

  const isHorizontal = hasHorizontal || !hasVertical; // Default to horizontal if neither is explicitly set

  return (
    <div
      className={clsx(
        'flex items-center justify-center relative',
        isHorizontal ? 'w-full flex-row' : 'h-[inherit] flex-col',
        'flex'
      )}
      style={
        isHorizontal
          ? { width: length || '100%' }
          : { height: length || 'inherit' }
      }
    >
      <span
        className={clsx(
          isHorizontal ? 'flex-1 border-t' : 'h-full border-l',
          color,
          dashed ? 'border-dashed' : 'border-solid'
        )}
        style={{ borderWidth: thickness }}
      />
      {(text || component) && (
        <span
          className={clsx(
            'mx-4 text-gray-600',
            isHorizontal ? 'px-2' : 'py-2 rotate-90'
          )}
        >
          {component || text}
        </span>
      )}
      <span
        className={clsx(
          isHorizontal ? 'flex-1 border-t' : 'h-full border-l',
          color,
          dashed ? 'border-dashed' : 'border-solid'
        )}
        style={{ borderWidth: thickness }}
      />
    </div>
  );
};

export default Divider;
