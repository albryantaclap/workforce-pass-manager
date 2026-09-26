import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { useManagerFilter } from '@/hooks/useManagerFilter';
import WorkforceSubmenuNav from '@/components/common/WorkforceSubmenuNav';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Eye, Pencil, Trash2, Upload, X, PencilLine, UserX, LogOut, HardHat, UserPlus } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import StatusChangeModal from '../components/common/StatusChangeModal';
import PersonnelAvatar from '../components/common/PersonnelAvatar';
import SharepointDocIcon from '../components/common/SharepointDocIcon';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '../components/common/StatusBadge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { COMPANIES, RLIC_STATUSES, PID_STATUSES, LOCATIONS, MEDICAL_RESULTS, FTW_RESULTS, TRAINING_STATUSES, formatDate, computePassStatus } from '@/utils/constants';
import { useLookupOptions } from '@/hooks/useLookupOptions';
import { useLatestCampStays } from '@/hooks/useLatestCampStays';
import { formatTime, formatDateOnly, formatDuration, getAttendanceStatus, formatDateTimeCompact, ATT_STATUS } from '@/lib/attendanceUtils';

import MultiSelect from '../components/common/MultiSelect';
import ExportButton from '../components/common/ExportButton';
import InlineEditCell from '../components/common/InlineEditCell';
import BulkEditBar from '../components/common/BulkEditBar';
import { ACTIVE_ON_SITE, ONBOARDING, INACTIVE, DEMOBILIZED, isActiveRosterStatus, resolvePersonnelStatus, personnelStatusLabel } from '@/lib/personnelStatus';
import { usePermissions } from '@/lib/usePermissions';
import { useCurrentUser } from '@/lib/useCurrentUser';

const STORAGE_KEY = 'masterlist_filters';

function loadFilters() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
    return {
      ...saved,
      companyFilter: Array.isArray(saved.companyFilter) ? saved.companyFilter : [],
      positionFilter: Array.isArray(saved.positionFilter) ? saved.positionFilter : [],
      departmentFilter: Array.isArray(saved.departmentFilter) ? saved.departmentFilter : [],
      pidStatusFilter: Array.isArray(saved.pidStatusFilter) ? saved.pidStatusFilter : [],
      gpStatusFilter: Array.isArray(saved.gpStatusFilter) ? saved.gpStatusFilter : [],
      medicalResultFilter: Array.isArray(saved.medicalResultFilter) ? saved.medicalResultFilter : [],
      attendanceFilter: saved.attendanceFilter || 'all',
      page: typeof saved.page === 'number' ? saved.page : 0,
    };
  } catch { return {}; }
}
function saveFilters(f) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch {}
}

