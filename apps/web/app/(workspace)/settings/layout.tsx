import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
};

const settingsNav = [
  { href: '/settings/profile', label: 'Profile' },
  { href: '/settings/team', label: 'Team' },
  { href: '/settings/devices', label: 'Devices' },
  { href: '/settings/sessions', label: 'Sessions' },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-8 p-6">
      <nav className="w-48 shrink-0 space-y-1">
        {settingsNav.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="block rounded-[var(--flow-radius-sm)] px-3 py-2 text-sm text-[var(--flow-color-text-secondary)] hover:bg-[var(--flow-state-overlay-hover)] hover:text-[var(--flow-color-text-primary)]"
          >
            {item.label}
          </a>
        ))}
      </nav>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
