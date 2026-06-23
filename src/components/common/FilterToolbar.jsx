import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X, SlidersHorizontal, Building2, LayoutGrid, Briefcase, UserCog,
  MapPin, ArrowLeftRight, CheckCircle2, BookOpen, CreditCard,
  HeartPulse, CalendarDays, ChevronDown, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Modern SaaS-style horizontal filter toolbar.
 * Each filter group is a self-contained pill dropdown.
 *
 * All props are optional — filters only render when their options/setters are provided.
 *
 * Main: companyFilter/setCompanyFilter/companyOptions, departmentFilter/..., positionFilter/...,
 *       selectedManagerIds/setSelectedManagerIds/managers, locationFilter/..., dirIndirFilter/setDirIndirFilter
 * Status: rlicStatusFilter/.../rlicOptions, trainingStatusFilter/.../trainingOptions,
 *         pidStatusFilter/.../pidOptions, medicalResultFilter/.../medicalOptions
 * Dates:  trainingScheduledFrom/To/set*, trApprovedFrom/To/set*, gpIssueFrom/To/set*,
 *         gpReceivedFrom/To/set*, pidIssueFrom/To/set*
 * Meta:   totalFiltered, totalAll, onClearAll
 */
export default function FilterToolbar({
  companyFilter = [], setCompanyFilter, companyOptions = [],
  departmentFilter = [], setDepartmentFilter, departmentOptions = [],
  positionFilter = [], setPositionFilter, positionOptions = [],
  selectedManagerIds = [], setSelectedManagerIds, onManagerIdsChange, managers = [],
  locationFilter = [], setLocationFilter, locationOptions = [],
  dirIndirFilter = '', setDirIndirFilter,

  rlicStatusFilter = [], setRlicStatusFilter, rlicOptions = [],
  trainingStatusFilter = [], setTrainingStatusFilter, trainingOptions = [],
  pidStatusFilter = [], setPidStatusFilter, pidOptions = [],
  medicalResultFilter = [], setMedicalResultFilter, medicalOptions = [],

  trainingScheduledFrom = '', setTrainingScheduledFrom,
  trainingScheduledTo = '', setTrainingScheduledTo,
  trApprovedFrom = '', setTrApprovedFrom,
  trApprovedTo = '', setTrApprovedTo,
  gpIssueFrom = '', setGpIssueFrom,
  gpIssueTo = '', setGpIssueTo,
  gpReceivedFrom = '', setGpReceivedFrom,
  gpReceivedTo = '', setGpReceivedTo,
  pidIssueFrom = '', setPidIssueFrom,
  pidIssueTo = '', setPidIssueTo,

  totalFiltered, totalAll,
  onClearAll,
}) {
  const managerChange = onManagerIdsChange || setSelectedManagerIds || (() => {});

  const activeChips = useMemo(() => {
    const chips = [];
    if (setCompanyFilter) companyFilter.forEach(v => chips.push({ label: 'Company', value: v, onRemove: () => setCompanyFilter(companyFilter.filter(x => x !== v)) }));
    if (setDepartmentFilter) departmentFilter.forEach(v => chips.push({ label: 'Dept', value: v, onRemove: () => setDepartmentFilter(departmentFilter.filter(x => x !== v)) }));
    if (setPositionFilter) positionFilter.forEach(v => chips.push({ label: 'Position', value: v.length > 18 ? v.substring(0, 18) + '…' : v, onRemove: () => setPositionFilter(positionFilter.filter(x => x !== v)) }));
    selectedManagerIds.forEach(v => {
      const m = managers.find(x => x.id === v);
      chips.push({ label: 'Manager', value: m?.label || v, onRemove: () => managerChange(selectedManagerIds.filter(x => x !== v)) });
    });
    if (setLocationFilter) locationFilter.forEach(v => chips.push({ label: 'Location', value: v, onRemove: () => setLocationFilter(locationFilter.filter(x => x !== v)) }));
    if (setDirIndirFilter && dirIndirFilter) chips.push({ label: 'DIR/INDIR', value: dirIndirFilter, onRemove: () => setDirIndirFilter('') });
    if (setRlicStatusFilter) rlicStatusFilter.forEach(v => chips.push({ label: 'Gate Pass', value: v, onRemove: () => setRlicStatusFilter(rlicStatusFilter.filter(x => x !== v)) }));
    if (setTrainingStatusFilter) trainingStatusFilter.forEach(v => chips.push({ label: 'Training', value: v, onRemove: () => setTrainingStatusFilter(trainingStatusFilter.filter(x => x !== v)) }));
    if (setPidStatusFilter) pidStatusFilter.forEach(v => chips.push({ label: 'PID', value: v, onRemove: () => setPidStatusFilter(pidStatusFilter.filter(x => x !== v)) }));
    if (setMedicalResultFilter) medicalResultFilter.forEach(v => chips.push({ label: 'Medical', value: v, onRemove: () => setMedicalResultFilter(medicalResultFilter.filter(x => x !== v)) }));
    if (trainingScheduledFrom) chips.push({ label: 'Train Sched ≥', value: trainingScheduledFrom, onRemove: () => setTrainingScheduledFrom?.('') });
    if (trainingScheduledTo) chips.push({ label: 'Train Sched ≤', value: trainingScheduledTo, onRemove: () => setTrainingScheduledTo?.('') });
    if (trApprovedFrom) chips.push({ label: 'TR Approved ≥', value: trApprovedFrom, onRemove: () => setTrApprovedFrom?.('') });
    if (trApprovedTo) chips.push({ label: 'TR Approved ≤', value: trApprovedTo, onRemove: () => setTrApprovedTo?.('') });
    if (gpIssueFrom) chips.push({ label: 'GP Issue ≥', value: gpIssueFrom, onRemove: () => setGpIssueFrom?.('') });
    if (gpIssueTo) chips.push({ label: 'GP Issue ≤', value: gpIssueTo, onRemove: () => setGpIssueTo?.('') });
    if (gpReceivedFrom) chips.push({ label: 'GP Recv ≥', value: gpReceivedFrom, onRemove: () => setGpReceivedFrom?.('') });
    if (gpReceivedTo) chips.push({ label: 'GP Recv ≤', value: gpReceivedTo, onRemove: () => setGpReceivedTo?.('') });
    if (pidIssueFrom) chips.push({ label: 'PID Issue ≥', value: pidIssueFrom, onRemove: () => setPidIssueFrom?.('') });
    if (pidIssueTo) chips.push({ label: 'PID Issue ≤', value: pidIssueTo, onRemove: () => setPidIssueTo?.('') });
    return chips;
  }, [companyFilter, departmentFilter, positionFilter, selectedManagerIds, locationFilter, dirIndirFilter, rlicStatusFilter, trainingStatusFilter, pidStatusFilter, medicalResultFilter, trainingScheduledFrom, trainingScheduledTo, trApprovedFrom, trApprovedTo, gpIssueFrom, gpIssueTo, gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo]);

  const hasFilter = activeChips.length > 0;

  const clearAll = onClearAll || (() => {
    setCompanyFilter?.([]); setDepartmentFilter?.([]); setPositionFilter?.([]);
    managerChange([]); setLocationFilter?.([]); setDirIndirFilter?.('');
    setRlicStatusFilter?.([]); setTrainingStatusFilter?.([]); setPidStatusFilter?.([]); setMedicalResultFilter?.([]);
    setTrainingScheduledFrom?.(''); setTrainingScheduledTo?.('');
    setTrApprovedFrom?.(''); setTrApprovedTo?.('');
    setGpIssueFrom?.(''); setGpIssueTo?.('');
    setGpReceivedFrom?.(''); setGpReceivedTo?.('');
    setPidIssueFrom?.(''); setPidIssueTo?.('');
  });

  const showMain = companyOptions.length > 0 || departmentOptions.length > 0 || positionOptions.length > 0 || managers.length > 0 || locationOptions.length > 0 || setDirIndirFilter;
  const showStatus = rlicOptions.length > 0 || trainingOptions.length > 0 || pidOptions.length > 0 || medicalOptions.length > 0;
  const showDates = setTrainingScheduledFrom || setTrApprovedFrom || setGpIssueFrom || setGpReceivedFrom || setPidIssueFrom;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filters</span>
          {hasFilter && (
            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full leading-none">
              {activeChips.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {totalFiltered !== undefined && hasFilter && (
            <span className="text-xs text-muted-foreground">
              <strong className="text-foreground">{totalFiltered}</strong>{totalAll !== undefined ? ` / ${totalAll}` : ''} personnel
            </span>
          )}
          {hasFilter && (
            <button onClick={clearAll} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors font-medium">
              <X className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Row 1 – Main Filters */}
        {showMain && (
          <div className="flex flex-wrap gap-2">
            {companyOptions.length > 0 && setCompanyFilter && (
              <PillMultiSelect icon={<Building2 className="w-3 h-3 text-blue-500" />} label="Company" options={companyOptions} value={companyFilter} onChange={setCompanyFilter} color="blue" />
            )}
            {departmentOptions.length > 0 && setDepartmentFilter && (
              <PillMultiSelect icon={<LayoutGrid className="w-3 h-3 text-violet-500" />} label="Department" options={departmentOptions} value={departmentFilter} onChange={setDepartmentFilter} color="violet" />
            )}
            {positionOptions.length > 0 && setPositionFilter && (
              <PillMultiSelect icon={<Briefcase className="w-3 h-3 text-indigo-500" />} label="Position" options={positionOptions} value={positionFilter} onChange={setPositionFilter} color="indigo" />
            )}
            {managers.length > 0 && (
              <PillMultiSelect icon={<UserCog className="w-3 h-3 text-purple-500" />} label="Manager" options={managers.map(m => ({ value: m.id, label: m.label }))} value={selectedManagerIds} onChange={managerChange} color="purple" />
            )}
            {locationOptions.length > 0 && setLocationFilter && (
              <PillMultiSelect icon={<MapPin className="w-3 h-3 text-rose-500" />} label="Location" options={locationOptions} value={locationFilter} onChange={setLocationFilter} color="rose" />
            )}
            {setDirIndirFilter && (
              <PillSingleSelect
                icon={<ArrowLeftRight className="w-3 h-3 text-slate-500" />}
                label="DIR/INDIR"
                value={dirIndirFilter}
                onChange={setDirIndirFilter}
                options={[{ value: '', label: 'All' }, { value: 'DIR', label: 'DIR' }, { value: 'INDIR', label: 'INDIR' }]}
                color="slate"
              />
            )}
          </div>
        )}

        {/* Row 2 – Status Filters */}
        {showStatus && (
          <div className="flex flex-wrap gap-2">
            {rlicOptions.length > 0 && setRlicStatusFilter && (
              <PillMultiSelect icon={<CheckCircle2 className="w-3 h-3 text-emerald-500" />} label="Gate Pass" options={rlicOptions} value={rlicStatusFilter} onChange={setRlicStatusFilter} color="emerald" />
            )}
            {trainingOptions.length > 0 && setTrainingStatusFilter && (
              <PillMultiSelect icon={<BookOpen className="w-3 h-3 text-orange-500" />} label="Training" options={trainingOptions} value={trainingStatusFilter} onChange={setTrainingStatusFilter} color="orange" />
            )}
            {pidOptions.length > 0 && setPidStatusFilter && (
              <PillMultiSelect icon={<CreditCard className="w-3 h-3 text-violet-500" />} label="Project ID" options={pidOptions} value={pidStatusFilter} onChange={setPidStatusFilter} color="violet" />
            )}
            {medicalOptions.length > 0 && setMedicalResultFilter && (
              <PillMultiSelect icon={<HeartPulse className="w-3 h-3 text-blue-500" />} label="Medical" options={medicalOptions} value={medicalResultFilter} onChange={setMedicalResultFilter} color="blue" />
            )}
          </div>
        )}

        {/* Row 3 – Date Filters */}
        {showDates && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
            {setTrainingScheduledFrom && (
              <DateRangePill label="Training Scheduled" from={trainingScheduledFrom} to={trainingScheduledTo} onFrom={setTrainingScheduledFrom} onTo={setTrainingScheduledTo} color="teal" />
            )}
            {setTrApprovedFrom && (
              <DateRangePill label="Medical TR Approved" from={trApprovedFrom} to={trApprovedTo} onFrom={setTrApprovedFrom} onTo={setTrApprovedTo} color="blue" />
            )}
            {setGpIssueFrom && (
              <DateRangePill label="Gate Pass Issue" from={gpIssueFrom} to={gpIssueTo} onFrom={setGpIssueFrom} onTo={setGpIssueTo} color="emerald" />
            )}
            {setGpReceivedFrom && (
              <DateRangePill label="Gate Pass Received" from={gpReceivedFrom} to={gpReceivedTo} onFrom={setGpReceivedFrom} onTo={setGpReceivedTo} color="amber" />
            )}
            {setPidIssueFrom && (
              <DateRangePill label="PID Issue" from={pidIssueFrom} to={pidIssueTo} onFrom={setPidIssueFrom} onTo={setPidIssueTo} color="violet" />
            )}
          </div>
        )}

        {/* Active Filter Chips */}
        {hasFilter && (
          <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/30">
            {activeChips.map((chip, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-primary/8 border border-primary/20 text-primary text-[11px] font-medium px-2.5 py-1 rounded-full">
                <span className="text-muted-foreground text-[10px] font-normal">{chip.label}:</span>
                {chip.value}
                <button onClick={chip.onRemove} className="ml-0.5 hover:text-destructive transition-colors">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            <button onClick={clearAll} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors font-medium px-1.5 py-1">
              <X className="w-2.5 h-2.5" /> Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Pill color variants
────────────────────────────────────────────── */
const colorVariants = {
  blue:    { active: 'bg-blue-50 border-blue-300 text-blue-700',       check: 'bg-blue-600 border-blue-600' },
  indigo:  { active: 'bg-indigo-50 border-indigo-300 text-indigo-700', check: 'bg-indigo-600 border-indigo-600' },
  violet:  { active: 'bg-violet-50 border-violet-300 text-violet-700', check: 'bg-violet-600 border-violet-600' },
  purple:  { active: 'bg-purple-50 border-purple-300 text-purple-700', check: 'bg-purple-600 border-purple-600' },
  emerald: { active: 'bg-emerald-50 border-emerald-300 text-emerald-700', check: 'bg-emerald-600 border-emerald-600' },
  orange:  { active: 'bg-orange-50 border-orange-300 text-orange-700', check: 'bg-orange-600 border-orange-600' },
  teal:    { active: 'bg-teal-50 border-teal-300 text-teal-700',       check: 'bg-teal-600 border-teal-600' },
  amber:   { active: 'bg-amber-50 border-amber-300 text-amber-700',    check: 'bg-amber-600 border-amber-600' },
  rose:    { active: 'bg-rose-50 border-rose-300 text-rose-700',       check: 'bg-rose-600 border-rose-600' },
  slate:   { active: 'bg-slate-100 border-slate-300 text-slate-700',   check: 'bg-slate-600 border-slate-600' },
};
const inactiveBase = 'bg-background border-border text-foreground/80 hover:border-border/80 hover:bg-muted/30';

/* ──────────────────────────────────────────────
   PillMultiSelect — pill trigger + dropdown
────────────────────────────────────────────── */
function PillMultiSelect({ icon, label, options, value, onChange, color = 'blue' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const cv = colorVariants[color] || colorVariants.blue;
  const isActive = value.length > 0;

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = options.filter(o => (o.label || o).toLowerCase().includes(search.toLowerCase()));

  const toggle = (val) => {
    if (value.includes(val)) onChange(value.filter(v => v !== val));
    else onChange([...value, val]);
  };

  const displayLabel = isActive
    ? `${label}: ${value.length === 1 ? (options.find(o => o.value === value[0])?.label || value[0]).substring(0, 14) : `${value.length} selected`}`
    : label;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all shadow-sm hover:shadow-md whitespace-nowrap',
          isActive ? cv.active : inactiveBase
        )}
      >
        {icon}
        <span>{displayLabel}</span>
        {isActive && (
          <span
            className="ml-0.5 hover:bg-black/10 rounded-full p-0.5"
            onClick={(e) => { e.stopPropagation(); onChange([]); }}
          >
            <X className="w-2.5 h-2.5" />
          </span>
        )}
        <ChevronDown className={cn('w-3 h-3 opacity-50 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 min-w-[200px] rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-input bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          {value.length > 0 && (
            <div className="px-3 py-1.5 border-b border-border/50 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{value.length} selected</span>
              <button onClick={() => onChange([])} className="text-[10px] text-muted-foreground hover:text-destructive font-medium">Clear</button>
            </div>
          )}
          <div className="max-h-52 overflow-auto">
            {filtered.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No results</div>}
            {filtered.map(opt => {
              const val = typeof opt === 'string' ? opt : opt.value;
              const lbl = typeof opt === 'string' ? opt : opt.label;
              const selected = value.includes(val);
              return (
                <div
                  key={val}
                  className={cn('flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-muted/50 transition-colors', selected && 'bg-muted/30')}
                  onClick={() => toggle(val)}
                >
                  <div className={cn('w-4 h-4 rounded flex items-center justify-center border transition-colors', selected ? cv.check : 'border-input bg-transparent')}>
                    {selected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className="leading-snug">{lbl}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   PillSingleSelect — pill with native select overlay
────────────────────────────────────────────── */
function PillSingleSelect({ icon, label, value, onChange, options, color = 'slate' }) {
  const cv = colorVariants[color] || colorVariants.slate;
  const isActive = !!value;
  const displayOpt = options.find(o => o.value === value);

  return (
    <div className="relative inline-flex">
      <div className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all shadow-sm hover:shadow-md whitespace-nowrap cursor-pointer',
        isActive ? cv.active : inactiveBase
      )}>
        {icon}
        <span>{isActive ? `${label}: ${displayOpt?.label || value}` : label}</span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full cursor-pointer"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/* ──────────────────────────────────────────────
   DateRangePill
────────────────────────────────────────────── */
function DateRangePill({ label, from, to, onFrom, onTo, color = 'blue' }) {
  const cv = colorVariants[color] || colorVariants.blue;
  const isActive = !!from || !!to;

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium shadow-sm transition-all',
      isActive ? cv.active : 'bg-background border-border text-foreground/80'
    )}>
      <CalendarDays className={cn('w-3 h-3', isActive ? '' : 'text-muted-foreground')} />
      <span className={cn('text-[11px]', !isActive && 'text-muted-foreground')}>{label}</span>
      <input
        type="date"
        value={from}
        onChange={e => onFrom(e.target.value)}
        className="bg-transparent border-none outline-none text-[11px] w-[118px] cursor-pointer"
        title="From"
      />
      <span className="text-muted-foreground text-[10px]">→</span>
      <input
        type="date"
        value={to}
        onChange={e => onTo(e.target.value)}
        className="bg-transparent border-none outline-none text-[11px] w-[118px] cursor-pointer"
        title="To"
      />
      {isActive && (
        <button onClick={() => { onFrom(''); onTo(''); }} className="ml-0.5 hover:text-destructive transition-colors">
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
}