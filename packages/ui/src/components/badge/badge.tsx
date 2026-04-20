import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-[var(--flow-radius-full)] border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[var(--flow-accent-primary)] text-[var(--flow-accent-primary-text)]',
        secondary: 'border-transparent bg-[var(--flow-bg-surface-raised)] text-[var(--flow-text-secondary)]',
        outline: 'border-[var(--flow-border-default)] text-[var(--flow-text-primary)]',
        success: 'border-transparent bg-[var(--flow-status-success)] text-white',
        warning: 'border-transparent bg-[var(--flow-status-warning)] text-white',
        error: 'border-transparent bg-[var(--flow-status-error)] text-white',
      },
      agent: {
        none: '',
        inbox: 'border-transparent bg-[var(--flow-agent-inbox)]/15 text-[var(--flow-agent-inbox)]',
        calendar: 'border-transparent bg-[var(--flow-agent-calendar)]/15 text-[var(--flow-agent-calendar)]',
        ar: 'border-transparent bg-[var(--flow-agent-ar)]/15 text-[var(--flow-agent-ar)]',
        report: 'border-transparent bg-[var(--flow-agent-report)]/15 text-[var(--flow-agent-report)]',
        health: 'border-transparent bg-[var(--flow-agent-health)]/15 text-[var(--flow-agent-health)]',
        time: 'border-transparent bg-[var(--flow-agent-time)]/15 text-[var(--flow-agent-time)]',
      },
    },
    defaultVariants: {
      variant: 'default',
      agent: 'none',
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, agent, ...props }, ref) => {
    return <div ref={ref} className={cn(badgeVariants({ variant, agent, className }))} {...props} />;
  },
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
