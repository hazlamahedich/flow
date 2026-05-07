'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export function useMobileTriage() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 767px)').matches);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const openId = searchParams.get('triage_id');

  const openTriage = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('triage_id', id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const closeTriage = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('triage_id');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return {
    isMobile,
    openId,
    openTriage,
    closeTriage,
  };
}
