export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--flow-color-bg-primary)]">
      <div className="border-b border-[var(--flow-color-border-default)] px-4 py-2">
        <p className="text-sm text-[var(--flow-color-text-tertiary)]">Client Portal</p>
      </div>
      {children}
    </div>
  );
}
