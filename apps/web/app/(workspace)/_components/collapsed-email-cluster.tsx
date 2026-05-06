'use client';

import { Badge } from '@flow/ui';
import { ChevronRight } from 'lucide-react';

interface ClusterItem {
  emailId: string;
  clientName: string;
  subject: string;
  sender: string;
  category?: 'urgent' | 'action';
  actionTaken?: string;
}

interface CollapsedEmailClusterProps {
  title: string;
  items: ClusterItem[];
  variant: 'attention' | 'handled';
}

export function CollapsedEmailCluster({ title, items, variant }: CollapsedEmailClusterProps) {
  if (items.length === 0) return null;

  const isAttention = variant === 'attention';

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <div className={`h-px flex-1 ${isAttention ? 'bg-destructive/20' : 'bg-green-500/20'} opacity-50`} />
        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isAttention ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
          {title} ({items.length})
        </span>
        <div className={`h-px flex-1 ${isAttention ? 'bg-destructive/20' : 'bg-green-500/20'} opacity-50`} />
      </div>
      
      <div className="divide-y divide-border/40 border rounded-xl overflow-hidden bg-card/50">
        {items.map((item, idx) => (
          <div 
            key={item.emailId ?? idx} 
            className={`group flex items-center justify-between p-2.5 px-4 text-sm transition-colors hover:bg-muted/50 cursor-pointer`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {isAttention && item.category && (
                <Badge variant={item.category === 'urgent' ? 'destructive' : 'outline'} className="text-[8px] h-3.5 px-1 font-black uppercase shrink-0">
                  {item.category[0]}
                </Badge>
              )}
              {!isAttention && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0 opacity-50" />}
              
              <span className="font-bold text-foreground/80 shrink-0 truncate max-w-[120px]">
                {item.clientName}
              </span>
              <span className="text-muted-foreground truncate flex-1">
                {item.subject}
              </span>
            </div>
            
            <div className="flex items-center gap-3 ml-4 shrink-0">
              {item.actionTaken && (
                <span className="text-[9px] font-medium text-muted-foreground/60 italic px-1.5 py-0.5 rounded-full bg-muted">
                  {item.actionTaken}
                </span>
              )}
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
