import React from 'react';
import { Input } from '@/components/ui/input';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { id: 'all', label: 'All Attendance' },
  { id: 'checked_in', label: 'Checked In' },
  { id: 'checked_out', label: 'Checked Out' },
  { id: 'not_checked_in', label: 'Not Checked In' },
];

export default function AttendanceFilterBar({ attendanceDate, setAttendanceDate, attendanceStatus, setAttendanceStatus }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          type="date"
          value={attendanceDate}
          onChange={(e) => setAttendanceDate(e.target.value)}
          className="pl-7 h-8 w-[160px] text-xs"
        />
      </div>
      <span className="text-[11px] font-medium text-muted-foreground">Attendance:</span>
      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg">
        {STATUS_OPTIONS.map(o => (
          <button
            key={o.id}
            type="button"
            onClick={() => setAttendanceStatus(o.id)}
            className={cn(
              'px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap',
              attendanceStatus === o.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}