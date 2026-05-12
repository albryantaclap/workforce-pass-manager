import React, { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

const COMPANIES = [
  'GSO QATAR','ITELLIGENT','ANION','SEA QUEEN','LMV E AND I','METAL WORLD','ASMA','FIT',
  'SPRAY CON','EMKAN','ENERTEC','CRYSTAL','MEGATRONICS (GSO)','ENERSERVE (GSO)',
  'ENERTEC (GSO)','NTC (GSO)','MIR (GSO)','ALTAF (GSO)','SWAN GLOBAL (GSO)',
  'SIGEL (GSO)','AL-RAMSHA (GSO)','ALTHAF (GSO)','ZEAL-IT'
];
const DEPARTMENTS = ['Electrical','Mechanical','Civil','Services'];

const GP_STATUSES = ['VALID RLIC PASS','EXPIRED RLIC PASS','SOON TO EXPIRE','NO RLIC PASS'];
const TRAINING_STATUSES = ['DONE','PENDING','NOT REQUIRED'];
const PID_STATUSES = ['VALID PID PASS','EXPIRED PID PASS','SOON TO EXPIRE','NO PID PASS'];
const MEDICAL_RESULTS = ['ACCEPTED','REJECTED','WAITING TR APPROVAL','RE-ASSESS'];

export default function FormFilters({
  employees, search, setSearch,
  filterCompany, setFilterCompany,
  filterDepartment, setFilterDepartment,
  filterGpDate, setFilterGpDate,
  filterTrainingDate, setFilterTrainingDate,
  filterPidDate, setFilterPidDate,
  filterGpStatus, setFilterGpStatus,
  filterTrainingStatus, setFilterTrainingStatus,
  filterPidStatus, setFilterPidStatus,
  filterMedicalResult, setFilterMedicalResult,
  selectedPersonnel, addPersonnel, removePersonnel, clearPersonnel
}) {
  // Auto-populate from filters
  useEffect(() => {
    if (!employees.length) return;
    let results = employees;
    if (filterCompany) results = results.filter(e => e.company === filterCompany);
    if (filterDepartment) results = results.filter(e => e.department === filterDepartment);
    if (filterGpDate) results = results.filter(e => e.gate_pass_received_date === filterGpDate);
    if (filterTrainingDate) results = results.filter(e => e.training_date_scheduled === filterTrainingDate);
    if (filterPidDate) results = results.filter(e => e.pid_issue_date === filterPidDate);
    if (filterGpStatus) results = results.filter(e => e.rlic_status === filterGpStatus);
    if (filterTrainingStatus) results = results.filter(e => e.training_status === filterTrainingStatus);
    if (filterPidStatus) results = results.filter(e => e.pid_status === filterPidStatus);
    if (filterMedicalResult) results = results.filter(e => e.ftw_result === filterMedicalResult);

    const hasActiveFilter = filterCompany || filterDepartment || filterGpDate || filterTrainingDate || filterPidDate || filterGpStatus || filterTrainingStatus || filterPidStatus || filterMedicalResult;
    if (hasActiveFilter && results.length > 0) {
      results.forEach(emp => addPersonnel(emp));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCompany, filterDepartment, filterGpDate, filterTrainingDate, filterPidDate, filterGpStatus, filterTrainingStatus, filterPidStatus, filterMedicalResult, employees]);

  const searchFiltered = search
    ? employees.filter(e =>
        !selectedPersonnel.find(p => p.id === e.id) && (
          e.name?.toLowerCase().includes(search.toLowerCase()) ||
          e.qid_no?.toLowerCase().includes(search.toLowerCase()) ||
          e.company?.toLowerCase().includes(search.toLowerCase())
        )
      ).slice(0, 20)
    : [];

  return (
    <div className="bg-white border rounded-lg p-4 space-y-4 no-print">
      <h3 className="text-sm font-semibold text-slate-700">Personnel Filters & Selection</h3>

      {/* Filter row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div>
          <label className="text-xs font-medium block mb-1">Company</label>
          <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filterCompany} onChange={e => { clearPersonnel(); setFilterCompany(e.target.value); }}>
            <option value="">All Companies</option>
            {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Department</label>
          <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filterDepartment} onChange={e => { clearPersonnel(); setFilterDepartment(e.target.value); }}>
            <option value="">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Gate Pass Received Date</label>
          <Input type="date" value={filterGpDate} onChange={e => { clearPersonnel(); setFilterGpDate(e.target.value); }} className="h-9" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Training Scheduled Date</label>
          <Input type="date" value={filterTrainingDate} onChange={e => { clearPersonnel(); setFilterTrainingDate(e.target.value); }} className="h-9" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">PID Issue Date</label>
          <Input type="date" value={filterPidDate} onChange={e => { clearPersonnel(); setFilterPidDate(e.target.value); }} className="h-9" />
        </div>
      </div>

      {/* Status filter row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-medium block mb-1">Gate Pass Status</label>
          <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filterGpStatus} onChange={e => { clearPersonnel(); setFilterGpStatus(e.target.value); }}>
            <option value="">All statuses...</option>
            {GP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Training Status</label>
          <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filterTrainingStatus} onChange={e => { clearPersonnel(); setFilterTrainingStatus(e.target.value); }}>
            <option value="">All statuses...</option>
            {TRAINING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Project ID Status</label>
          <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filterPidStatus} onChange={e => { clearPersonnel(); setFilterPidStatus(e.target.value); }}>
            <option value="">All statuses...</option>
            {PID_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Medical Result</label>
          <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filterMedicalResult} onChange={e => { clearPersonnel(); setFilterMedicalResult(e.target.value); }}>
            <option value="">ALL RESULTS</option>
            {MEDICAL_RESULTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, QID, or company..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {search && searchFiltered.length > 0 && (
        <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
          {searchFiltered.map(emp => (
            <button key={emp.id} onClick={() => addPersonnel(emp)}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-sm">
              <span className="font-medium">{emp.name}</span>
              <span className="text-muted-foreground text-xs">{emp.qid_no} · {emp.company}</span>
            </button>
          ))}
        </div>
      )}

      {/* Selected chips */}
      {selectedPersonnel.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600">{selectedPersonnel.length} personnel selected</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={clearPersonnel}>Clear all</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedPersonnel.map(p => (
              <span key={p.id} className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full font-medium">
                {p.name}
                <button onClick={() => removePersonnel(p.id)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}