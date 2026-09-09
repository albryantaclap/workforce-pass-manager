import React, { useMemo } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  'Present', 'Absent', 'Late', 'Half Day', 'On Leave', 'Rest Day', 'Holiday', 'Missing Check-out', 'Incomplete',
];

// Shared filter bar used across Dashboard, Time Entries, Employee Summary, Reports.
export default function AttendanceFilterBar({ filters, setFilters, employees }) {
  const options = useMemo(() => {
    const unique = (field) => [...new Set(employees.map(e => e[field]).filter(Boolean))].sort();
    return {
      companies: unique('company'),
      departments: unique('department'),
      designations: unique('position_application'),
      branches: unique('current_location'),
      managers: [...new Set(employees.map(e => e.assigned_manager_name).filter(Boolean))].sort(),
    };
  }, [employees]);

  const update = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));
  const clearAll = () => setFilters({ search: '', company: '', department: '', designation: '', manager: '', branch: '', dirIndir: '', status: '' });

  const hasActiveFilters = Object.values(filters).some(v => v);

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter className="w-4 h-4 text-muted-foreground" />
          Search & Filter
        </div>
        {hasActiveFilters && (
          <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <X className="w-3 h-3" /> Clear all
          </button>
        )}
      </div>

      {/* Live search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Live search by name, ID, QID, PID, position, company..."
          value={filters.search}
          onChange={e => update('search', e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filter dropdowns */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <FilterSelect label="Company" value={filters.company} onChange={v => update('company', v)} options={options.companies} />
        <FilterSelect label="Department" value={filters.department} onChange={v => update('department', v)} options={options.departments} />
        <FilterSelect label="Designation" value={filters.designation} onChange={v => update('designation', v)} options={options.designations} />
        <FilterSelect label="Manager" value={filters.manager} onChange={v => update('manager', v)} options={options.managers} />
        <FilterSelect label="Branch / Location" value={filters.branch} onChange={v => update('branch', v)} options={options.branches} />
        <FilterSelect label="DIR / INDIR" value={filters.dirIndir} onChange={v => update('dirIndir', v)} options={['DIR', 'INDIR']} />
        <FilterSelect label="Status" value={filters.status} onChange={v => update('status', v)} options={STATUS_OPTIONS} />
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn(
          'w-full h-8 rounded-md border border-input bg-transparent px-2 text-xs',
          'focus:outline-none focus:ring-1 focus:ring-ring',
          value && 'bg-accent'
        )}
      >
        <option value="">All {label}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}