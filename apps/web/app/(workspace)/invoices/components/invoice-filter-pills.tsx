'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'voided', label: 'Voided' },
  { key: 'with_credit', label: 'With Credit' },
] as const;

export function InvoiceFilterPills({ activeFilter }: { activeFilter: string }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-1" role="tablist" aria-label="Invoice filters">
      {FILTERS.map(({ key, label }) => {
        const isActive = activeFilter === key;
        return (
          <Link
            key={key}
            href={key === 'active' ? pathname : `${pathname}?filter=${key}`}
            role="tab"
            aria-selected={isActive}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
