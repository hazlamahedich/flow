'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@flow/ui';

interface RegenerateButtonProps {
  reportId: string;
  expectedVersion: number;
  role: string;
  status: string;
}

export function RegenerateButton({ reportId, expectedVersion, role, status }: RegenerateButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const canRegenerate = ['owner', 'admin'].includes(role);
  const isDraft = status === 'draft';

  async function handleClick() {
    if (!canRegenerate) {
      toast.error('Contact workspace owner');
      return;
    }

    setIsPending(true);
    try {
      const { regenerateWeeklyReportAction } = await import('@/lib/actions/reports/regenerate-weekly-report');
      const result = await regenerateWeeklyReportAction({ reportId, expectedVersion });

      if (!result.success) {
        const err = result.error;
        if (err.code === 'CONCURRENT_MODIFICATION') {
          toast.error('This report was modified by another user. Please refresh and try again.');
        } else if (err.code === 'NOT_FOUND') {
          toast.error('Report no longer exists.');
          router.push('/reports');
        } else if (err.code === 'INTERNAL_ERROR') {
          toast.error('Failed to regenerate report. Please try again.');
        } else {
          toast.error('Failed to regenerate report. Please try again.');
        }
        setIsPending(false);
        return;
      }

      const { report } = result.data;

      if (isDraft) {
        toast.success('Report regenerated with latest data');
        router.refresh();
      } else {
        toast.success(`New version created (v${report.version})`);
        router.push(`/reports/${report.id}`);
      }
    } catch {
      toast.error('Failed to regenerate report. Please try again.');
      setIsPending(false);
    }
  }

  if (!canRegenerate) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        title="Contact workspace owner"
        aria-label="Regenerate report (contact workspace owner)"
      >
        Regenerate
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      aria-label={isPending ? 'Regenerating report' : 'Regenerate report'}
    >
      {isPending ? 'Regenerating...' : 'Regenerate'}
    </Button>
  );
}
