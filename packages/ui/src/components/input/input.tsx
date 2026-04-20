import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-[var(--flow-radius-md)] border border-[var(--flow-border-default)] bg-transparent px-3 py-2 text-sm text-[var(--flow-text-primary)] placeholder:text-[var(--flow-text-muted)] focus-visible:outline-none focus-visible:ring-[var(--flow-focus-ring-width)] focus-visible:ring-offset-[var(--flow-focus-ring-offset)] focus-visible:ring-[var(--flow-focus-ring-color)] disabled:cursor-not-allowed disabled:opacity-[var(--flow-state-disabled-opacity)]',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
