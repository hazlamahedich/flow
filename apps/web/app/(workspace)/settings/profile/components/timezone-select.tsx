'use client';

import { useMemo, useState, useId } from 'react';
import { getTimezones } from '@flow/types';

interface TimezoneSelectProps {
  value: string;
  onChange: (value: string) => void;
}

interface TimezoneEntry {
  value: string;
  label: string;
}

function getTimezoneOffset(tz: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(new Date());
    const offsetPart = parts.find((p) => p.type === 'timeZoneName');
    return offsetPart?.value ?? '';
  } catch {
    return '';
  }
}

export function TimezoneSelect({ value, onChange }: TimezoneSelectProps) {
  const [search, setSearch] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const listId = useId();

  const timezones = useMemo<TimezoneEntry[]>(() => {
    const tzList = getTimezones();
    if (tzList.length === 0) {
      return [{ value: value || 'UTC', label: value || 'UTC' }];
    }
    return tzList.map((tz) => ({
      value: tz,
      label: `${tz} (${getTimezoneOffset(tz)})`,
    }));
  }, [value]);

  const filtered = useMemo(() => {
    if (!search.trim()) return timezones.slice(0, 50);
    const q = search.toLowerCase();
    return timezones.filter((tz) => tz.value.toLowerCase().includes(q) || tz.label.toLowerCase().includes(q)).slice(0, 50);
  }, [timezones, search]);

  return (
    <div className="space-y-1">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search timezones..."
        className="flex h-10 w-full rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border-default)] bg-transparent px-3 py-2 text-sm text-[var(--flow-color-text-primary)] placeholder:text-[var(--flow-color-text-muted)] focus-visible:outline-none focus-visible:ring-[var(--flow-focus-ring-width)] focus-visible:ring-offset-[var(--flow-focus-ring-offset)] focus-visible:ring-[var(--flow-focus-ring-color)]"
        role="combobox"
        aria-expanded={isExpanded}
        aria-controls={listId}
        onFocus={() => setIsExpanded(true)}
        onBlur={() => setIsExpanded(false)}
      />
      <select
        id={listId}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setSearch('');
        }}
        size={5}
        className="flex w-full rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border-default)] bg-transparent px-3 py-2 text-sm text-[var(--flow-color-text-primary)] focus-visible:outline-none focus-visible:ring-[var(--flow-focus-ring-width)] focus-visible:ring-offset-[var(--flow-focus-ring-offset)] focus-visible:ring-[var(--flow-focus-ring-color)]"
      >
        {filtered.map((tz) => (
          <option key={tz.value} value={tz.value}>
            {tz.label}
          </option>
        ))}
      </select>
    </div>
  );
}
