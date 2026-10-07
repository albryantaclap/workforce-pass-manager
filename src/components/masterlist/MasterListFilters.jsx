import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MultiSelect from '@/components/common/MultiSelect';
import { Search, SlidersHorizontal, ChevronDown, X } from 'lucide-react';
import { CAMP_STATUS_FILTER_OPTIONS } from '@/lib/masterListFilters';

/**
 * The ONE Search & Filter section of the Master List.
 *
 * It is rendered once, above the tabs, and serves All Personnel, Active on Site,
 * Onboarding and Inactive alike: same controls, same order, same styling, same
 * behaviour. It is fully controlled — the host page owns the filter state, so
 * switching tabs keeps every selection and only changes the dataset the filters
 * are applied to.
 */
export default function MasterListFilters({
  filters, onChange, options,
  searchValue, onSearchChange,
  hasActiveFilters, onClear,
}) {
  const [open, setOpen] = useState(false);
  const set = (patch) => onChange(patch);

  const { companyOptions = [], positionOptions = [], departmentOptions = [], locationOptions = [],
    rlicStatusOptions = [], pidStatusOptions = [], medicalResultOptions = [], trainingStatusOptions = [],
    managers = [] } = options || {};

  const managerOptions = managers.map(m => ({ value: m.id, label: m.label }));
  const medicalOptions = [{ value: 'NEW', label: 'New' }, ...medicalResultOptions];

  return (
    <Card className="p-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Filters
        {hasActiveFilters && (
          <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full leading-none">Active</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>

      <div className={`mt-3 ${open ? '' : 'hidden'}`}>
        {/* Row 1 — search, company, position, department, RLIC */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-3">
          <div className="relative col-span-2 xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Name, QID, PP, PID..."
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <MultiSelect options={companyOptions} value={filters.companies} onChange={v => set({ companies: v })} placeholder="All Companies" className="dropdown-company" />
          <MultiSelect options={positionOptions} value={filters.positions} onChange={v => set({ positions: v })} placeholder="Filter by position" className="dropdown-position" />
          <MultiSelect options={departmentOptions} value={filters.departments} onChange={v => set({ departments: v })} placeholder="Filter by department" className="dropdown-department" />
          <Select value={filters.rlic} onValueChange={v => set({ rlic: v })}>
            <SelectTrigger className="dropdown-status"><SelectValue placeholder="RLIC Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All RLIC</SelectItem>
              {rlicStatusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Row 2 — PID status, gate pass status, medical, location, DIR/INDIR, training, camp */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-3">
          <MultiSelect options={pidStatusOptions} value={filters.pidStatuses} onChange={v => set({ pidStatuses: v })} placeholder="PID Status" className="dropdown-status" />
          <MultiSelect options={rlicStatusOptions} value={filters.gatePasses} onChange={v => set({ gatePasses: v })} placeholder="GP Statuses" className="dropdown-status" />
          <MultiSelect options={medicalOptions} value={filters.medicals} onChange={v => set({ medicals: v })} placeholder="Medical Result" className="dropdown-status" />
          <div className="flex gap-2">
            <Select value={filters.locations} onValueChange={v => set({ locations: v })}>
              <SelectTrigger className="dropdown-location"><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locationOptions.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.dir} onValueChange={v => set({ dir: v })}>
              <SelectTrigger className="w-28 dropdown-location"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="DIR">DIR</SelectItem>
                <SelectItem value="INDIR">INDIR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={filters.training} onValueChange={v => set({ training: v })}>
            <SelectTrigger className="dropdown-training"><SelectValue placeholder="Training Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Training Status</SelectItem>
              {trainingStatusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.campStatus} onValueChange={v => set({ campStatus: v })}>
            <SelectTrigger className="dropdown-status"><SelectValue placeholder="Camp Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Camp Status</SelectItem>
              {CAMP_STATUS_FILTER_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Row 3 — manager */}
        <div className="grid grid-cols-1 mb-3">
          <MultiSelect options={managerOptions} value={filters.managerIds} onChange={v => set({ managerIds: v })} placeholder="All Managers" className="dropdown-manager" />
        </div>

        {/* Date ranges */}
        <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-6 lg:gap-3">
          {[
            { label: 'Training Scheduled', from: 'trainingScheduledFrom', to: 'trainingScheduledTo' },
            { label: 'Medical TR Approved', from: 'medicalTrApprovedFrom', to: 'medicalTrApprovedTo' },
            { label: 'Gate Pass Submitted', from: 'gpIssueFrom', to: 'gpIssueTo' },
            { label: 'Gate Pass Received', from: 'gpReceivedFrom', to: 'gpReceivedTo' },
            { label: 'Project ID Issue', from: 'pidIssueFrom', to: 'pidIssueTo' },
            { label: 'Inactive Date', from: 'inactiveFrom', to: 'inactiveTo' },
          ].map(range => (
            <div key={range.from}>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">{range.label}</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                <Input
                  type="date"
                  value={filters.dates[range.from]}
                  onChange={e => set({ dates: { ...filters.dates, [range.from]: e.target.value } })}
                  className="text-xs h-8 flex-1"
                  title="From"
                  placeholder="From"
                />
                <span className="hidden sm:block text-muted-foreground text-xs">–</span>
                <Input
                  type="date"
                  value={filters.dates[range.to]}
                  onChange={e => set({ dates: { ...filters.dates, [range.to]: e.target.value } })}
                  className="text-xs h-8 flex-1"
                  title="To"
                  placeholder="To"
                />
              </div>
            </div>
          ))}
        </div>

        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={onClear}>
              <X className="w-3.5 h-3.5 mr-1" /> Clear Filters
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}