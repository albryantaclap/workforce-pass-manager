import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, SlidersHorizontal, Building2, LayoutGrid, Briefcase, UserCog,
  MapPin, ArrowLeftRight, CheckCircle2, BookOpen, CreditCard,
  HeartPulse, CalendarDays, ChevronDown, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm w-full min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20 rounded-t-2xl">
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

      <div className="px-4 py-3 space-y-2 min-w-0">
        {/* Row 1 – Dropdown filters (full-width grid) */}
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${[
          companyOptions.length > 0 && setCompanyFilter,
          departmentOptions.length > 0 && setDepartmentFilter,
          positionOptions.length > 0 && setPositionFilter,
          managers.length > 0,
          locationOptions.length > 0 && setLocationFilter,
          !!setDirIndirFilter,
          rlicOptions.length > 0 && setRlicStatusFilter,
          trainingOptions.length > 0 && setTrainingStatusFilter,
          pidOptions.length > 0 && setPidStatusFilter,
          medicalOptions.length > 0 && setMedicalResultFilter,
        ].filter(Boolean).length}, 1fr)` }}>
          {companyOptions.length > 0 && setCompanyFilter && (
            <PillMultiSelect icon={<Building2 className="w-3 h-3 text-blue-500" />} label="Company" options={companyOptions} value={companyFilter} onChange={setCompanyFilter} color="blue" fullWidth />
          )}
          {departmentOptions.length > 0 && setDepartmentFilter && (
            <PillMultiSelect icon={<LayoutGrid className="w-3 h-3 text-violet-500" />} label="Department" options={departmentOptions} value={departmentFilter} onChange={setDepartmentFilter} color="violet" fullWidth />
          )}
          {positionOptions.length > 0 && setPositionFilter && (
            <PillMultiSelect icon={<Briefcase className="w-3 h-3 text-indigo-500" />} label="Position" options={positionOptions} value={positionFilter} onChange={setPositionFilter} color="indigo" fullWidth />
          )}
          {managers.length > 0 && (
            <PillMultiSelect icon={<UserCog className="w-3 h-3 text-purple-500" />} label="Manager" options={managers.map(m => ({ value: m.id, label: m.label }))} value={selectedManagerIds} onChange={managerChange} color="purple" fullWidth />
          )}
          {locationOptions.length > 0 && setLocationFilter && (
            <PillMultiSelect icon={<MapPin className="w-3 h-3 text-rose-500" />} label="Location" options={locationOptions} value={locationFilter} onChange={setLocationFilter} color="rose" fullWidth />
          )}
          {setDirIndirFilter && (
            <PillSingleSelect
              icon={<ArrowLeftRight className="w-3 h-3 text-slate-500" />}
              label="DIR/INDIR"
              value={dirIndirFilter}
              onChange={setDirIndirFilter}
              options={[{ value: '', label: 'All' }, { value: 'DIR', label: 'DIR' }, { value: 'INDIR', label: 'INDIR' }]}
              color="slate"
              fullWidth
            />
          )}
          {rlicOptions.length > 0 && setRlicStatusFilter && (
            <PillMultiSelect icon={<CheckCircle2 className="w-3 h-3 text-emerald-500" />} label="Gate Pass" options={rlicOptions} value={rlicStatusFilter} onChange={setRlicStatusFilter} color="emerald" fullWidth />
          )}
          {trainingOptions.length > 0 && setTrainingStatusFilter && (
            <PillMultiSelect icon={<BookOpen className="w-3 h-3 text-orange-500" />} label="Training" options={trainingOptions} value={trainingStatusFilter} onChange={setTrainingStatusFilter} color="orange" fullWidth />
          )}
          {pidOptions.length > 0 && setPidStatusFilter && (
            <PillMultiSelect icon={<CreditCard className="w-3 h-3 text-violet-500" />} label="Project ID" options={pidOptions} value={pidStatusFilter} onChange={setPidStatusFilter} color="violet" fullWidth />
          )}
          {medicalOptions.length > 0 && setMedicalResultFilter && (
            <PillMultiSelect icon={<HeartPulse className="w-3 h-3 text-blue-500" />} label="Medical" options={medicalOptions} value={medicalResultFilter} onChange={setMedicalResultFilter} color="blue" fullWidth />
          )}
        </div>

        {/* Row 2 – Date filters (5-column equal width) */}
        {(setTrApprovedFrom || setGpIssueFrom || setGpReceivedFrom || setTrainingScheduledFrom || setPidIssueFrom) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {setTrApprovedFrom && (
              <DatePickerPill label="TR Approved" from={trApprovedFrom} to={trApprovedTo} onFrom={setTrApprovedFrom} onTo={setTrApprovedTo} color="blue" fullWidth />
            )}
            {setGpIssueFrom && (
              <DatePickerPill label="GP Issue" from={gpIssueFrom} to={gpIssueTo} onFrom={setGpIssueFrom} onTo={setGpIssueTo} color="emerald" fullWidth />
            )}
            {setGpReceivedFrom && (
              <DatePickerPill label="GP Received" from={gpReceivedFrom} to={gpReceivedTo} onFrom={setGpReceivedFrom} onTo={setGpReceivedTo} color="amber" fullWidth />
            )}
            {setTrainingScheduledFrom && (
              <DatePickerPill label="Train Scheduled" from={trainingScheduledFrom} to={trainingScheduledTo} onFrom={setTrainingScheduledFrom} onTo={setTrainingScheduledTo} color="teal" fullWidth />
            )}
            {setPidIssueFrom && (
              <DatePickerPill label="PID Issue" from={pidIssueFrom} to={pidIssueTo} onFrom={setPidIssueFrom} onTo={setPidIssueTo} color="violet" fullWidth />
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
   Color variants
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
   Portal dropdown hook — positions relative to trigger
────────────────────────────────────────────── */
function usePortalDropdown() {
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + window.scrollY + 6,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  const toggle = useCallback(() => {
    if (!open) updatePos();
    setOpen(v => !v);
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  return { triggerRef, open, setOpen, pos, toggle };
}

/* ──────────────────────────────────────────────
   PillMultiSelect — portal dropdown
────────────────────────────────────────────── */
function PillMultiSelect({ icon, label, options, value, onChange, color = 'blue', fullWidth = false }) {
  const { triggerRef, open, setOpen, pos, toggle } = usePortalDropdown();
  const [search, setSearch] = useState('');
  const cv = colorVariants[color] || colorVariants.blue;
  const isActive = value.length > 0;

  const filtered = options.filter(o => (o.label || o).toLowerCase().includes(search.toLowerCase()));

  const toggleVal = (val) => {
    if (value.includes(val)) onChange(value.filter(v => v !== val));
    else onChange([...value, val]);
  };

  const displayLabel = isActive
    ? `${label}: ${value.length === 1 ? (options.find(o => o.value === value[0])?.label || value[0]).substring(0, 14) : `${value.length} selected`}`
    : label;

  const dropdown = open ? createPortal(
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{ position: 'absolute', top: pos.top, left: pos.left, minWidth: 220, zIndex: 99999 }}
      className="rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
    >
      <div className="p-2 border-b border-border">
        <input
          autoFocus
          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-input bg-transparent outline-none placeholder:text-muted-foreground"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {value.length > 0 && (
        <div className="px-3 py-1.5 border-b border-border/50 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{value.length} selected</span>
          <button onClick={() => onChange([])} className="text-[10px] text-muted-foreground hover:text-destructive font-medium">Clear</button>
        </div>
      )}
      <div className="max-h-56 overflow-y-auto">
        {filtered.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No results</div>}
        {filtered.map(opt => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const lbl = typeof opt === 'string' ? opt : opt.label;
          const selected = value.includes(val);
          return (
            <div
              key={val}
              className={cn('flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-muted/50 transition-colors', selected && 'bg-muted/30')}
              onMouseDown={(e) => { e.preventDefault(); toggleVal(val); }}
            >
              <div className={cn('w-4 h-4 rounded flex items-center justify-center border transition-colors flex-shrink-0', selected ? cv.check : 'border-input bg-transparent')}>
                {selected && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              <span className="leading-snug">{lbl}</span>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={toggle}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all shadow-sm hover:shadow-md',
          fullWidth ? 'w-full justify-between' : 'whitespace-nowrap',
          isActive ? cv.active : inactiveBase
        )}
      >
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          {icon}
          <span className="truncate">{displayLabel}</span>
        </span>
        <span className="flex items-center gap-0.5 flex-shrink-0">
          {isActive && (
            <span
              className="hover:bg-black/10 rounded-full p-0.5"
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
            >
              <X className="w-2.5 h-2.5" />
            </span>
          )}
          <ChevronDown className={cn('w-3 h-3 opacity-50 transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {dropdown}
    </>
  );
}

/* ──────────────────────────────────────────────
   PillSingleSelect — native select overlay (no portal needed)
────────────────────────────────────────────── */
function PillSingleSelect({ icon, label, value, onChange, options, color = 'slate', fullWidth = false }) {
  const cv = colorVariants[color] || colorVariants.slate;
  const isActive = !!value;
  const displayOpt = options.find(o => o.value === value);

  return (
    <div className={cn('relative', fullWidth ? 'w-full' : 'inline-flex')}>
      <div className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all shadow-sm hover:shadow-md cursor-pointer',
        fullWidth ? 'w-full justify-between' : 'whitespace-nowrap',
        isActive ? cv.active : inactiveBase
      )}>
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          {icon}
          <span className="truncate">{isActive ? `${label}: ${displayOpt?.label || value}` : label}</span>
        </span>
        <ChevronDown className="w-3 h-3 opacity-50 flex-shrink-0" />
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
   DatePickerPill — Quick / By Month / Date Range tabs
────────────────────────────────────────────── */
const QUICK_OPTIONS = [
  { label: 'Today', getValue: () => { const d = new Date(); const s = d.toISOString().split('T')[0]; return { from: s, to: s }; } },
  { label: 'This Week', getValue: () => { const d = new Date(); const day = d.getDay(); const mon = new Date(d); mon.setDate(d.getDate() - day + 1); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); return { from: mon.toISOString().split('T')[0], to: sun.toISOString().split('T')[0] }; } },
  { label: 'This Month', getValue: () => { const d = new Date(); const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; const to = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]; return { from, to }; } },
  { label: 'Last Month', getValue: () => { const d = new Date(); const from = new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split('T')[0]; const to = new Date(d.getFullYear(), d.getMonth(), 0).toISOString().split('T')[0]; return { from, to }; } },
  { label: 'Last 30 Days', getValue: () => { const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 30); return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] }; } },
  { label: 'Last 90 Days', getValue: () => { const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 90); return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] }; } },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function DatePickerPill({ label, from, to, onFrom, onTo, color = 'blue', fullWidth = false }) {
  const { triggerRef, open, setOpen, pos, toggle } = usePortalDropdown();
  const [tab, setTab] = useState('quick');
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [byMonthYear, setByMonthYear] = useState(new Date().getFullYear());
  const cv = colorVariants[color] || colorVariants.blue;
  const isActive = !!from || !!to;

  useEffect(() => {
    if (open) { setDraftFrom(from); setDraftTo(to); }
  }, [open]);

  const applyRange = (f, t) => { onFrom(f); onTo(t); setOpen(false); };
  const applyDraft = () => applyRange(draftFrom, draftTo);
  const clear = (e) => { e.stopPropagation(); onFrom(''); onTo(''); };

  const displayText = isActive
    ? (from && to ? `${from} → ${to}` : from ? `≥ ${from}` : `≤ ${to}`)
    : label;

  const dropdown = open ? createPortal(
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{ position: 'absolute', top: pos.top, left: pos.left, width: 300, zIndex: 99999 }}
      className="rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
    >
      {/* Tabs */}
      <div className="flex border-b border-border">
        {['quick', 'bymonth', 'range'].map(t => (
          <button
            key={t}
            onMouseDown={e => { e.preventDefault(); setTab(t); }}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium transition-colors',
              tab === t
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'quick' ? 'Quick' : t === 'bymonth' ? 'By Month' : 'Date Range'}
          </button>
        ))}
      </div>

      {/* Quick */}
      {tab === 'quick' && (
        <div className="p-2">
          {QUICK_OPTIONS.map(opt => {
            const { from: f, to: t } = opt.getValue();
            const active = from === f && to === t;
            return (
              <button
                key={opt.label}
                onMouseDown={e => { e.preventDefault(); applyRange(f, t); }}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs rounded-lg transition-colors',
                  active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50 text-foreground'
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* By Month */}
      {tab === 'bymonth' && (
        <div className="p-3">
          <div className="flex items-center justify-between mb-3">
            <button onMouseDown={e => { e.preventDefault(); setByMonthYear(y => y - 1); }} className="px-2 py-1 text-xs rounded hover:bg-muted/50">◀</button>
            <span className="text-xs font-semibold">{byMonthYear}</span>
            <button onMouseDown={e => { e.preventDefault(); setByMonthYear(y => y + 1); }} className="px-2 py-1 text-xs rounded hover:bg-muted/50">▶</button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((m, i) => {
              const f = `${byMonthYear}-${String(i + 1).padStart(2, '0')}-01`;
              const lastDay = new Date(byMonthYear, i + 1, 0).getDate();
              const t = `${byMonthYear}-${String(i + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
              const active = from === f && to === t;
              return (
                <button
                  key={m}
                  onMouseDown={e => { e.preventDefault(); applyRange(f, t); }}
                  className={cn(
                    'py-1.5 text-xs rounded-lg transition-colors',
                    active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50 text-foreground border border-border'
                  )}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Date Range */}
      {tab === 'range' && (
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-foreground/60 uppercase tracking-wider mb-1.5">From (DD-MM-YYYY)</label>
            <input
              type="date"
              value={draftFrom}
              onChange={e => setDraftFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-muted/30 outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-foreground/60 uppercase tracking-wider mb-1.5">To (DD-MM-YYYY)</label>
            <input
              type="date"
              value={draftTo}
              onChange={e => setDraftTo(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-muted/30 outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onMouseDown={e => { e.preventDefault(); applyDraft(); }}
            className="w-full py-2.5 rounded-lg bg-primary/80 hover:bg-primary text-primary-foreground text-sm font-semibold transition-colors"
          >
            Apply
          </button>
        </div>
      )}

      {/* Clear */}
      {isActive && (
        <div className="px-3 pb-2 border-t border-border/50 pt-2">
          <button
            onMouseDown={e => { e.preventDefault(); onFrom(''); onTo(''); setOpen(false); }}
            className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Clear filter
          </button>
        </div>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={toggle}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all shadow-sm hover:shadow-md',
          fullWidth ? 'w-full justify-between' : 'whitespace-nowrap',
          isActive ? cv.active : inactiveBase
        )}
      >
        <CalendarDays className={cn('w-3 h-3', isActive ? '' : 'text-muted-foreground')} />
        <span className={cn(isActive ? '' : 'text-muted-foreground')}>{displayText}</span>
        {isActive && (
          <span className="ml-0.5 hover:bg-black/10 rounded-full p-0.5" onClick={clear}>
            <X className="w-2.5 h-2.5" />
          </span>
        )}
        <ChevronDown className={cn('w-3 h-3 opacity-50 transition-transform', open && 'rotate-180')} />
      </button>
      {dropdown}
    </>
  );
}