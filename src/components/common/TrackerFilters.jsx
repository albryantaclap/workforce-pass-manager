import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import MultiSelect from '@/components/common/MultiSelect';

/**
 * Full Dashboard-style filter panel reused across Medical, Gate Pass, Training, Project ID trackers.
 *
 * Props:
 *   filters: object with all filter state values
 *   setters: object with all setter functions
 *   options: { companies, positions, departments, rlicStatuses, trainingStatuses, pidStatuses, medicalResults }
 *   totalFiltered: number
 *   totalAll: number
 */
export default function TrackerFilters({ filters, setters, options, totalFiltered, totalAll }) {
  const {
    companyFilter, positionFilter, departmentFilter,
    rlicStatusFilter, trainingStatusFilter, pidStatusFilter, medicalResultFilter,
    trainingScheduledFrom, trainingScheduledTo,
    trApprovedFrom, trApprovedTo,
    gpIssueFrom, gpIssueTo,
    gpReceivedFrom, gpReceivedTo,
    pidIssueFrom, pidIssueTo,
  } = filters;

  const {
    setCompanyFilter, setPositionFilter, setDepartmentFilter,
    setRlicStatusFilter, setTrainingStatusFilter, setPidStatusFilter, setMedicalResultFilter,
    setTrainingScheduledFrom, setTrainingScheduledTo,
    setTrApprovedFrom, setTrApprovedTo,
    setGpIssueFrom, setGpIssueTo,
    setGpReceivedFrom, setGpReceivedTo,
    setPidIssueFrom, setPidIssueTo,
  } = setters;

  const hasFilter =
    companyFilter.length > 0 || positionFilter.length > 0 || departmentFilter.length > 0 ||
    rlicStatusFilter.length > 0 || trainingStatusFilter.length > 0 || pidStatusFilter.length > 0 ||
    medicalResultFilter.length > 0 ||
    !!trainingScheduledFrom || !!trainingScheduledTo ||
    !!trApprovedFrom || !!trApprovedTo ||
    !!gpIssueFrom || !!gpIssueTo || !!gpReceivedFrom || !!gpReceivedTo ||
    !!pidIssueFrom || !!pidIssueTo;

  const clearFilters = () => {
    setCompanyFilter([]); setPositionFilter([]); setDepartmentFilter([]);
    setRlicStatusFilter([]); setTrainingStatusFilter([]); setPidStatusFilter([]);
    setMedicalResultFilter([]);
    setTrainingScheduledFrom(''); setTrainingScheduledTo('');
    setTrApprovedFrom(''); setTrApprovedTo('');
    setGpIssueFrom(''); setGpIssueTo('');
    setGpReceivedFrom?.(''); setGpReceivedTo?.('');
    setPidIssueFrom(''); setPidIssueTo('');
  };

  return (
    <Card className="border shadow-sm">
      <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filters</p>
        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" /> Clear All
          </Button>
        )}
      </div>
      <div className="p-4 space-y-3">
        {/* Row 1: Company, Position, Department */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Company</p>
            <MultiSelect options={options.companies} value={companyFilter} onChange={setCompanyFilter} placeholder="All companies..." className="dropdown-company" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Position / Designation</p>
            <MultiSelect options={options.positions} value={positionFilter} onChange={setPositionFilter} placeholder="All positions..." className="dropdown-position" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Department</p>
            <MultiSelect options={options.departments} value={departmentFilter} onChange={setDepartmentFilter} placeholder="All departments..." className="dropdown-department" />
          </div>
        </div>

        {/* Row 2: Gate Pass, Training, Project ID, Medical */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Gate Pass Status</p>
            <MultiSelect options={options.rlicStatuses} value={rlicStatusFilter} onChange={setRlicStatusFilter} placeholder="All statuses..." className="dropdown-status" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Training Status</p>
            <MultiSelect options={options.trainingStatuses} value={trainingStatusFilter} onChange={setTrainingStatusFilter} placeholder="All statuses..." className="dropdown-training" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Project ID Status</p>
            <MultiSelect options={options.pidStatuses} value={pidStatusFilter} onChange={setPidStatusFilter} placeholder="All statuses..." className="dropdown-status" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Medical Result</p>
            <MultiSelect options={options.medicalResults} value={medicalResultFilter} onChange={setMedicalResultFilter} placeholder="All results..." className="dropdown-status" />
          </div>
        </div>

        {/* Row 3: Date ranges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1 border-t">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Training Scheduled</p>
            <div className="flex gap-1.5">
              <Input type="date" value={trainingScheduledFrom} onChange={e => setTrainingScheduledFrom(e.target.value)} className="text-xs h-8" />
              <Input type="date" value={trainingScheduledTo} onChange={e => setTrainingScheduledTo(e.target.value)} className="text-xs h-8" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Medical TR Approved</p>
            <div className="flex gap-1.5">
              <Input type="date" value={trApprovedFrom} onChange={e => setTrApprovedFrom(e.target.value)} className="text-xs h-8" />
              <Input type="date" value={trApprovedTo} onChange={e => setTrApprovedTo(e.target.value)} className="text-xs h-8" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Gate Pass Issue Date</p>
            <div className="flex gap-1.5">
              <Input type="date" value={gpIssueFrom} onChange={e => setGpIssueFrom(e.target.value)} className="text-xs h-8" />
              <Input type="date" value={gpIssueTo} onChange={e => setGpIssueTo(e.target.value)} className="text-xs h-8" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Gate Pass Received</p>
            <div className="flex gap-1.5">
              <Input type="date" value={gpReceivedFrom || ''} onChange={e => setGpReceivedFrom?.(e.target.value)} className="text-xs h-8" />
              <Input type="date" value={gpReceivedTo || ''} onChange={e => setGpReceivedTo?.(e.target.value)} className="text-xs h-8" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Project ID Issue</p>
            <div className="flex gap-1.5">
              <Input type="date" value={pidIssueFrom} onChange={e => setPidIssueFrom(e.target.value)} className="text-xs h-8" />
              <Input type="date" value={pidIssueTo} onChange={e => setPidIssueTo(e.target.value)} className="text-xs h-8" />
            </div>
          </div>
        </div>

        {hasFilter && (
          <p className="text-xs text-muted-foreground pt-1">
            Showing <strong className="text-foreground">{totalFiltered}</strong> of <strong className="text-foreground">{totalAll}</strong> active personnel
          </p>
        )}
      </div>
    </Card>
  );
}