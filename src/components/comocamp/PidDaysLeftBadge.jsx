import React from 'react';
import { daysUntil } from '@/utils/constants';
import { cn } from '@/lib/utils';

/**
 * Displays the number of days left until PID expiry.
 *  - blank expiry → "—" (neutral gray)
 *  - expired (days < 0) → "Expired Nd" (red)
 *  - 0 days → "0d" (red)
 *  - 1–45 days → "Nd" (amber)
 *  - > 45 days → "Nd" (green)
 *
 * The 45-day threshold matches the existing PID Soon logic used on the
 * Master List expiry tabs.
 */
export default function PidDaysLeftBadge({ dateStr }) {
  const days = daysUntil(dateStr);

  if (days === null || days === undefined) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  let cls, label;
  if (days < 0) {
    cls = 'bg-red-100 text-red-700';
    label = `Expired ${Math.abs(days)}d`;
  } else if (days === 0) {
    cls = 'bg-red-100 text-red-700';
    label = '0d';
  } else if (days <= 45) {
    cls = 'bg-amber-100 text-amber-700';
    label = `${days}d`;
  } else {
    cls = 'bg-emerald-100 text-emerald-700';
    label = `${days}d`;
  }

  return (
    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap', cls)}>
      {label}
    </span>
  );
}