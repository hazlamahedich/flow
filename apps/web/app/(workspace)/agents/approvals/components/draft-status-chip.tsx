import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@flow/ui';
import { Check, X, Clock, Edit3 } from 'lucide-react';

const chipVariants = cva(
  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
  {
    variants: {
      status: {
        pending: "bg-amber-50 text-amber-700 border-amber-200",
        approved: "bg-green-50 text-green-700 border-green-200",
        rejected: "bg-red-50 text-red-700 border-red-200",
        edited: "bg-blue-50 text-blue-700 border-blue-200",
      },
    },
    defaultVariants: {
      status: "pending",
    },
  }
);

const iconMap = {
  pending: Clock,
  approved: Check,
  rejected: X,
  edited: Edit3,
};

interface DraftStatusChipProps extends VariantProps<typeof chipVariants> {
  className?: string;
}

export function DraftStatusChip({ status: statusProp = "pending", className }: DraftStatusChipProps) {
  const status = statusProp ?? "pending";
  const Icon = iconMap[status as keyof typeof iconMap] || Clock;

  return (
    <div className={cn(chipVariants({ status }), className)}>
      <Icon className="w-3 h-3" />
      <span>{status}</span>
    </div>
  );
}
