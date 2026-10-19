import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CalendarRange, Loader2, ChevronDown } from 'lucide-react';
import { exportWeeklyPdf } from '@/lib/weeklyPdf';
import { sameSiteLocation } from '@/lib/attendanceEngine';
import { useAttendanceFilterOptions } from '@/hooks/useAttendanceFilterOptions';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_UP = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];

const VIOLET = '#5c53f5';

// Reusable select matching the design (white, rounded, chevron)
function FieldSelect({ label, value, onChange, options, allLabel }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium" style={{ color: '#5f6368' }}>{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-9 rounded-md border bg-white pl-2.5 pr-8 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-1"
          style={{ borderColor: '#dadce0', color: '#202124' }}
        >
          <option value="">{allLabel}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#5f6368' }} />
      </div>
    </div>
  );
}

export default function WeeklyPdfDialog({ open, onOpenChange, employees, records, settings, shifts, assignments, holidays, baseFilters }) {
  const now = new Date();
  const [mode, setMode] = useState('month');
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [dateFrom, setDateFrom] = useState(now.toLocaleDateString('en-CA'));
  const [dateTo, setDateTo] = useState(now.toLocaleDateString('en-CA'));
  const [department, setDepartment] = useState('');
  const [branch, setBranch] = useState('');
  const [company, setCompany] = useState('');
  const [busy, setBusy] = useState(false);

  const departments = useMemo(
    () => [...new Set(employees.map((e) => e.department).filter(Boolean))].sort(),
    [employees]
  );
  // Branch list = Branch / Work Locations defined in Attendance Settings.
  const { options: branchOptions } = useAttendanceFilterOptions();
  const branches = branchOptions.branches;
  const companies = useMemo(
    () => [...new Set(employees.map((e) => e.company).filter(Boolean))].sort(),
    [employees]
  );

  const { range, periodLabel, periodLabelUp } = useMemo(() => {
    if (mode === 'month') {
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { range: { from, to }, periodLabel: `${MONTHS[month]} ${year}`, periodLabelUp: `${MONTHS_UP[month]} ${year}` };
    }
    const f = new Date(dateFrom + 'T00:00:00');
    const t = new Date(dateTo + 'T00:00:00');
    const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    return { range: { from: dateFrom, to: dateTo }, periodLabel: `${fmt(f)} - ${fmt(t)}`, periodLabelUp: `${fmt(f)} - ${fmt(t)}` };
  }, [mode, month, year, dateFrom, dateTo]);

  // Build filtered rows for the PDF
  const { rows, empCount } = useMemo(() => {
    const empMap = new Map(employees.map((e) => [e.id, e]));
    const inRange = records.filter((r) => {
      if (r.attendance_date < range.from) return false;
      if (r.attendance_date > range.to) return false;
      if (r.is_deleted) return false;
      return true;
    });
    const seenEmps = new Set();
    const out = [];
    for (const r of inRange) {
      const emp = empMap.get(r.personnel_id) || { name: r.employee_name, company: r.company };
      if (department && emp.department !== department) continue;
      if (branch && !sameSiteLocation(r.site_location, branch)) continue;
      if (company && emp.company !== company) continue;
      // honor base filters (manager/search) if provided
      if (baseFilters?.company && emp.company !== baseFilters.company) continue;
      if (baseFilters?.department && emp.department !== baseFilters.department) continue;
      if (baseFilters?.branch && !sameSiteLocation(r.site_location, baseFilters.branch)) continue;
      seenEmps.add(r.personnel_id);
      out.push({ record: r, emp });
    }
    return { rows: out, empCount: seenEmps.size };
  }, [records, employees, range, department, branch, company, baseFilters]);

  const handleExport = async () => {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      exportWeeklyPdf(rows, range.from, range.to, { company, department, branch },
        { settings, shifts, assignments, holidays });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" style={{ background: '#f8f9fa' }}>
        <DialogHeader className="flex-row items-center gap-2 space-y-0">
          <CalendarRange className="w-5 h-5" style={{ color: VIOLET }} />
          <DialogTitle>Weekly Attendance PDF</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Export Period toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: '#5f6368' }}>Export Period</label>
            <div className="flex gap-2">
              <button onClick={() => setMode('month')}
                className="flex-1 h-9 rounded-full text-sm font-medium border transition-colors"
                style={mode === 'month'
                  ? { background: VIOLET, color: '#fff', borderColor: VIOLET }
                  : { background: 'transparent', color: '#3c4043', borderColor: '#dadce0' }}>
                By Month
              </button>
              <button onClick={() => setMode('range')}
                className="flex-1 h-9 rounded-full text-sm font-medium border transition-colors"
                style={mode === 'range'
                  ? { background: VIOLET, color: '#fff', borderColor: VIOLET }
                  : { background: 'transparent', color: '#3c4043', borderColor: '#dadce0' }}>
                By Date Range
              </button>
            </div>
          </div>

          {mode === 'month' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium" style={{ color: '#5f6368' }}>Month</label>
                <div className="relative">
                  <select value={MONTHS[month]} onChange={(e) => setMonth(MONTHS.indexOf(e.target.value))}
                    className="w-full h-9 rounded-md border bg-white pl-2.5 pr-8 text-sm appearance-none cursor-pointer focus:outline-none"
                    style={{ borderColor: '#dadce0', color: '#202124' }}>
                    {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#5f6368' }} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium" style={{ color: '#5f6368' }}>Year</label>
                <div className="relative">
                  <select value={String(year)} onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full h-9 rounded-md border bg-white pl-2.5 pr-8 text-sm appearance-none cursor-pointer focus:outline-none"
                    style={{ borderColor: '#dadce0', color: '#202124' }}>
                    {Array.from({ length: 8 }, (_, i) => String(now.getFullYear() - 3 + i)).map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#5f6368' }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium" style={{ color: '#5f6368' }}>From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full h-9 rounded-md border bg-white px-2 text-sm" style={{ borderColor: '#dadce0', color: '#202124' }} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium" style={{ color: '#5f6368' }}>To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="w-full h-9 rounded-md border bg-white px-2 text-sm" style={{ borderColor: '#dadce0', color: '#202124' }} />
              </div>
            </div>
          )}

          {/* Filters row */}
          <div className="grid grid-cols-3 gap-3">
            <FieldSelect label="Department" value={department} onChange={setDepartment} options={departments} allLabel="All Departments" />
            <FieldSelect label="Branch" value={branch} onChange={setBranch} options={branches} allLabel="All Branches" />
            <FieldSelect label="Company / Sponsorship" value={company} onChange={setCompany} options={companies} allLabel="All Companies" />
          </div>

          {/* Status bar */}
          <div className="rounded-md px-3 py-2.5 text-sm" style={{ background: '#f1f3f4', color: '#3c4043' }}>
            {rows.length === 0 ? (
              <span>No attendance records for the selected period and filters.</span>
            ) : (
              <>Exporting <span className="font-bold" style={{ color: '#202124' }}>{empCount}</span> employees for <span className="font-bold" style={{ color: '#202124' }}>{periodLabelUp}</span></>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleExport} disabled={busy || rows.length === 0} className="gap-2 text-white" style={{ background: VIOLET }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarRange className="w-4 h-4" />}
            Export PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}