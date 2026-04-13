import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Eye, Pencil, Trash2, Upload } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '../components/common/StatusBadge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { COMPANIES, RLIC_STATUSES, LOCATIONS, formatDate } from '@/utils/constants';
import MultiSelect from '../components/common/MultiSelect';
import ExportButton from '../components/common/ExportButton';

export default function MasterList() {
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState([]);
  const [rlicFilter, setRlicFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [dirFilter, setDirFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 2000),
  });

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
      const matchesSearch = !search ||
        emp.name?.toLowerCase().includes(search.toLowerCase()) ||
        emp.qid_no?.includes(search) ||
        emp.pp_no?.includes(search) ||
        emp.pid?.includes(search) ||
        emp.staff_no?.toLowerCase().includes(search.toLowerCase()) ||
        emp.nationality?.toLowerCase().includes(search.toLowerCase());
      const matchesCompany = companyFilter.length === 0 || companyFilter.includes(emp.company);
      const matchesRlic = rlicFilter === 'all' || emp.rlic_status === rlicFilter;
      const matchesLocation = locationFilter === 'all' || emp.current_location === locationFilter;
      const matchesDir = dirFilter === 'all' || emp.dir_indir === dirFilter;
      const matchesPosition = positionFilter.length === 0 || positionFilter.includes(emp.designation_org_chart);
      return matchesSearch && matchesCompany && matchesRlic && matchesLocation && matchesDir && matchesPosition;
    });
  }, [employees, search, companyFilter, rlicFilter, locationFilter, dirFilter, positionFilter]);

  const getExportData = () => filtered.map(e => ({
    SL: e.sl_no, Name: e.name, Position_Application: e.position_application,
    Designation_Org_Chart: e.designation_org_chart, Department: e.department,
    Company: e.company, Company_Type: e.company_type, Nationality: e.nationality,
    Religion: e.religion, Location: e.current_location, DIR_INDIR: e.dir_indir,
    Contact: e.contact_details, Sponsor: e.sponsor, Remarks: e.remarks,
    QID_No: e.qid_no, QID_Expiry: e.qid_expiry, Passport_No: e.pp_no, PP_Expiry: e.pp_expiry,
    Visa_Date_Applied: e.visa_date_applied, Visa_Date_Received: e.visa_date_received, Visa_Expiry: e.visa_expiry,
    Medical_Date: e.ftw_medical_date, FTW_Received_Date: e.ftw_received_date,
    FTW_Approval_Request: e.ftw_approval_request_date, FTW_Count_Days: e.ftw_count_days,
    FTW_Approved_Date: e.ftw_approved_date, Medical_Result: e.ftw_result,
    Doctor: e.ftw_doctor, Doctor_Mobile: e.ftw_mobile,
    Gate_Pass_Issue: e.gate_pass_issue_date, Gate_Pass_Received: e.gate_pass_received_date,
    Gate_Pass_Expiry: e.gate_pass_expiry, Staff_No: e.staff_no, RLIC_Status: e.rlic_status,
    PID_No: e.pid, PID_Issue_Date: e.pid_issue_date, PID_Expiry: e.pid_expiry,
    PID_Projected_Date: e.pid_projected_date, PID_Status: e.pid_status,
    Training_Date: e.training_date, Training_Status: e.training_status,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Master List</h2>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} of {employees.length} personnel</p>
        </div>
        <div className="flex gap-2">
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
          <Select value={rlicFilter} onValueChange={setRlicFilter}>
            <SelectTrigger><SelectValue placeholder="RLIC Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All RLIC</SelectItem>
              {RLIC_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
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
        </div>
      </Card>

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
                    <TableCell className="text-xs font-medium whitespace-nowrap">{emp.name}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{emp.position_application || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{emp.designation_org_chart || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{emp.department || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{emp.company}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{emp.company_type || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{emp.nationality || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{emp.religion || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{emp.current_location || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{emp.dir_indir || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{emp.contact_details || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{emp.sponsor || '—'}</TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap">{emp.qid_no || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.qid_expiry)}</TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap">{emp.pp_no || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.pp_expiry)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.visa_date_applied)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.visa_date_received)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.visa_expiry)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.ftw_medical_date)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.ftw_received_date)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.ftw_approval_request_date)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{emp.ftw_count_days ?? '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.ftw_approved_date)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {emp.ftw_result ? (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          emp.ftw_result === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700' :
                          emp.ftw_result === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                        }`}>{emp.ftw_result}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{emp.ftw_doctor || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.ftw_reassess_date)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{emp.ftw_remarks || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.gate_pass_issue_date)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.gate_pass_received_date)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.gate_pass_expiry)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{emp.staff_no || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap"><StatusBadge status={emp.rlic_status} short /></TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap">{emp.pid || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.pid_issue_date)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.pid_expiry)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.pid_projected_date)}</TableCell>
                    <TableCell className="whitespace-nowrap"><StatusBadge status={emp.pid_status} short /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.training_date_start)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.training_date_end)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {emp.training_status ? (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          emp.training_status === 'DONE' ? 'bg-emerald-50 text-emerald-700' :
                          emp.training_status === 'PENDING' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}>{emp.training_status}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{emp.remarks || '—'}</TableCell>
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