export default function MasterList() {
  const { canEdit, canDelete } = usePermissions();
  const currentUser = useCurrentUser();
  const { selectedManagerIds, setSelectedManagerIds, managers } = useManagerFilter();
  const [editMode, setEditMode] = useState(false);
  // Exactly three tabs. 'all' = Active on Site + Onboarding (the active roster).
  // Inactive / Demobilized never appear here — they live on their own page.
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'active_on_site' | 'onboarding'
  const saved = useMemo(() => loadFilters(), []);
  const [searchInput, setSearchInput] = useState(saved.search || '');
  const [search, setSearch] = useState(saved.search || '');
  const [page, setPage] = useState(saved.page || 0);
  const PAGE_SIZE = 50;

  // Debounce search input
  const searchDebounceRef = useRef(null);
  const handleSearchChange = useCallback((val) => {
    setSearchInput(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearch(val);
      setPage(0);
    }, 300);
  }, []);
  const [companyFilter, setCompanyFilter] = useState(saved.companyFilter || []);
  const [rlicFilter, setRlicFilter] = useState(saved.rlicFilter || 'all');
  const [locationFilter, setLocationFilter] = useState(saved.locationFilter || 'all');
  const [dirFilter, setDirFilter] = useState(saved.dirFilter || 'all');
  const [positionFilter, setPositionFilter] = useState(saved.positionFilter || []);
  const [departmentFilter, setDepartmentFilter] = useState(saved.departmentFilter || []);
  const [pidStatusFilter, setPidStatusFilter] = useState(saved.pidStatusFilter || []);
  const [gpStatusFilter, setGpStatusFilter] = useState(saved.gpStatusFilter || []);
  const [medicalResultFilter, setMedicalResultFilter] = useState(saved.medicalResultFilter || []);
  const [trainingStatusFilter, setTrainingStatusFilter] = useState(saved.trainingStatusFilter || 'all');
  const [attendanceFilter, setAttendanceFilter] = useState(saved.attendanceFilter || 'all');
  const [trainingScheduledFrom, setTrainingScheduledFrom] = useState(saved.trainingScheduledFrom || '');
  const [trainingScheduledTo, setTrainingScheduledTo] = useState(saved.trainingScheduledTo || '');
  const [medicalTrApprovedFrom, setMedicalTrApprovedFrom] = useState(saved.medicalTrApprovedFrom || '');
  const [medicalTrApprovedTo, setMedicalTrApprovedTo] = useState(saved.medicalTrApprovedTo || '');
  const [gpIssueFrom, setGpIssueFrom] = useState(saved.gpIssueFrom || '');
  const [gpIssueTo, setGpIssueTo] = useState(saved.gpIssueTo || '');
  const [gpReceivedFrom, setGpReceivedFrom] = useState(saved.gpReceivedFrom || '');
  const [gpReceivedTo, setGpReceivedTo] = useState(saved.gpReceivedTo || '');
  const [pidIssueFrom, setPidIssueFrom] = useState(saved.pidIssueFrom || '');
  const [pidIssueTo, setPidIssueTo] = useState(saved.pidIssueTo || '');

  useEffect(() => {
    saveFilters({ search, companyFilter, rlicFilter, locationFilter, dirFilter, positionFilter, departmentFilter, pidStatusFilter, gpStatusFilter, medicalResultFilter, trainingStatusFilter, attendanceFilter, trainingScheduledFrom, trainingScheduledTo, medicalTrApprovedFrom, medicalTrApprovedTo, gpIssueFrom, gpIssueTo, gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo, page });
  }, [search, companyFilter, rlicFilter, locationFilter, dirFilter, positionFilter, departmentFilter, pidStatusFilter, gpStatusFilter, medicalResultFilter, trainingStatusFilter, attendanceFilter, trainingScheduledFrom, trainingScheduledTo, medicalTrApprovedFrom, medicalTrApprovedTo, gpIssueFrom, gpIssueTo, gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo, page]);

  // Reset page on filter changes (skip initial mount to allow sessionStorage restore)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    setPage(0);
  }, [companyFilter, rlicFilter, locationFilter, dirFilter, positionFilter, departmentFilter, pidStatusFilter, gpStatusFilter, medicalResultFilter, trainingStatusFilter, attendanceFilter, trainingScheduledFrom, trainingScheduledTo, medicalTrApprovedFrom, medicalTrApprovedTo, gpIssueFrom, gpIssueTo, gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    companyOptions, companyTypeOptions, locationOptions, departmentOptions,
    rlicStatusOptions, pidStatusOptions, medicalResultOptions, trainingStatusOptions,
  } = useLookupOptions();

  const allGpStatusOptions = rlicStatusOptions;

  const getEffectiveRlic = (e) => computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);

  // Only fetch active employees — dedicated filter avoids the list cap hiding records
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, '-created_date', 100000),
  });

  // Latest camp stay per personnel — camp/accommodation movement (ComoCampStay).
  // This is separate from work attendance (AttendanceRecord). The Master List
  // shows Camp Check-in / Camp Check-out from this source.
  const { latestByPersonnel: latestAttByPersonnel } = useLatestCampStays();

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, { ...data, _last_updated_by: currentUser?.email || '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees-active'] }),
    onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
  });

  const handleCellSave = (id, field, value) => {
    updateMutation.mutate({ id, data: { [field]: value } });
  };

  const hasActiveFilters = selectedManagerIds.length > 0 || searchInput || companyFilter.length > 0 || positionFilter.length > 0 || rlicFilter !== 'all' || locationFilter !== 'all' || dirFilter !== 'all' || departmentFilter.length > 0 || pidStatusFilter.length > 0 || gpStatusFilter.length > 0 || medicalResultFilter.length > 0 || trainingStatusFilter !== 'all' || attendanceFilter !== 'all' || trainingScheduledFrom || trainingScheduledTo || medicalTrApprovedFrom || medicalTrApprovedTo || gpIssueFrom || gpIssueTo || gpReceivedFrom || gpReceivedTo || pidIssueFrom || pidIssueTo;

  const masterBulkFields = [
    { key: 'ftw_result', label: 'Medical Result', type: 'select', options: medicalResultOptions },
    { key: 'training_status', label: 'Training Status', type: 'select', options: trainingStatusOptions },
    { key: 'rlic_status', label: 'RLIC Status', type: 'select', options: rlicStatusOptions },
    { key: 'current_location', label: 'Location', type: 'select', options: locationOptions },
  ];

  const handleBulkApply = async (field, value) => {
    await Promise.all(filtered.map(e => base44.entities.Employee.update(e.id, { [field]: value })));
    queryClient.invalidateQueries({ queryKey: ['employees-active'] });
    toast({ title: `Updated ${filtered.length} records` });
  };

  // Move to Onboarding / Inactive / Demobilized — opens the StatusChangeModal, then updates the record.
  // The entity automation (Track Employee Changes) writes the audit log field-level diff.
  const [statusModal, setStatusModal] = useState({ open: false, emp: null, newStatus: INACTIVE });
  const openStatusModal = (emp, newStatus) => setStatusModal({ open: true, emp, newStatus });

  const statusChangeMutation = useMutation({
    mutationFn: async ({ emp, newStatus, effectiveDate, lastWorkingDate, reason }) => {
      const updates = {
        personnel_status: newStatus,
        is_active: isActiveRosterStatus(newStatus),
        status_effective_date: effectiveDate,
        status_reason: reason || '',
        status_changed_by: currentUser?.email || '',
        status_changed_at: new Date().toISOString(),
        _last_updated_by: currentUser?.email || '',
        _last_updated_by_name: currentUser?.full_name || '',
        _last_updated_by_role: currentUser?.role || '',
        _last_updated_at: new Date().toISOString(),
      };
      if (lastWorkingDate) updates.last_working_date = lastWorkingDate;
      if (newStatus === INACTIVE) updates.inactive_date = effectiveDate;
      if (newStatus === DEMOBILIZED) updates.demobilization_date = effectiveDate;
      return base44.entities.Employee.update(emp.id, updates);
    },
    onSuccess: (_, { emp, newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['employees-active'] });
      queryClient.invalidateQueries({ queryKey: ['employees-inactive'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      toast({ title: `Status updated to ${newStatus}`, description: `${emp.name} moved to ${newStatus} Personnel.` });
    },
    onError: () => toast({ title: 'Status change failed', variant: 'destructive' }),
  });

  // Delete — stamp the deleter's identity first so the automation attributes the delete to the
  // correct user, then delete. The automation archives the record to Deleted Personnel and
  // writes the audit log entry. No manual duplicate records are created.
  const deleteMutation = useMutation({
    mutationFn: async (emp) => {
      await base44.entities.Employee.update(emp.id, {
        _last_updated_by: currentUser?.email || '',
        _last_updated_by_name: currentUser?.full_name || '',
        _last_updated_by_role: currentUser?.role || '',
        _last_updated_at: new Date().toISOString(),
      });
      await base44.entities.Employee.delete(emp.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-active'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-employees'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      toast({ title: 'Personnel deleted', description: 'Record moved to Deleted Personnel.' });
    },
    onError: () => toast({ title: 'Delete failed', variant: 'destructive' }),
  });

  const uniqueCompanies = useMemo(() => {
    const vals = [...new Set(employees.map(e => e.company).filter(Boolean))].sort();
    return vals.map(v => { const c = COMPANIES.find(x => x.value === v); return { value: v, label: c ? c.label : v }; });
  }, [employees]);

  // Cascading company options: when department is selected, only show companies with employees in that dept
  const cascadedCompanyOptions = useMemo(() => {
    if (departmentFilter.length === 0) return uniqueCompanies;
    const deptSet = new Set(departmentFilter.map(d => d.trim().toLowerCase()));
    const validCompanies = new Set(
      employees
        .filter(e => deptSet.has((e.department || '').trim().toLowerCase()))
        .map(e => (e.company || '').trim().toUpperCase())
    );
    return uniqueCompanies.filter(c => validCompanies.has(c.value.trim().toUpperCase()));
  }, [uniqueCompanies, departmentFilter, employees]);

  // Reset company selections that are no longer valid after department filter changes
  useEffect(() => {
    if (companyFilter.length === 0) return;
    const validSet = new Set(cascadedCompanyOptions.map(c => c.value.trim().toUpperCase()));
    const still = companyFilter.filter(cf => validSet.has(cf.trim().toUpperCase()));
    if (still.length !== companyFilter.length) setCompanyFilter(still);
  }, [cascadedCompanyOptions]);

  const positions = useMemo(() => {
    const pos = [...new Set(employees.map(e => e.designation_org_chart).filter(Boolean))].sort();
    return pos.map(p => ({ value: p, label: p }));
  }, [employees]);

  // Cascade positions by company, department, gate pass status, and PID status
  const filteredPositions = useMemo(() => {
    const hasFilter = companyFilter.length > 0 || departmentFilter.length > 0 || gpStatusFilter.length > 0 || pidStatusFilter.length > 0;
    if (!hasFilter) return positions;
    const coSet = companyFilter.length > 0 ? new Set(companyFilter.map(c => c.trim().toUpperCase())) : null;
    const deptSet = departmentFilter.length > 0 ? new Set(departmentFilter.map(d => d.trim().toLowerCase())) : null;
    const seen = new Set();
    return employees
      .filter(e => {
        if (!e.designation_org_chart) return false;
        if (coSet && !coSet.has((e.company || '').trim().toUpperCase())) return false;
        if (deptSet && !deptSet.has((e.department || '').trim().toLowerCase())) return false;
        if (gpStatusFilter.length > 0 && !gpStatusFilter.includes(computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status))) return false;
        if (pidStatusFilter.length > 0 && !pidStatusFilter.includes(computePassStatus(e.pid_expiry, 'pid', e.pid_status))) return false;
        return true;
      })
      .map(e => e.designation_org_chart.trim())
      .filter(p => { if (seen.has(p)) return false; seen.add(p); return true; })
      .sort()
      .map(p => ({ value: p, label: p }));
  }, [employees, companyFilter, departmentFilter, gpStatusFilter, pidStatusFilter]);

  // Reset position when any parent filter changes; keep only valid selections
  useEffect(() => {
    if (positionFilter.length === 0) return;
    const valid = new Set(filteredPositions.map(p => p.value));
    const still = positionFilter.filter(p => valid.has(p));
    if (still.length !== positionFilter.length) setPositionFilter(still);
  }, [filteredPositions]);

  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      // All fetched records are already active — no need to re-check is_active here
      const matchesSearch = !search ||
        emp.name?.toLowerCase().includes(search.toLowerCase()) ||
        emp.qid_no?.includes(search) ||
        emp.pp_no?.includes(search) ||
        emp.pid?.includes(search) ||
        emp.staff_no?.toLowerCase().includes(search.toLowerCase()) ||
        emp.nationality?.toLowerCase().includes(search.toLowerCase());
      const matchesCompany = companyFilter.length === 0 || companyFilter.includes(emp.company);
      const matchesManager = selectedManagerIds.length === 0 || selectedManagerIds.some(mid =>
        emp.assigned_manager_id ? emp.assigned_manager_id === mid : emp.assigned_manager_name === managers.find(m => m.id === mid)?.label
      );
      const effectiveRlic = getEffectiveRlic(emp);
      const matchesRlic = rlicFilter === 'all' || effectiveRlic === rlicFilter;
      const matchesGpStatus = gpStatusFilter.length === 0 || gpStatusFilter.includes(effectiveRlic);
      const matchesLocation = locationFilter === 'all' || emp.current_location === locationFilter;
      const matchesDir = dirFilter === 'all' || emp.dir_indir === dirFilter;
      const matchesPosition = positionFilter.length === 0 || positionFilter.includes(emp.designation_org_chart);
      const matchesDepartment = departmentFilter.length === 0 || departmentFilter.includes(emp.department);
      const effectivePid = computePassStatus(emp.pid_expiry, 'pid', emp.pid_status);
      const matchesPidStatus = pidStatusFilter.length === 0 || pidStatusFilter.includes(effectivePid);
      const matchesMedicalResult = medicalResultFilter.length === 0 || medicalResultFilter.includes(emp.ftw_result) || (medicalResultFilter.includes('NEW') && !emp.ftw_result);
      const matchesTrainingStatus = trainingStatusFilter === 'all' || emp.training_status === trainingStatusFilter;
      const empTrainScheduled = emp.training_date_scheduled ? emp.training_date_scheduled.substring(0, 10) : '';
      const matchesTrainingScheduledFrom = !trainingScheduledFrom || (empTrainScheduled && empTrainScheduled >= trainingScheduledFrom);
      const matchesTrainingScheduledTo = !trainingScheduledTo || (empTrainScheduled && empTrainScheduled <= trainingScheduledTo);
      const empMedTrApproved = emp.ftw_approved_date ? emp.ftw_approved_date.substring(0, 10) : '';
      const matchesMedicalTrApprovedFrom = !medicalTrApprovedFrom || (empMedTrApproved && empMedTrApproved >= medicalTrApprovedFrom);
      const matchesMedicalTrApprovedTo = !medicalTrApprovedTo || (empMedTrApproved && empMedTrApproved <= medicalTrApprovedTo);
      const empGpIssue = emp.gate_pass_issue_date ? emp.gate_pass_issue_date.substring(0, 10) : '';
      const matchesGpIssueFrom = !gpIssueFrom || (empGpIssue && empGpIssue >= gpIssueFrom);
      const matchesGpIssueTo = !gpIssueTo || (empGpIssue && empGpIssue <= gpIssueTo);
      const empGpReceived = emp.gate_pass_received_date ? emp.gate_pass_received_date.substring(0, 10) : '';
      const matchesGpReceivedFrom = !gpReceivedFrom || (empGpReceived && empGpReceived >= gpReceivedFrom);
      const matchesGpReceivedTo = !gpReceivedTo || (empGpReceived && empGpReceived <= gpReceivedTo);
      const empPidIssue = emp.pid_issue_date ? emp.pid_issue_date.substring(0, 10) : '';
      const matchesPidIssueFrom = !pidIssueFrom || (empPidIssue && empPidIssue >= pidIssueFrom);
      const matchesPidIssueTo = !pidIssueTo || (empPidIssue && empPidIssue <= pidIssueTo);
      const attRec = latestAttByPersonnel.get(emp.id);
      const attSt = getAttendanceStatus(attRec);
      const matchesAttendance = attendanceFilter === 'all' || attSt === attendanceFilter;
      return matchesSearch && matchesCompany && matchesManager && matchesRlic && matchesGpStatus && matchesLocation && matchesDir && matchesPosition && matchesDepartment && matchesPidStatus && matchesMedicalResult && matchesTrainingStatus && matchesAttendance && matchesTrainingScheduledFrom && matchesTrainingScheduledTo && matchesMedicalTrApprovedFrom && matchesMedicalTrApprovedTo && matchesGpIssueFrom && matchesGpIssueTo && matchesGpReceivedFrom && matchesGpReceivedTo && matchesPidIssueFrom && matchesPidIssueTo;
    });
  },     [employees, search, companyFilter, rlicFilter, gpStatusFilter, locationFilter, dirFilter, positionFilter, departmentFilter, pidStatusFilter, medicalResultFilter, trainingStatusFilter, attendanceFilter, trainingScheduledFrom, trainingScheduledTo, medicalTrApprovedFrom, medicalTrApprovedTo, gpIssueFrom, gpIssueTo, gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo, selectedManagerIds, managers, latestAttByPersonnel]);

  // ── Personnel Status tab lists ──
  // 'All Personnel' is the whole active roster (= Active on Site + Onboarding).
  // Inactive / Demobilized records are never fetched here (is_active = false),
  // so they cannot appear in any tab. Both lists derive from `filtered`, so
  // every existing filter still applies inside the selected tab.
  const activeOnSiteList = useMemo(() => filtered.filter(e => resolvePersonnelStatus(e) === ACTIVE_ON_SITE), [filtered]);
  const onboardingList = useMemo(() => filtered.filter(e => resolvePersonnelStatus(e) === ONBOARDING), [filtered]);

  // Active data set based on selected tab
  const tabData = useMemo(() => {
    if (activeTab === 'active_on_site') return activeOnSiteList;
    if (activeTab === 'onboarding') return onboardingList;
    return filtered;
  }, [activeTab, filtered, activeOnSiteList, onboardingList]);

  const totalPages = Math.ceil(tabData.length / PAGE_SIZE);
  // Auto-adjust page when it exceeds total pages (e.g. after delete on last page)
  useEffect(() => {
    if (totalPages > 0 && page >= totalPages) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [totalPages, page, activeTab]);
  const pagedRows = useMemo(() => tabData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [tabData, page]);

  const getExportData = () => tabData.map(e => {
    const att = latestAttByPersonnel.get(e.id);
    const ci = att?.check_in_at ? new Date(att.check_in_at) : null;
    const co = att?.check_out_at ? new Date(att.check_out_at) : null;
    return {
      SL: e.sl_no, Name: e.name, Position_Application: e.position_application,
      Designation_Org_Chart: e.designation_org_chart, Department: e.department,
      Company: e.company, Company_Type: e.company_type, Personnel_Status: personnelStatusLabel(resolvePersonnelStatus(e)), Nationality: e.nationality,
      Religion: e.religion, Location: e.current_location,
      Camp_Check_in_Date: ci ? ci.toLocaleDateString('en-CA') : '',
      Camp_Check_in_Time: ci ? ci.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
      Camp_Check_out_Date: co ? co.toLocaleDateString('en-CA') : '',
      Camp_Check_out_Time: co ? co.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
      Camp_Stay_Duration: att?.check_out_at ? formatDuration(att.duration_minutes) : '',
      DIR_INDIR: e.dir_indir,
      Contact: e.contact_details, Sponsor: e.sponsor, Remarks: e.remarks,
      QID_No: e.qid_no, QID_Expiry: formatDate(e.qid_expiry), Passport_No: e.pp_no, PP_Expiry: formatDate(e.pp_expiry),
      Visa_Date_Applied: formatDate(e.visa_date_applied), Visa_Date_Received: formatDate(e.visa_date_received), Visa_Expiry: formatDate(e.visa_expiry),
      Medical_Date: formatDate(e.ftw_medical_date), FTW_Received_Date: formatDate(e.ftw_received_date),
      FTW_Approval_Request: formatDate(e.ftw_approval_request_date), FTW_Count_Days: e.ftw_count_days,
      FTW_Approved_Date: formatDate(e.ftw_approved_date), Medical_Result: e.ftw_result,
      Doctor: e.ftw_doctor, Doctor_Mobile: e.ftw_mobile,
      Gate_Pass_Submitted_Date: formatDate(e.gate_pass_issue_date), Gate_Pass_Received: formatDate(e.gate_pass_received_date),
      Gate_Pass_Expiry: formatDate(e.gate_pass_expiry), Staff_No: e.staff_no, RLIC_Status: e.rlic_status,
      PID_No: e.pid, PID_Issue_Date: formatDate(e.pid_issue_date), PID_Expiry: formatDate(e.pid_expiry),
      PID_Projected_Date: formatDate(e.pid_projected_date), PID_Status: e.pid_status,
      Training_Date_Scheduled: formatDate(e.training_date_scheduled), Training_Date_Start: formatDate(e.training_date_start), Training_Date_End: formatDate(e.training_date_end), Training_Status: e.training_status,
      Assigned_Manager: e.assigned_manager_name || 'Unassigned',
    };
  });

  return (
    <div className="space-y-5">
      <WorkforceSubmenuNav />
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Master List</h2>
          <p className="text-sm text-muted-foreground mt-1">{tabData.length} of {employees.length} active personnel</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <Button variant={editMode ? 'default' : 'outline'} onClick={() => setEditMode(v => !v)}>
              {editMode ? <><X className="w-4 h-4 mr-2" /> Exit Edit Mode</> : <><PencilLine className="w-4 h-4 mr-2" /> Edit in Grid</>}
            </Button>
          )}
          <ExportButton getData={getExportData} filename="master_list.csv" />
          {canEdit && (
            <Link to="/master-list/import">
              <Button variant="outline"><Upload className="w-4 h-4 mr-2" /> Import</Button>
            </Link>
          )}
          {canEdit && (
            <Link to="/employees/new">
              <Button><Plus className="w-4 h-4 mr-2" /> Add Personnel</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        {/* Row 1: dropdowns & selects */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-3">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Name, QID, PP, PID..." value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} className="pl-9" />
          </div>
          <MultiSelect options={cascadedCompanyOptions} value={companyFilter} onChange={setCompanyFilter} placeholder="All Companies" className="dropdown-company" />
          <MultiSelect options={filteredPositions} value={positionFilter} onChange={setPositionFilter} placeholder="Filter by position" className="dropdown-position" />
          <MultiSelect options={departmentOptions} value={departmentFilter} onChange={setDepartmentFilter} placeholder="Filter by department" className="dropdown-department" />
          <Select value={rlicFilter} onValueChange={setRlicFilter}>
            <SelectTrigger className="dropdown-status"><SelectValue placeholder="RLIC Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All RLIC</SelectItem>
              {rlicStatusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <MultiSelect options={pidStatusOptions} value={pidStatusFilter} onChange={setPidStatusFilter} placeholder="PID Status" className="dropdown-status" />
          <MultiSelect options={allGpStatusOptions} value={gpStatusFilter} onChange={setGpStatusFilter} placeholder="GP Statuses" className="dropdown-status" />
          <MultiSelect options={[{ value: 'NEW', label: 'New' }, ...medicalResultOptions]} value={medicalResultFilter} onChange={setMedicalResultFilter} placeholder="Medical Result" className="dropdown-status" />
          <div className="flex gap-2">
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="dropdown-location"><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locationOptions.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dirFilter} onValueChange={setDirFilter}>
              <SelectTrigger className="w-28 dropdown-location"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="DIR">DIR</SelectItem>
                <SelectItem value="INDIR">INDIR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={trainingStatusFilter} onValueChange={setTrainingStatusFilter}>
             <SelectTrigger className="dropdown-training"><SelectValue placeholder="Training Status" /></SelectTrigger>
             <SelectContent>
               <SelectItem value="all">All Training Status</SelectItem>
               {trainingStatusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
             </SelectContent>
           </Select>
           <Select value={attendanceFilter} onValueChange={setAttendanceFilter}>
             <SelectTrigger className="dropdown-status"><SelectValue placeholder="Camp Status" /></SelectTrigger>
             <SelectContent>
               <SelectItem value="all">All Camp Status</SelectItem>
               <SelectItem value={ATT_STATUS.CHECKED_IN}>Inside Camp</SelectItem>
               <SelectItem value={ATT_STATUS.CHECKED_OUT}>Checked Out</SelectItem>
               <SelectItem value={ATT_STATUS.NOT_CHECKED_IN}>Not Checked In</SelectItem>
             </SelectContent>
           </Select>
           <MultiSelect
             options={managers.map(m => ({ value: m.id, label: m.label }))}
             value={selectedManagerIds}
             onChange={setSelectedManagerIds}
             placeholder="All Managers"
             className="dropdown-manager"
           />
          </div>

        {/* Row 2: date range filters */}
         <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-5 lg:gap-3">
           <div>
             <p className="text-[10px] font-medium text-muted-foreground mb-1">Training Scheduled</p>
             <div className="flex flex-col sm:flex-row sm:items-center gap-1">
               <Input type="date" value={trainingScheduledFrom} onChange={e => setTrainingScheduledFrom(e.target.value)} className="text-xs h-8 flex-1" title="From" placeholder="From" />
               <span className="hidden sm:block text-muted-foreground text-xs">–</span>
               <Input type="date" value={trainingScheduledTo} onChange={e => setTrainingScheduledTo(e.target.value)} className="text-xs h-8 flex-1" title="To" placeholder="To" />
             </div>
           </div>
           <div>
             <p className="text-[10px] font-medium text-muted-foreground mb-1">Medical TR Approved</p>
             <div className="flex flex-col sm:flex-row sm:items-center gap-1">
               <Input type="date" value={medicalTrApprovedFrom} onChange={e => setMedicalTrApprovedFrom(e.target.value)} className="text-xs h-8 flex-1" title="From" placeholder="From" />
               <span className="hidden sm:block text-muted-foreground text-xs">–</span>
               <Input type="date" value={medicalTrApprovedTo} onChange={e => setMedicalTrApprovedTo(e.target.value)} className="text-xs h-8 flex-1" title="To" placeholder="To" />
             </div>
           </div>
           <div>
             <p className="text-[10px] font-medium text-muted-foreground mb-1">Gate Pass Submitted</p>
             <div className="flex flex-col sm:flex-row sm:items-center gap-1">
               <Input type="date" value={gpIssueFrom} onChange={e => setGpIssueFrom(e.target.value)} className="text-xs h-8 flex-1" title="From" placeholder="From" />
               <span className="hidden sm:block text-muted-foreground text-xs">–</span>
               <Input type="date" value={gpIssueTo} onChange={e => setGpIssueTo(e.target.value)} className="text-xs h-8 flex-1" title="To" placeholder="To" />
             </div>
           </div>
           <div>
             <p className="text-[10px] font-medium text-muted-foreground mb-1">Gate Pass Received</p>
             <div className="flex flex-col sm:flex-row sm:items-center gap-1">
               <Input type="date" value={gpReceivedFrom} onChange={e => setGpReceivedFrom(e.target.value)} className="text-xs h-8 flex-1" title="From" placeholder="From" />
               <span className="hidden sm:block text-muted-foreground text-xs">–</span>
               <Input type="date" value={gpReceivedTo} onChange={e => setGpReceivedTo(e.target.value)} className="text-xs h-8 flex-1" title="To" placeholder="To" />
             </div>
           </div>
           <div>
             <p className="text-[10px] font-medium text-muted-foreground mb-1">Project ID Issue</p>
             <div className="flex flex-col sm:flex-row sm:items-center gap-1">
               <Input type="date" value={pidIssueFrom} onChange={e => setPidIssueFrom(e.target.value)} className="text-xs h-8 flex-1" title="From" placeholder="From" />
               <span className="hidden sm:block text-muted-foreground text-xs">–</span>
               <Input type="date" value={pidIssueTo} onChange={e => setPidIssueTo(e.target.value)} className="text-xs h-8 flex-1" title="To" placeholder="To" />
             </div>
           </div>
         </div>
        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => { setSelectedManagerIds([]); setSearchInput(''); setSearch(''); setCompanyFilter([]); setPositionFilter([]); setRlicFilter('all'); setLocationFilter('all'); setDirFilter('all'); setDepartmentFilter([]); setPidStatusFilter([]); setGpStatusFilter([]); setMedicalResultFilter([]); setTrainingStatusFilter('all'); setAttendanceFilter('all'); setTrainingScheduledFrom(''); setTrainingScheduledTo(''); setMedicalTrApprovedFrom(''); setMedicalTrApprovedTo(''); setGpIssueFrom(''); setGpIssueTo(''); setGpReceivedFrom(''); setGpReceivedTo(''); setPidIssueFrom(''); setPidIssueTo(''); setPage(0); }}>
              <X className="w-3.5 h-3.5 mr-1" /> Clear Filters
            </Button>
          </div>
        )}
      </Card>

      {editMode && hasActiveFilters && filtered.length > 0 && (
        <BulkEditBar fields={masterBulkFields} filteredCount={filtered.length} onApply={handleBulkApply} isLoading={updateMutation.isPending} />
      )}

      {/* Personnel Status Tabs — All Personnel = Active on Site + Onboarding */}
      <div className="flex justify-center border-b overflow-x-auto">
        <div className="flex items-center">
          {[
            { key: 'all', label: 'All Personnel', count: filtered.length, icon: null, color: '' },
            { key: 'active_on_site', label: 'Active on Site', count: activeOnSiteList.length, icon: HardHat, color: 'text-emerald-600' },
            { key: 'onboarding', label: 'Onboarding', count: onboardingList.length, icon: UserPlus, color: 'text-indigo-600' },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setPage(0); }}
                className={`flex items-center gap-2 px-6 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                }`}
              >
                {Icon && <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : tab.color}`} />}
                {tab.label}
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>{tab.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="table-scroll-x">
          <div className="table-scroll-y h-[560px]">
          <Table className="table-list-view">
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap w-10">Photo</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap w-8">Docs</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Name</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Position (Application)</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Designation (Org Chart)</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Department</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Company</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Company Type</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Nationality</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Religion</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Location</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Camp Check-in</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Camp Check-out</TableHead>
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
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Gate Pass Submitted</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Gate Pass Received</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Gate Pass Expiry</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Staff No / RLIC</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">RLIC Status</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PID No</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PID Issue</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PID Expiry</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PID Projected</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PID Status</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Training Date Scheduled</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Training Date Started</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Training Date End</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Training Status</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Remarks</TableHead>
                <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Assigned Manager</TableHead>
                <TableHead className="text-xs text-right bg-muted/50 whitespace-nowrap sticky right-0 z-20 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(8).fill(0).map((_, i) => (
                  <TableRow key={i}>{Array(50).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : tabData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={50} className="text-center py-12 text-muted-foreground">No records found</TableCell>
                </TableRow>
              ) : (
                pagedRows.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-muted/30">
                    <TableCell className="p-2"><PersonnelAvatar name={emp.name} photoUrl={emp.photo_url} size={8} /></TableCell>
                    <TableCell className="p-1"><SharepointDocIcon emp={emp} canEdit={canEdit} onSave={(id, url) => updateMutation.mutate({ id, data: { sharepoint_url: url } })} /></TableCell>
                    <TableCell className="text-xs font-medium whitespace-nowrap uppercase"><InlineEditCell value={emp.name} field="name" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap uppercase"><InlineEditCell value={emp.position_application} field="position_application" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap uppercase"><InlineEditCell value={emp.designation_org_chart} field="designation_org_chart" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap uppercase"><InlineEditCell value={emp.department} field="department" empId={emp.id} type="select" options={departmentOptions} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap uppercase">{emp.company}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap uppercase">{emp.company_type || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap uppercase"><InlineEditCell value={emp.nationality} field="nationality" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap uppercase"><InlineEditCell value={emp.religion} field="religion" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.current_location} field="current_location" empId={emp.id} type="select" options={locationOptions} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    {(() => { const att = latestAttByPersonnel.get(emp.id); const ci = att?.check_in_at ? formatDateTimeCompact(att.check_in_at) : null; return <TableCell className="text-xs whitespace-nowrap">{ci ? <><div>{ci.date}</div><div className="text-muted-foreground">{ci.time}</div></> : <span className="text-muted-foreground">—</span>}</TableCell>; })()}
                    {(() => { const att = latestAttByPersonnel.get(emp.id); const co = att?.check_out_at ? formatDateTimeCompact(att.check_out_at) : null; return <TableCell className="text-xs whitespace-nowrap">{co ? <><div>{co.date}</div><div className="text-muted-foreground">{co.time}</div></> : <span className="text-muted-foreground">—</span>}</TableCell>; })()}
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.dir_indir} field="dir_indir" empId={emp.id} type="select" options={[{value:'DIR',label:'DIR'},{value:'INDIR',label:'INDIR'}]} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap uppercase"><InlineEditCell value={emp.contact_details} field="contact_details" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap uppercase"><InlineEditCell value={emp.sponsor} field="sponsor" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap uppercase"><InlineEditCell value={emp.qid_no} field="qid_no" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.qid_expiry} field="qid_expiry" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} className="font-mono" /></TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap uppercase"><InlineEditCell value={emp.pp_no} field="pp_no" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
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
                      <InlineEditCell value={emp.ftw_result} field="ftw_result" empId={emp.id} type="select" options={medicalResultOptions} onSave={handleCellSave} editMode={editMode} />
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap uppercase"><InlineEditCell value={emp.ftw_doctor} field="ftw_doctor" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.ftw_reassess_date} field="ftw_reassess_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap uppercase"><InlineEditCell value={emp.ftw_remarks} field="ftw_remarks" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.gate_pass_issue_date} field="gate_pass_issue_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.gate_pass_received_date} field="gate_pass_received_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.gate_pass_expiry} field="gate_pass_expiry" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap uppercase"><InlineEditCell value={emp.staff_no} field="staff_no" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="whitespace-nowrap"><StatusBadge dateStr={emp.gate_pass_expiry} type="rlic" storedStatus={emp.rlic_status} short /></TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap uppercase"><InlineEditCell value={emp.pid} field="pid" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.pid_issue_date} field="pid_issue_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.pid_expiry} field="pid_expiry" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.pid_projected_date} field="pid_projected_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="whitespace-nowrap"><StatusBadge dateStr={emp.pid_expiry} type="pid" storedStatus={emp.pid_status} short /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.training_date_scheduled} field="training_date_scheduled" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.training_date_start} field="training_date_start" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap"><InlineEditCell value={emp.training_date_end} field="training_date_end" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      <InlineEditCell value={emp.training_status} field="training_status" empId={emp.id} type="select" options={trainingStatusOptions} onSave={handleCellSave} editMode={editMode} />
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap uppercase"><InlineEditCell value={emp.remarks} field="remarks" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {emp.assigned_manager_name ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-semibold">
                          {emp.assigned_manager_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="sticky right-0 bg-white z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">
                      <TooltipProvider delayDuration={200}>
                      <div className="flex justify-end gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link to={`/employees/${emp.id}`}>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3.5 h-3.5" /></Button>
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="top">View Personnel</TooltipContent>
                        </Tooltip>
                        {canEdit && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link to={`/employees/${emp.id}/edit`}>
                                <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="top">Edit Personnel</TooltipContent>
                          </Tooltip>
                        )}
                        {canEdit && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-600 hover:text-indigo-700" onClick={() => openStatusModal(emp, ONBOARDING)}><UserPlus className="w-3.5 h-3.5" /></Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Set Onboarding</TooltipContent>
                          </Tooltip>
                        )}
                        {canEdit && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700" onClick={() => openStatusModal(emp, INACTIVE)}><UserX className="w-3.5 h-3.5" /></Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Set Inactive</TooltipContent>
                          </Tooltip>
                        )}
                        {canEdit && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-600 hover:text-orange-700" onClick={() => openStatusModal(emp, DEMOBILIZED)}><LogOut className="w-3.5 h-3.5" /></Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Demobilize</TooltipContent>
                          </Tooltip>
                        )}
                        {canDelete && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Record</AlertDialogTitle>
                                    <AlertDialogDescription>This will move {emp.name} to Deleted Personnel. You can restore the record later.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteMutation.mutate(emp)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TooltipTrigger>
                            <TooltipContent side="top">Delete Record</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </div>
        <div className="px-4 py-2 border-t bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground">
            Showing <strong>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, tabData.length)}</strong> of <strong>{tabData.length}</strong> filtered · <strong>{employees.length}</strong> total active
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(0)} disabled={page === 0}>«</Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>‹ Prev</Button>
              <span className="text-xs px-2">Page {page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next ›</Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>»</Button>
            </div>
          )}
        </div>
      </Card>

      <StatusChangeModal
        open={statusModal.open}
        emp={statusModal.emp}
        newStatus={statusModal.newStatus}
        onClose={() => setStatusModal(s => ({ ...s, open: false }))}
        onConfirm={(data) => { statusChangeMutation.mutate(data); }}
      />
    </div>
  );
}