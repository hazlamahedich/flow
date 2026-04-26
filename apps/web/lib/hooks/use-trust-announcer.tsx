'use client';

import { atom, useSetAtom, useAtomValue } from 'jotai';

interface TrustAnnouncement {
  message: string;
  priority: 'polite' | 'assertive';
}

export const trustAnnouncementAtom = atom<TrustAnnouncement | null>(null);

let announceQueue: TrustAnnouncement[] = [];
let isFlushing = false;

function flushQueue(setAnnouncement: (v: TrustAnnouncement | null) => void) {
  if (announceQueue.length === 0) {
    isFlushing = false;
    return;
  }
  isFlushing = true;
  const next = announceQueue.shift()!;
  setAnnouncement(next);
  setTimeout(() => {
    setAnnouncement(null);
    requestAnimationFrame(() => flushQueue(setAnnouncement));
  }, 150);
}

export function useTrustAnnouncer() {
  const setAnnouncement = useSetAtom(trustAnnouncementAtom);

  return (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announceQueue.push({ message, priority });
    if (!isFlushing) {
      flushQueue(setAnnouncement);
    }
  };
}

export function TrustAnnouncerRegion() {
  const announcement = useAtomValue(trustAnnouncementAtom);

  return (
    <>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement?.priority === 'polite' ? announcement.message : ''}
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement?.priority === 'assertive' ? announcement.message : ''}
      </div>
    </>
  );
}
