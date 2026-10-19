import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { buildTimesheets, filterEmployeesForReport } from '@/lib/timesheetBuilder';
import { exportTimesheetPdf } from '@/lib/timesheetPdf';
import { personnelAtBranch } from '@/lib/attendanceEngine';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function PdfByEmployeeDialog({ open, onOpenChange, employees, records, settings, shifts, assignments, holidays, baseFilters }) {
  const now = new Date();
  const [mode, setMode] = useState('month');
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [dateFrom, setDateFrom] = useState(now.toLocaleDateString('en-CA'));
  const [dateTo, setDateTo] = useState(now.toLocaleDateString('en-CA'));
  const [employeeId, setEmployeeId] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const { range, periodLabel } = useMemo(() => {
    if (mode === 'month') {
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { range: { from, to }, periodLabel: `${MONTHS[month]} ${year}` };
    }
    return { range: { from: dateFrom, to: dateTo }, periodLabel: `${dateFrom} to ${dateTo}` };
  }, [mode, month, year, dateFrom, dateTo]);

  const filteredEmployees = useMemo(() => {
    const list = filterEmployeesForReport(employees, { ...baseFilters, search: search || baseFilters?.search || '' });
    // Branch / Location keeps the personnel with attendance recorded at that branch
    // during the period (Branch / Work Locations from Attendance Settings).
    const branch = baseFilters?.branch;
    if (!branch) return list;
    const allowed = personnelAtBranch(records, branch, range.from, range.to);
    return list.filter((e) => allowed.has(e.id));
  }, [employees, baseFilters, search, records, range]);

  const selectedEmp = filteredEmployees.find((e) => e.id === employeeId) || null;

  const handleExport = async () => {
    const targets = selectedEmp ? [selectedEmp] : filteredEmployees;
    if (targets.length === 0) return;
    setBusy(true);
    try {
      const timesheets = buildTimesheets(targets, records, settings, shifts, assignments, holidays, range.from, range.to);
      exportTimesheetPdf(timesheets, periodLabel, selectedEmp?.name);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="flex-row items-center gap-2 space-y-0">
          <FileText className="w-5 h-5 text-rose-600" />
          <DialogTitle>PDF Export by Employee</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Employee select */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Employee</label>
            <input
              list="pdf-emp-list"
              value={selectedEmp ? selectedEmp.name : search}
              onChange={(e) => {
                setSearch(e.target.value);
                const match = filteredEmployees.find((emp) => emp.name === e.target.value);
                setEmployeeId(match ? match.id : '');
              }}
              placeholder="— Search or select an employee —"
              className="w-full h-9 rounded-md border border-input bg-white px-2 text-sm"
            />
            <datalist id="pdf-emp-list">
              {filteredEmployees.slice(0, 500).map((e) => <option key={e.id} value={e.name} />)}
            </datalist>
            <p className="text-[11px] text-muted-foreground">Leave empty to generate a combined PDF for all filtered employees (one page each).</p>
          </div>

          {/* Export Period */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Export Period</label>
            <div className="flex gap-2">
              <button onClick={() => setMode('month')}
                className={`flex-1 h-9 rounded-md text-sm font-medium border ${mode === 'month' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200'}`}>
                By Month
              </button>
              <button onClick={() => setMode('range')}
                className={`flex-1 h-9 rounded-md text-sm font-medium border ${mode === 'range' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200'}`}>
                By Date Range
              </button>
            </div>
          </div>

          {mode === 'month' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Month</label>
                <select value={MONTHS[month]} onChange={(e) => setMonth(MONTHS.indexOf(e.target.value))}
                  className="w-full h-9 rounded-md border border-input bg-gray-50 px-2 text-sm">
                  {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Year</label>
                <select value={String(year)} onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full h-9 rounded-md border border-input bg-gray-50 px-2 text-sm">
                  {Array.from({ length: 8 }, (_, i) => String(now.getFullYear() - 3 + i)).map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full h-9 rounded-md border border-input bg-gray-50 px-2 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full h-9 rounded-md border border-input bg-gray-50 px-2 text-sm" />
              </div>
            </div>
          )}

          <div className="rounded-lg bg-gray-100 px-3 py-2.5 text-sm text-gray-600">
            {selectedEmp
              ? `Generating ${selectedEmp.name}'s timesheet for ${periodLabel}.`
              : `Select an employee to generate their individual timesheet PDF.`}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleExport} disabled={busy} className="bg-rose-600 hover:bg-rose-700 text-white gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Export PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};