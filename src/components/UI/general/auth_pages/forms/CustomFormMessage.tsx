'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import { useFormField } from '@/components/ui/form';

const CustomFormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message) : children;

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn('text-sm font-medium text-destructive', className)}
      {...props}
    >
      {body ? body : '\u00A0'}
    </p>
  );
});

CustomFormMessage.displayName = 'CustomFormMessage';

export default CustomFormMessage;
