import React from 'react';
import { Card } from '@/components/ui/card';
import { format, differenceInDays, parseISO } from 'date-fns';
import { AlertTriangle, Clock } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';

export default function ExpiryTimeline({ employees }) {
  const today = new Date();

  const upcoming = employees
    .filter((emp) => emp.qid_expiry)
    .map((emp) => {
      const expiry = parseISO(emp.qid_expiry);
      const daysLeft = differenceInDays(expiry, today);
      return { ...emp, daysLeft, expiryDate: expiry };
    })
    .filter((emp) => emp.daysLeft <= 90)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 8);

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        QID Expiring Soon (within 90 days)
      </h3>
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No QIDs expiring within 90 days</p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {upcoming.map((emp) => (
            <div key={emp.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">{emp.name}</p>
                <p className="text-xs text-muted-foreground">{emp.company} · {emp.designation_org_chart}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs">
                  <Clock className="w-3 h-3" />
                  <span className={emp.daysLeft < 0 ? 'text-red-600 font-semibold' : emp.daysLeft < 30 ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}>
                    {emp.daysLeft < 0 ? `${Math.abs(emp.daysLeft)}d overdue` : `${emp.daysLeft}d left`}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(emp.expiryDate, 'dd MMM yyyy')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}