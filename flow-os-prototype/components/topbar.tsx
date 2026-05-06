"use client";

import { Search, Bell, HelpCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-ink-100">
      <div className="px-6 py-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-ink-900 truncate">{title}</h1>
          {subtitle && <p className="text-xs text-ink-500 mt-0.5 truncate">{subtitle}</p>}
        </div>

        <div className="hidden lg:flex items-center gap-2 w-80 rounded-lg border border-ink-200 bg-white px-3 h-9 text-sm text-ink-500">
          <Search size={14} />
          <input
            placeholder="Search clients, invoices, emails…"
            className="flex-1 bg-transparent outline-none text-ink-800 placeholder:text-ink-400"
          />
          <kbd className="text-[10px] rounded bg-ink-100 px-1.5 py-0.5 text-ink-500">⌘ K</kbd>
        </div>

        <Button variant="ghost" size="icon" aria-label="Help">
          <HelpCircle size={16} />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell size={16} />
        </Button>
        <Button variant="primary" size="md">
          <Plus size={14} /> New
        </Button>
      </div>
    </header>
  );
}
