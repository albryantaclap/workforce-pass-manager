import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, BadgeCheck, ChevronRight } from 'lucide-react';
import { formatDate } from '@/utils/constants';
import { differenceInDays } from 'date-fns';

function DaysChip({ expiryDate, expired }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(expiryDate); d.setHours(0, 0, 0, 0);
  const diff = differenceInDays(d, today);
  if (expired) {
    const days = Math.abs(diff);
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700">{days}d ago</span>;
  }
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{diff}d left</span>;
}

function ExpiryRow({ emp, expiryDateField, expired }) {
  const expiryDate = emp[expiryDateField];
  const name = emp.name || '—';
  const qid = emp.qid_no || '';
  const company = emp.company || '';
  const dept = emp.department || '';
  const position = emp.designation_org_chart || emp.position_application || '';

  return (
    <div className="py-3 px-4 border-b last:border-b-0 hover:bg-muted/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-xs text-foreground">{name}</span>
            {qid && <span className="text-[10px] text-muted-foreground">QID: {qid}</span>}
          </div>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {company && <span className="text-[10px] text-muted-foreground font-medium">{company}</span>}
            {dept && <><span className="text-[10px] text-muted-foreground">·</span><span className="text-[10px] text-muted-foreground">{dept}</span></>}
            {position && <><span className="text-[10px] text-muted-foreground">·</span><span className="text-[10px] text-muted-foreground truncate max-w-[130px]">{position}</span></>}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Expiry:</span>
            <span className="text-[10px] font-medium text-foreground">{expiryDate ? formatDate(expiryDate) : '—'}</span>
            {expiryDate && <DaysChip expiryDate={expiryDate} expired={expired} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpiryCard({ label, icon: Icon, color, bg, borderColor, employees, expiryDateField, expired, sortDir }) {
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    return [...employees].sort((a, b) => {
      const da = new Date(a[expiryDateField] || 0);
      const db = new Date(b[expiryDateField] || 0);
      return sortDir === 'asc' ? da - db : db - da;
    });
  }, [employees, expiryDateField, sortDir]);

  const displayed = showAll ? sorted : sorted.slice(0, 5);
  const remaining = sorted.length - 5;

  return (
    <Card className={`border ${borderColor} shadow-sm flex flex-col`}>
      <CardHeader className="py-2.5 px-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-md ${bg} flex items-center justify-center`}>
            <Icon className={`w-3.5 h-3.5 ${color}`} />
          </div>
          <CardTitle className="text-xs font-semibold text-foreground">{label}</CardTitle>
          <span className={`text-xs font-bold ml-0.5 ${color}`}>{employees.length}</span>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1">
        {employees.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">No records</div>
        ) : (
          <>
            {displayed.map(emp => (
              <ExpiryRow key={emp.id} emp={emp} expiryDateField={expiryDateField} expired={expired} />
            ))}
            {sorted.length > 5 && (
              <div className="px-4 py-2 border-t bg-muted/10">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? '↑ Show Less' : <><ChevronRight className="w-3 h-3" /> View All ({remaining} more)</>}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function ExpiryMonitoringCards({ filtered }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in45 = new Date(today); in45.setDate(in45.getDate() + 45);

  const gpSoonList = useMemo(() => filtered.filter(e => {
    if (!e.gate_pass_expiry) return false;
    const d = new Date(e.gate_pass_expiry); d.setHours(0, 0, 0, 0);
    return d >= today && d <= in45;
  }), [filtered]);

  const gpExpiredList = useMemo(() => filtered.filter(e => {
    if (!e.gate_pass_expiry) return false;
    const d = new Date(e.gate_pass_expiry); d.setHours(0, 0, 0, 0);
    return d < today;
  }), [filtered]);

  const pidSoonList = useMemo(() => filtered.filter(e => {
    if (!e.pid_expiry) return false;
    const d = new Date(e.pid_expiry); d.setHours(0, 0, 0, 0);
    return d >= today && d <= in45;
  }), [filtered]);

  const pidExpiredList = useMemo(() => filtered.filter(e => {
    if (!e.pid_expiry) return false;
    const d = new Date(e.pid_expiry); d.setHours(0, 0, 0, 0);
    return d < today;
  }), [filtered]);

  const cards = [
    { label: 'Gate Pass Soon', icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50', borderColor: 'border-amber-200', employees: gpSoonList, expiryDateField: 'gate_pass_expiry', expired: false, sortDir: 'asc' },
    { label: 'Gate Pass Expired', icon: ShieldCheck, color: 'text-red-600', bg: 'bg-red-50', borderColor: 'border-red-200', employees: gpExpiredList, expiryDateField: 'gate_pass_expiry', expired: true, sortDir: 'desc' },
    { label: 'PID Soon', icon: BadgeCheck, color: 'text-amber-600', bg: 'bg-amber-50', borderColor: 'border-amber-200', employees: pidSoonList, expiryDateField: 'pid_expiry', expired: false, sortDir: 'asc' },
    { label: 'PID Expired', icon: BadgeCheck, color: 'text-red-600', bg: 'bg-red-50', borderColor: 'border-red-200', employees: pidExpiredList, expiryDateField: 'pid_expiry', expired: true, sortDir: 'desc' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Expiry Monitoring Overview</span>
        <span className="text-xs text-muted-foreground">— 45-day window</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(card => (
          <ExpiryCard key={card.label} {...card} />
        ))}
      </div>
    </div>
  );
}