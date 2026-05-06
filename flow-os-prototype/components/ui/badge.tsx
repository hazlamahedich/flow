import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "flow" | "success" | "warn" | "danger" | "violet" | "cyan";

const tones: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-200",
  flow: "bg-flow-50 text-flow-700 ring-flow-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warn: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
        tones[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
