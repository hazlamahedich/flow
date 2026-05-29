"use client";

import { useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";

interface ClientHealthBadgeProps {
  health: string | null;
  scores?: {
    engagement: number;
    payment: number;
    communication: number;
  } | null;
}

const COLOR_MAP: Record<string, string> = {
  healthy: "bg-green-500",
  "at-risk": "bg-yellow-500",
  critical: "bg-red-500",
  neutral: "bg-gray-400",
  onboarding: "bg-gray-400",
};

function dotColor(health: string | null): string {
  if (!health) return "bg-gray-400";
  return COLOR_MAP[health] ?? "bg-gray-400";
}

export function ClientHealthBadge({ health, scores }: ClientHealthBadgeProps) {
  const [open, setOpen] = useState(false);

  if (!scores) {
    return (
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor(health)}`}
        aria-label={health ?? "no data"}
      />
    );
  }

  return (
    <Tooltip.Provider>
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger asChild>
          <button
            className={`inline-block h-2.5 w-2.5 rounded-full ${dotColor(health)} cursor-default`}
            aria-label={health ?? "no data"}
          />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
            sideOffset={4}
          >
            <div className="space-y-0.5">
              <div>Engagement: {scores.engagement}</div>
              <div>Payment: {scores.payment}</div>
              <div>Communication: {scores.communication}</div>
            </div>
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
