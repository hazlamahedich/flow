'use client';

import { useTransition } from 'react';
import { Button } from '@flow/ui';
import { connectCalendar } from './actions/connect-calendar';

export function ConnectCalendarButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await connectCalendar({ accessType: 'read_write' });
      if (result.success && result.data?.oauthUrl) {
        window.location.href = result.data.oauthUrl;
      }
    });
  }

  return (
    <Button type="button" onClick={handleClick} disabled={isPending}>
      {isPending ? 'Connecting...' : 'Connect Google Calendar'}
    </Button>
  );
}
