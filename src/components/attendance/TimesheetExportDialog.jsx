import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { buildTimesheets, filterEmployeesForReport } from '@/lib/timesheetBuilder';
import { exportTimesheetExcel } from '@/lib/timesheetExcel';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const Select = ({ label, value, onChange, options, placeholder }) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 rounded-md border border-input bg-gray-50 px-2 text-sm">
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

export default function TimesheetExportDialog({ open, onOpenChange, employees, records, settings, shifts, assignments, holidays, baseFilters }) {
  const [mode, setMode] = useState('month');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [dateFrom, setDateFrom] = useState(now.toLocaleDateString('en-CA'));
  const [dateTo, setDateTo] = useState(now.toLocaleDateString('en-CA'));
  const [company, setCompany] = useState(baseFilters?.company || '');
  const [department, setDepartment] = useState(baseFilters?.department || '');
  const [branch, setBranch] = useState(baseFilters?.branch || '');
  const [busy, setBusy] = useState(false);

  const options = useMemo(() => ({
    companies: [...new Set(employees.map((e) => e.company).filter(Boolean))].sort(),
    departments: [...new Set(employees.map((e) => e.department).filter(Boolean))].sort(),
    branches: [...new Set(employees.map((e) => e.current_location).filter(Boolean))].sort(),
  }), [employees]);

  const { range, periodLabel } = useMemo(() => {
    if (mode === 'month') {
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { range: { from, to }, periodLabel: `${MONTHS[month]} ${year}` };
    }
    return { range: { from: dateFrom, to: dateTo }, periodLabel: `${dateFrom} to ${dateTo}` };
  }, [mode, month, year, dateFrom, dateTo]);

  const filteredEmployees = useMemo(
    () => filterEmployeesForReport(employees, { ...baseFilters, company, department, branch, search: baseFilters?.search || '' }),
    [employees, baseFilters, company, department, branch]
  );

  const handleExport = async () => {
    setBusy(true);
    try {
      const timesheets = buildTimesheets(filteredEmployees, records, settings, shifts, assignments, holidays, range.from, range.to);
      await exportTimesheetExcel(timesheets, periodLabel);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="flex-row items-center gap-2 space-y-0">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          <DialogTitle>Export Timesheet</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Export Period */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Export Period</label>
            <div className="flex gap-2">
              <button onClick={() => setMode('month')}
                className={`flex-1 h-9 rounded-md text-sm font-medium border ${mode === 'month' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                By Month
              </button>
              <button onClick={() => setMode('range')}
                className={`flex-1 h-9 rounded-md text-sm font-medium border ${mode === 'range' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                By Date Range
              </button>
            </div>
          </div>

          {mode === 'month' ? (
            <div className="grid grid-cols-2 gap-3">
              <Select label="Month" value={MONTHS[month]} onChange={(v) => setMonth(MONTHS.indexOf(v))} options={MONTHS} placeholder="" />
              <Select label="Year" value={String(year)} onChange={(v) => setYear(Number(v))} options={Array.from({ length: 8 }, (_, i) => String(now.getFullYear() - 3 + i))} placeholder="" />
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

          <div className="grid grid-cols-3 gap-3">
            <Select label="Department" value={department} onChange={setDepartment} options={options.departments} placeholder="All Departments" />
            <Select label="Branch" value={branch} onChange={setBranch} options={options.branches} placeholder="All Branches" />
            <Select label="Company / Sponsorship" value={company} onChange={setCompany} options={options.companies} placeholder="All Companies" />
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5 text-sm text-gray-600">
            Exporting <span className="font-semibold text-gray-900">{filteredEmployees.length}</span> employees for <span className="font-semibold text-gray-900">{periodLabel.toUpperCase()}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleExport} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Export Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};