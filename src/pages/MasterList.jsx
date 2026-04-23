import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Eye, Pencil, Trash2, Upload, X, PencilLine } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '../components/common/StatusBadge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { COMPANIES, RLIC_STATUSES, PID_STATUSES, LOCATIONS, MEDICAL_RESULTS, FTW_RESULTS, TRAINING_STATUSES, formatDate, computePassStatus } from '@/utils/constants';

import MultiSelect from '../components/common/MultiSelect';
import ExportButton from '../components/common/ExportButton';
import InlineEditCell from '../components/common/InlineEditCell';
import BulkEditBar from '../components/common/BulkEditBar';

const STORAGE_KEY = 'masterlist_filters';

function loadFilters() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function saveFilters(f) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch {}
}

export default function MasterList() {
  const [editMode, setEditMode] = useState(false);
  const saved = useMemo(() => loadFilters(), []);
  const [search, setSearch] = useState(saved.search || '');
  const [companyFilter, setCompanyFilter] = useState(saved.companyFilter || []);
  const [rlicFilter, setRlicFilter] = useState(saved.rlicFilter || 'all');
  const [locationFilter, setLocationFilter] = useState(saved.locationFilter || 'all');
  const [dirFilter, setDirFilter] = useState(saved.dirFilter || 'all');
  const [positionFilter, setPositionFilter] = useState(saved.positionFilter || []);
  const [departmentFilter, setDepartmentFilter] = useState(saved.departmentFilter || 'all');
  const [pidStatusFilter, setPidStatusFilter] = useState(saved.pidStatusFilter || []);
  const [gpStatusFilter, setGpStatusFilter] = useState(saved.gpStatusFilter || []);
  const [medicalResultFilter, setMedicalResultFilter] = useState(saved.medicalResultFilter || 'all');
  const [trainingStatusFilter, setTrainingStatusFilter] = useState(saved.trainingStatusFilter || 'all');
  const [trainingDateFrom, setTrainingDateFrom] = useState(saved.trainingDateFrom || '');
  const [trainingDateTo, setTrainingDateTo] = useState(saved.trainingDateTo || '');

  useEffect(() => {
    saveFilters({ search, companyFilter, rlicFilter, locationFilter, dirFilter, positionFilter, departmentFilter, pidStatusFilter, gpStatusFilter, medicalResultFilter, trainingStatusFilter, trainingDateFrom, trainingDateTo });
  }, [search, companyFilter, rlicFilter, locationFilter, dirFilter, positionFilter, departmentFilter, pidStatusFilter, gpStatusFilter, medicalResultFilter, trainingStatusFilter, trainingDateFrom, trainingDateTo]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: customRlicStatuses = [] } = useQuery({
    queryKey: ['lookups', 'rlic_status'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'rlic_status' }),
  });

  const allGpStatusOptions = useMemo(() => {
    const custom = customRlicStatuses.map(s => ({ value: s.value, label: s.label }));
    return [...RLIC_STATUSES, ...custom];
  }, [customRlicStatuses]);

  const getEffectiveRlic = (e) => computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 2000),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
    onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
  });

  const handleCellSave = (id, field, value) => {
    updateMutation.mutate({ id, data: { [field]: value } });
  };

  const hasActiveFilters = search || companyFilter.length > 0 || positionFilter.length > 0 || rlicFilter !== 'all' || locationFilter !== 'all' || dirFilter !== 'all' || departmentFilter !== 'all' || pidStatusFilter.length > 0 || gpStatusFilter.length > 0 || medicalResultFilter !== 'all' || trainingStatusFilter !== 'all' || trainingDateFrom || trainingDateTo;

  const masterBulkFields = [
    { key: 'ftw_result', label: 'Medical Result', type: 'select', options: FTW_RESULTS.map(r => ({ value: r, label: r })) },
    { key: 'training_status', label: 'Training Status', type: 'select', options: TRAINING_STATUSES.map(s => ({ value: s.value, label: s.label })) },
    { key: 'rlic_status', label: 'RLIC Status', type: 'select', options: RLIC_STATUSES.map(s => ({ value: s.value, label: s.label })) },
    { key: 'current_location', label: 'Location', type: 'select', options: LOCATIONS.map(l => ({ value: l, label: l })) },
  ];

  const handleBulkApply = async (field, value) => {
    await Promise.all(filtered.map(e => base44.entities.Employee.update(e.id, { [field]: value })));
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    toast({ title: `Updated ${filtered.length} records` });
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Employee.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({ title: 'Record deleted' });
    },
  });

  const uniqueCompanies = useMemo(() => {
    const vals = [...new Set(employees.map(e => e.company).filter(Boolean))].sort();
    return vals.map(v => { const c = COMPANIES.find(x => x.value === v); return { value: v, label: c ? c.label : v }; });
  }, [employees]);

  const positions = useMemo(() => {
    const pos = [...new Set(employees.map(e => e.designation_org_chart).filter(Boolean))].sort();
    return pos.map(p => ({ value: p, label: p }));
  }, [employees]);

  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      if (emp.is_active === false) return false;
      const matchesSearch = !search ||
        emp.name?.toLowerCase().includes(search.toLowerCase()) ||
        emp.qid_no?.includes(search) ||
        emp.pp_no?.includes(search) ||
        emp.pid?.includes(search) ||
        emp.staff_no?.toLowerCase().includes(search.toLowerCase()) ||
        emp.nationality?.toLowerCase().includes(search.toLowerCase());
      const matchesCompany = companyFilter.length === 0 || companyFilter.includes(emp.company);
      const effectiveRlic = getEffectiveRlic(emp);
      const matchesRlic = rlicFilter === 'all' || effectiveRlic === rlicFilter;
      const matchesGpStatus = gpStatusFilter.length === 0 || gpStatusFilter.includes(effectiveRlic);
      const matchesLocation = locationFilter === 'all' || emp.current_location === locationFilter;
      const matchesDir = dirFilter === 'all' || emp.dir_indir === dirFilter;
      const matchesPosition = positionFilter.length === 0 || positionFilter.includes(emp.designation_org_chart);
      const matchesDepartment = departmentFilter === 'all' || emp.department === departmentFilter;
      const effectivePid = computePassStatus(emp.pid_expiry, 'pid', emp.pid_status);
      const matchesPidStatus = pidStatusFilter.length === 0 || pidStatusFilter.includes(effectivePid);
      const matchesMedicalResult = medicalResultFilter === 'all' || (medicalResultFilter === 'NEW' ? !emp.ftw_result : emp.ftw_result === medicalResultFilter);
      const matchesTrainingStatus = trainingStatusFilter === 'all' || emp.training_status === trainingStatusFilter;
      const empTrainStart = emp.training_date_start ? emp.training_date_start.substring(0, 10) : '';
      const matchesTrainingFrom = !trainingDateFrom || (empTrainStart && empTrainStart >= trainingDateFrom);
      const matchesTrainingTo = !trainingDateTo || (empTrainStart && empTrainStart <= trainingDateTo);
      return matchesSearch && matchesCompany && matchesRlic && matchesGpStatus && matchesLocation && matchesDir && matchesPosition && matchesDepartment && matchesPidStatus && matchesMedicalResult && matchesTrainingStatus && matchesTrainingFrom && matchesTrainingTo;
    });
  }, [employees, search, companyFilter, rlicFilter, gpStatusFilter, locationFilter, dirFilter, positionFilter, departmentFilter, pidStatusFilter, medicalResultFilter, trainingStatusFilter, trainingDateFrom, trainingDateTo, customRlicStatuses]);

  const getExportData = () => filtered.map(e => ({
    SL: e.sl_no, Name: e.name, Position_Application: e.position_application,
    Designation_Org_Chart: e.designation_org_chart, Department: e.department,
    Company: e.company, Company_Type: e.company_type, Nationality: e.nationality,
    Religion: e.religion, Location: e.current_location, DIR_INDIR: e.dir_indir,
    Contact: e.contact_details, Sponsor: e.sponsor, Remarks: e.remarks,
    QID_No: e.qid_no, QID_Expiry: formatDate(e.qid_expiry), Passport_No: e.pp_no, PP_Expiry: formatDate(e.pp_expiry),
    Visa_Date_Applied: formatDate(e.visa_date_applied), Visa_Date_Received: formatDate(e.visa_date_received), Visa_Expiry: formatDate(e.visa_expiry),
    Medical_Date: formatDate(e.ftw_medical_date), FTW_Received_Date: formatDate(e.ftw_received_date),
    FTW_Approval_Request: formatDate(e.ftw_approval_request_date), FTW_Count_Days: e.ftw_count_days,
    FTW_Approved_Date: formatDate(e.ftw_approved_date), Medical_Result: e.ftw_result,
    Doctor: e.ftw_doctor, Doctor_Mobile: e.ftw_mobile,
    Gate_Pass_Issue: formatDate(e.gate_pass_issue_date), Gate_Pass_Received: formatDate(e.gate_pass_received_date),
    Gate_Pass_Expiry: formatDate(e.gate_pass_expiry), Staff_No: e.staff_no, RLIC_Status: e.rlic_status,
    PID_No: e.pid, PID_Issue_Date: formatDate(e.pid_issue_date), PID_Expiry: formatDate(e.pid_expiry),
    PID_Projected_Date: formatDate(e.pid_projected_date), PID_Status: e.pid_status,
    Training_Date_Start: formatDate(e.training_date_start), Training_Date_End: formatDate(e.training_date_end), Training_Status: e.training_status,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Master List</h2>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} of {employees.filter(e => e.is_active !== false).length} active personnel</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={editMode ? 'default' : 'outline'} onClick={() => setEditMode(v => !v)}>
            {editMode ? <><X className="w-4 h-4 mr-2" /> Exit Edit Mode</> : <><PencilLine className="w-4 h-4 mr-2" /> Edit in Grid</>}
          </Button>
          <ExportButton getData={getExportData} filename="master_list.csv" />
          <Link to="/master-list/import">
            <Button variant="outline"><Upload className="w-4 h-4 mr-2" /> Import</Button>
          </Link>
          <Link to="/employees/new">
            <Button><Plus className="w-4 h-4 mr-2" /> Add Personnel</Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Name, QID, PP, PID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <MultiSelect options={uniqueCompanies} value={companyFilter} onChange={setCompanyFilter} placeholder="All Companies" />
          <MultiSelect options={positions} value={positionFilter} onChange={setPositionFilter} placeholder="Filter by position" />
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {['Electrical','Mechanical','Civil','Services','Steel Structure'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={rlicFilter} onValueChange={setRlicFilter}>
            <SelectTrigger><SelectValue placeholder="RLIC Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All RLIC</SelectItem>
              {RLIC_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <MultiSelect
            options={PID_STATUSES.map(s => ({ value: s.value, label: s.label }))}
            value={pidStatusFilter}
            onChange={setPidStatusFilter}
            placeholder="PID Status"
          />
          <MultiSelect
            options={allGpStatusOptions}
            value={gpStatusFilter}
            onChange={setGpStatusFilter}
            placeholder="GP Statuses"
          />
          <Select value={medicalResultFilter} onValueChange={setMedicalResultFilter}>
            <SelectTrigger><SelectValue placeholder="Medical Result" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Medical Results</SelectItem>
              <SelectItem value="NEW">New (No Result)</SelectItem>
              {MEDICAL_RESULTS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {LOCATIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dirFilter} onValueChange={setDirFilter}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="DIR">DIR</SelectItem>
                <SelectItem value="INDIR">INDIR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={trainingStatusFilter} onValueChange={setTrainingStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Training Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Training Status</SelectItem>
              {TRAINING_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input type="date" value={trainingDateFrom} onChange={e => setTrainingDateFrom(e.target.value)} className="text-xs" title="Training Start From" />
            <span className="text-xs text-muted-foreground">–</span>
            <Input type="date" value={trainingDateTo} onChange={e => setTrainingDateTo(e.target.value)} className="text-xs" title="Training Start To" />
          </div>
        </div>
        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => { setSearch(''); setCompanyFilter([]); setPositionFilter([]); setRlicFilter('all'); setLocationFilter('all'); setDirFilter('all'); setDepartmentFilter('all'); setPidStatusFilter([]); setGpStatusFilter([]); setMedicalResultFilter('all'); setTrainingStatusFilter('all'); setTrainingDateFrom(''); setTrainingDateTo(''); }}>
              <X className="w-3.5 h-3.5 mr-1" /> Clear Filters
            </Button>
          </div>
        )}
      </Card>

      {editMode && hasActiveFilters && filtered.length > 0 && (
        <BulkEditBar fields={masterBulkFields} filteredCount={filtered.length} onApply={handleBulkApply} isLoading={updateMutation.isPending} />
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="table-scroll-x">
          <div className="table-scroll-y h-[560px]">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">SL</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Name</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Position (Application)</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Designation (Org Chart)</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Department</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Company</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Company Type</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Nationality</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Religion</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Location</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">DIR/INDIR</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Contact</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Sponsor</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">QID No</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">QID Expiry</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Passport No</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PP Expiry</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Visa Applied</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Visa Received</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Visa Expiry</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Medical Date</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">FTW Received</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">FTW Approval Req</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">FTW Count Days</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">FTW Approved</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Medical Result</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Doctor</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Re-Assess Date</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Medical Remarks</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Gate Pass Issue</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Gate Pass Received</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Gate Pass Expiry</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Staff No / RLIC</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">RLIC Status</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PID No</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PID Issue</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PID Expiry</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PID Projected</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PID Status</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Training Date Started</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Training Date End</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Training Status</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Remarks</TableHead>
                <TableHead className="text-xs text-right bg-muted/50 whitespace-nowrap sticky right-0 z-20 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(8).fill(0).map((_, i) => (
                  <TableRow key={i}>{Array(41).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={41} className="text-center py-12 text-muted-foreground">No records found</TableCell>
                </TableRow>
              ) : (
                filtered.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{emp.sl_no}</TableCell>
                    <TableCell className="text-xs font-medium whitespace-nowrap"><InlineEditCell value={emp.name} field="name" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.position_application} field="position_application" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.designation_org_chart} field="designation_org_chart" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.department} field="department" empId={emp.id} type="select" options={['Electrical','Mechanical','Civil','Services','Steel Structure'].map(d=>({value:d,label:d}))} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{emp.company}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{emp.company_type || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.nationality} field="nationality" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.religion} field="religion" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.current_location} field="current_location" empId={emp.id} type="select" options={LOCATIONS.map(l=>({value:l,label:l}))} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.dir_indir} field="dir_indir" empId={emp.id} type="select" options={[{value:'DIR',label:'DIR'},{value:'INDIR',label:'INDIR'}]} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.contact_details} field="contact_details" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.sponsor} field="sponsor" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap"><InlineEditCell value={emp.qid_no} field="qid_no" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.qid_expiry} field="qid_expiry" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} className="font-mono" /></TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap"><InlineEditCell value={emp.pp_no} field="pp_no" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.pp_expiry} field="pp_expiry" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.visa_date_applied} field="visa_date_applied" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.visa_date_received} field="visa_date_received" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.visa_expiry} field="visa_expiry" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.ftw_medical_date} field="ftw_medical_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.ftw_received_date} field="ftw_received_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.ftw_approval_request_date} field="ftw_approval_request_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.ftw_count_days} field="ftw_count_days" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.ftw_approved_date} field="ftw_approved_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      <InlineEditCell value={emp.ftw_result} field="ftw_result" empId={emp.id} type="select" options={FTW_RESULTS.map(r=>({value:r,label:r}))} onSave={handleCellSave} editMode={editMode} />
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.ftw_doctor} field="ftw_doctor" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.ftw_reassess_date} field="ftw_reassess_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.ftw_remarks} field="ftw_remarks" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.gate_pass_issue_date} field="gate_pass_issue_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.gate_pass_received_date} field="gate_pass_received_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.gate_pass_expiry} field="gate_pass_expiry" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.staff_no} field="staff_no" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="whitespace-nowrap"><StatusBadge dateStr={emp.gate_pass_expiry} type="rlic" storedStatus={emp.rlic_status} short /></TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap"><InlineEditCell value={emp.pid} field="pid" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.pid_issue_date} field="pid_issue_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.pid_expiry} field="pid_expiry" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.pid_projected_date} field="pid_projected_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="whitespace-nowrap"><StatusBadge dateStr={emp.pid_expiry} type="pid" storedStatus={emp.pid_status} short /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.training_date_start} field="training_date_start" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.training_date_end} field="training_date_end" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      <InlineEditCell value={emp.training_status} field="training_status" empId={emp.id} type="select" options={TRAINING_STATUSES.map(s=>({value:s.value,label:s.label}))} onSave={handleCellSave} editMode={editMode} />
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.remarks} field="remarks" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="sticky right-0 bg-white z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">
                      <div className="flex justify-end gap-1">
                        <Link to={`/employees/${emp.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3.5 h-3.5" /></Button>
                        </Link>
                        <Link to={`/employees/${emp.id}/edit`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button>
                        </Link>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Record</AlertDialogTitle>
                              <AlertDialogDescription>Delete {emp.name}? This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(emp.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </div>
        <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
          Showing <strong>{filtered.length}</strong> of <strong>{employees.length}</strong> records
        </div>
      </Card>
    </div>
  );
}