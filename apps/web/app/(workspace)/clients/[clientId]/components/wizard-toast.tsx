'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface WizardToastProps {
  code: string;
  message: string;
  linkLabel?: string | undefined;
  linkHref?: string | undefined;
}

export function WizardToast({ message, linkLabel, linkHref }: WizardToastProps) {
  const [visible, setVisible] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      const next = new URLSearchParams(searchParams.toString());
      next.delete('toast_code');
      next.delete('toast_msg');
      next.delete('toast_link_label');
      next.delete('toast_link_href');
      const suffix = next.toString();
      router.replace(window.location.pathname + (suffix ? `?${suffix}` : ''), { scroll: false });
    }, 6000);
    return () => clearTimeout(timer);
  }, [searchParams, router]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-md bg-[var(--flow-color-bg-success)] px-4 py-3 text-sm text-[var(--flow-color-text-primary)]"
    >
      <span>{message}</span>
      {linkLabel && linkHref && (
        <a href={linkHref} className="font-medium underline">{linkLabel}</a>
      )}
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="ml-auto text-[var(--flow-color-text-tertiary)]"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
