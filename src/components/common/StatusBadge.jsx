import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusStyles = {
  'VALID RLIC PASS': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'VALID PID PASS': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'EXPIRED RLIC PASS': 'bg-red-50 text-red-700 border-red-200',
  'EXPIRED PID PASS': 'bg-red-50 text-red-700 border-red-200',
  'SOON TO EXPIRE': 'bg-amber-50 text-amber-700 border-amber-200',
  'NO RLIC PASS': 'bg-slate-100 text-slate-600 border-slate-200',
  'NO PID PASS': 'bg-slate-100 text-slate-600 border-slate-200',
};

const shortLabels = {
  'VALID RLIC PASS': 'Valid',
  'VALID PID PASS': 'Valid',
  'EXPIRED RLIC PASS': 'Expired',
  'EXPIRED PID PASS': 'Expired',
  'SOON TO EXPIRE': 'Soon',
  'NO RLIC PASS': 'No Pass',
  'NO PID PASS': 'No Pass',
};

export default function StatusBadge({ status, short = false }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  
  return (
    <Badge variant="outline" className={cn('text-[10px] font-semibold border', statusStyles[status] || 'bg-muted text-muted-foreground')}>
      {short ? shortLabels[status] || status : status}
    </Badge>
  );
}