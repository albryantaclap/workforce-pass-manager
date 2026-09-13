import React from 'react';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut } from 'lucide-react';
import { formatDateTimeCompact } from '@/lib/attendanceUtils';

// Compact date + time display matching the Master List format:
//   DD/MM/YYYY
//   hh:mm AM/PM
function DateTimeDisplay({ iso }) {
  const dt = formatDateTimeCompact(iso);
  if (!dt) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="leading-tight">
      <div className="text-xs font-mono whitespace-nowrap">{dt.date}</div>
      <div className="text-[10px] text-muted-foreground whitespace-nowrap">{dt.time}</div>
    </div>
  );
}

// Camp Check-in column cell. With multiple camp stays:
//  - If an open stay exists → show its check-in date/time (currently inside camp).
//  - Else if editable today → show a Camp Check In / Check In Again button (creates a new stay).
//  - Else if a completed stay exists → show its check-in date/time.
export function CheckInCell({ emp, openRecord, latestRecord, sessionCount, canEdit, isToday, isComoCamp, onCheckIn, onHistory }) {
  if (openRecord) {
    return (
      <div className="flex items-center gap-1">
        <DateTimeDisplay iso={openRecord.check_in_at} />
        {sessionCount > 1 && (
          <button
            type="button"
            onClick={() => onHistory(emp)}
            className="text-[9px] font-semibold px-1 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
            title={`${sessionCount} camp stay(s) — click to view history`}
          >
            {sessionCount}×
          </button>
        )}
      </div>
    );
  }
  if (canEdit && isToday && isComoCamp) {
    return (
      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={() => onCheckIn(emp)}>
        <LogIn className="w-3 h-3" /> {latestRecord ? 'Check In Again' : 'Camp Check In'}
      </Button>
    );
  }
  if (latestRecord) {
    return <DateTimeDisplay iso={latestRecord.check_in_at} />;
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

// Camp Check-out column cell.
//  - If an open stay exists → show Camp Check Out button (editable today) or dash.
//  - Else if a completed stay exists → show its check-out date/time.
export function CheckOutCell({ emp, openRecord, latestRecord, canEdit, isToday, isComoCamp, onCheckOut }) {
  if (openRecord) {
    if (canEdit && isToday && isComoCamp) {
      return (
        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={() => onCheckOut(emp, openRecord)}>
          <LogOut className="w-3 h-3" /> Camp Check Out
        </Button>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (latestRecord && latestRecord.check_out_at) {
    return <DateTimeDisplay iso={latestRecord.check_out_at} />;
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}