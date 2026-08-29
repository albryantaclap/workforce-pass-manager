import React from 'react';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut } from 'lucide-react';
import { formatTime } from '@/lib/attendanceUtils';

// Check-in column cell. With multiple sessions per day:
//  - If an open session exists → show its check-in time (currently inside).
//  - Else if editable today → show a Check In / Check In Again button (creates a new session).
//  - Else if a completed session exists → show its check-in time.
export function CheckInCell({ emp, openRecord, latestRecord, sessionCount, canEdit, isToday, isComoCamp, onCheckIn, onHistory }) {
  if (openRecord) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs font-mono whitespace-nowrap">{formatTime(openRecord.check_in_at)}</span>
        {sessionCount > 1 && (
          <button
            type="button"
            onClick={() => onHistory(emp)}
            className="text-[9px] font-semibold px-1 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
            title={`${sessionCount} session(s) today — click to view history`}
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
        <LogIn className="w-3 h-3" /> {latestRecord ? 'Check In Again' : 'Check In'}
      </Button>
    );
  }
  if (latestRecord) {
    return <span className="text-xs font-mono whitespace-nowrap">{formatTime(latestRecord.check_in_at)}</span>;
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

// Check-out column cell.
//  - If an open session exists → show Check Out button (editable today) or dash.
//  - Else if a completed session exists → show its check-out time.
export function CheckOutCell({ emp, openRecord, latestRecord, canEdit, isToday, isComoCamp, onCheckOut }) {
  if (openRecord) {
    if (canEdit && isToday && isComoCamp) {
      return (
        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={() => onCheckOut(emp, openRecord)}>
          <LogOut className="w-3 h-3" /> Check Out
        </Button>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (latestRecord && latestRecord.check_out_at) {
    return <span className="text-xs font-mono whitespace-nowrap">{formatTime(latestRecord.check_out_at)}</span>;
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}