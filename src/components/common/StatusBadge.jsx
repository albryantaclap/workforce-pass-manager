import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { computePassStatus } from '@/utils/constants';

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

// If dateStr + type provided, status is computed from date (authoritative), with storedStatus for custom overrides.
// Otherwise falls back to the stored status value.
export default function StatusBadge({ status, dateStr, type, storedStatus, short = false }) {
  const resolved = dateStr && type
    ? computePassStatus(dateStr, type, storedStatus)
    : (storedStatus || status);

  if (!resolved) return <span className="text-xs text-muted-foreground">—</span>;

  const style = statusStyles[resolved] || 'bg-blue-50 text-blue-700 border-blue-200';
  const label = short ? (shortLabels[resolved] || resolved) : resolved;

  return (
    <Badge variant="outline" className={cn('text-[10px] font-semibold border', style)}>
      {label}
    </Badge>
  );
}