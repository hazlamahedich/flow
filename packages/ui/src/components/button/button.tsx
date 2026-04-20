import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-[var(--flow-radius-md)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[var(--flow-focus-ring-width)] focus-visible:ring-offset-[var(--flow-focus-ring-offset)] focus-visible:ring-[var(--flow-focus-ring-color)] disabled:pointer-events-none disabled:opacity-[var(--flow-state-disabled-opacity)]',
  {
    variants: {
      variant: {
        default: 'bg-[var(--flow-accent-primary)] text-[var(--flow-accent-primary-text)] hover:brightness-[var(--flow-state-hover-brightness)]',
        destructive: 'bg-[var(--flow-status-error)] text-white hover:brightness-[var(--flow-state-hover-brightness)]',
        outline: 'border border-[var(--flow-border-default)] bg-transparent hover:bg-[var(--flow-state-overlay-hover)]',
        secondary: 'bg-[var(--flow-bg-surface-raised)] text-[var(--flow-text-primary)] hover:brightness-[var(--flow-state-hover-brightness)]',
        ghost: 'hover:bg-[var(--flow-state-overlay-hover)]',
        link: 'text-[var(--flow-accent-primary)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-[var(--flow-radius-sm)] px-3',
        lg: 'h-11 rounded-[var(--flow-radius-lg)] px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
