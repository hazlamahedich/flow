"use client";

import { useEffect, useRef } from "react";
import { markBriefViewed } from "../actions/morning-brief";

interface MorningBriefTrackerProps {
  briefId: string;
}

export function MorningBriefTracker({ briefId }: MorningBriefTrackerProps) {
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;

    markBriefViewed(briefId).catch((err) => {
      console.error("Failed to mark brief as viewed:", err);
    });
  }, [briefId]);

  return null;
}
