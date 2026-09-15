import React from 'react';
import { computeQidStatus, formatDate } from '@/utils/constants';
import { cn } from '@/lib/utils';

/**
 * Displays the QID Expiry date as a color-coded badge.
 *  - No expiry date → "—" (neutral gray)
 *  - Expired (days < 0) → red badge
 *  - 0–45 days → amber badge (Soon to Expire)
 *  - > 45 days → green badge (Valid)
 *
 * Uses the same 45-day monitoring window as the workforce system.
 * Visual style matches the existing PID Status / PID Days Left badges.
 */
const STATUS_STYLES = {
  'VALID QID': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'SOON TO EXPIRE': 'bg-amber-50 text-amber-700 border-amber-200',
  'EXPIRED QID': 'bg-red-50 text-red-700 border-red-200',
  'NO QID EXPIRY': 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function QidExpiryBadge({ dateStr }) {
  if (!dateStr) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const status = computeQidStatus(dateStr);
  const cls = STATUS_STYLES[status] || STATUS_STYLES['NO QID EXPIRY'];

  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-mono font-semibold whitespace-nowrap', cls)}>
      {formatDate(dateStr)}
    </span>
  );
}