import React from 'react';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut } from 'lucide-react';
import { formatTime, getAttendanceStatus, ATT_STATUS } from '@/lib/attendanceUtils';

// Check-in column cell: shows the check-in time, or a Check In button when no
// session exists yet for the selected attendance date.
export function CheckInCell({ emp, record, canEdit, isToday, isComoCamp, onCheckIn }) {
  const status = getAttendanceStatus(record);
  if (status === ATT_STATUS.NOT_CHECKED_IN) {
    if (canEdit && isToday && isComoCamp) {
      return (
        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={() => onCheckIn(emp)}>
          <LogIn className="w-3 h-3" /> Check In
        </Button>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return <span className="text-xs font-mono whitespace-nowrap">{formatTime(record.check_in_at)}</span>;
}

// Check-out column cell: shows the check-out time, or a Check Out button when a
// session is currently open.
export function CheckOutCell({ emp, record, canEdit, isToday, isComoCamp, onCheckOut }) {
  const status = getAttendanceStatus(record);
  if (status === ATT_STATUS.CHECKED_IN) {
    if (canEdit && isToday && isComoCamp) {
      return (
        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={() => onCheckOut(emp, record)}>
          <LogOut className="w-3 h-3" /> Check Out
        </Button>
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (status === ATT_STATUS.CHECKED_OUT) {
    return <span className="text-xs font-mono whitespace-nowrap">{formatTime(record.check_out_at)}</span>;
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}