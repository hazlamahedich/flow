import { getWeeklyAuditCount } from '../agents/approvals/actions/handled-quietly-actions';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';

export async function MorningBriefQuietSummary() {
  const result = await getWeeklyAuditCount();

  if (!result.success || result.data.count === 0) {
    return null;
  }

  const { count } = result.data;

  return (
    <Link
      href="/agents/approvals"
      className="group flex items-center justify-between p-4 rounded-xl border border-[var(--flow-color-gold)]/20 bg-[var(--flow-color-gold)]/[0.02] hover:bg-[var(--flow-color-gold)]/[0.05] transition-colors mt-6"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--flow-color-gold)]/10 text-[var(--flow-color-gold)]">
          <MailCheck className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-[var(--flow-color-text-primary)]">
            Handled Quietly
          </h4>
          <p className="text-xs text-[var(--flow-color-text-secondary)]">
            {count} items handled quietly — review
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--flow-color-gold)] opacity-0 group-hover:opacity-100 transition-opacity">
          Review Audit
        </span>
        <div className="w-6 h-6 rounded-full bg-[var(--flow-color-gold)]/10 flex items-center justify-center text-[var(--flow-color-gold)]">
          <span className="text-xs font-bold">{count}</span>
        </div>
      </div>
    </Link>
  );
}
