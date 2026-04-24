import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Settings',
};

const settingsTabs = [
  { href: '/settings/profile', label: 'Profile' },
  { href: '/settings/team', label: 'Team' },
  { href: '/settings/agents', label: 'Agents' },
  { href: '/settings/devices', label: 'Devices' },
  { href: '/settings/sessions', label: 'Sessions' },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="p-6">
      <nav
        aria-label="Settings navigation"
        className="mb-6 flex gap-1 border-b border-[var(--flow-color-border-default)]"
      >
        {settingsTabs.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="border-b-2 border-transparent px-3 py-2 text-sm text-[var(--flow-color-text-secondary)] transition-colors hover:border-[var(--flow-color-border-default)] hover:text-[var(--flow-color-text-primary)]"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div>{children}</div>
    </div>
  );
}
