import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { useManagerFilter } from '@/hooks/useManagerFilter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Eye, Pencil, X, MapPin, UserX, LogOut, Trash2 } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import StatusChangeModal from '../components/common/StatusChangeModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import PersonnelAvatar from '../components/common/PersonnelAvatar';
import SharepointDocIcon from '../components/common/SharepointDocIcon';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '../components/common/StatusBadge';
import ExportButton from '../components/common/ExportButton';
import PrintReportButton from '../components/common/PrintReportButton';
import MultiSelect from '../components/common/MultiSelect';
import PidDaysLeftBadge from '../components/comocamp/PidDaysLeftBadge';
import ComoCampSummaryCards from '../components/comocamp/ComoCampSummaryCards';
import { useToast } from '@/components/ui/use-toast';
import { computePassStatus, formatDate } from '@/utils/constants';
import { useLookupOptions } from '@/hooks/useLookupOptions';
import { usePermissions } from '@/lib/usePermissions';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { buildRankMap, applyReportSorting } from '../components/dashboard/reportSorting';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'comocamp_filters';
const SCROLL_KEY = 'comocamp_scroll';
const PAGE_SIZE = 50;

// Normalized inclusion rule — COMO CAMP lives in `current_location` in the Master List.
// Matching is case-insensitive and trims extra spaces ("COMO CAMP", "Como Camp", " COMO CAMP ").
const isComoCamp = (e) => (e.current_location || '').trim().toUpperCase() === 'COMO CAMP';

// ── Inline status pills (Medical / Training) ────────────────────────────────
const MED_PILLS = {
  'ACCEPTED': { label: 'Accepted', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'WAITING TR APPROVAL': { label: 'Waiting TR', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  'RE-ASSESS': { label: 'Re-Assess', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  'REJECTED': { label: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-200' },
  'RECALLED': { label: 'Recalled', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
};
const TRAIN_PILLS = {
  'DONE': { label: 'Done', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'ON-GOING': { label: 'On-Going', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  'SCHEDULED': { label: 'Scheduled', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  'TO BE SCHEDULED': { label: 'To Be Scheduled', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  'PENDING': { label: 'Pending', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  'ABSENT': { label: 'Absent', cls: 'bg-red-50 text-red-700 border-red-200' },
  'NOT REQUIRED': { label: 'Not Required', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  'RECALLED': { label: 'Recalled', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
};
function Pill({ value, map, fallback = 'New', emptyCls = 'bg-slate-100 text-slate-600 border-slate-200' }) {
  const v = (value || '').toUpperCase();
  if (!v) return <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-semibold whitespace-nowrap', emptyCls)}>{fallback}</span>;
  const p = map[v] || { label: value, cls: 'bg-blue-50 text-blue-700 border-blue-200' };
  return <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-semibold whitespace-nowrap', p.cls)}>{p.label}</span>;
}

function loadFilters() {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
    return {
      activeTab: s.activeTab === 'como' ? 'como' : 'all',
      search: s.search || '',
      companyFilter: Array.isArray(s.companyFilter) ? s.companyFilter : [],
      departmentFilter: Array.isArray(s.departmentFilter) ? s.departmentFilter : [],
      positionFilter: Array.isArray(s.positionFilter) ? s.positionFilter : [],
      pidStatusFilter: Array.isArray(s.pidStatusFilter) ? s.pidStatusFilter : [],
      gpStatusFilter: Array.isArray(s.gpStatusFilter) ? s.gpStatusFilter : [],
      medicalFilter: Array.isArray(s.medicalFilter) ? s.medicalFilter : [],
      trainingFilter: Array.isArray(s.trainingFilter) ? s.trainingFilter : [],
      workLocationFilter: Array.isArray(s.workLocationFilter) ? s.workLocationFilter : [],
      pidExpiryFrom: s.pidExpiryFrom || '',
      pidExpiryTo: s.pidExpiryTo || '',
      page: typeof s.page === 'number' ? s.page : 0,
    };
  } catch { return { activeTab: 'all' }; }
}
function saveFilters(f) { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch {} }

export default function ComoCamp() {
  const { canEdit, canDelete } = usePermissions();
  const currentUser = useCurrentUser();
  const { selectedManagerIds, setSelectedManagerIds, managers } = useManagerFilter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const saved = useMemo(() => loadFilters(), []);
  const [activeTab, setActiveTab] = useState(saved.activeTab || 'all');
  const [searchInput, setSearchInput] = useState(saved.search || '');
  const [search, setSearch] = useState(saved.search || '');
  const [page, setPage] = useState(saved.page || 0);
  const [companyFilter, setCompanyFilter] = useState(saved.companyFilter || []);
  const [departmentFilter, setDepartmentFilter] = useState(saved.departmentFilter || []);
  const [positionFilter, setPositionFilter] = useState(saved.positionFilter || []);
  const [pidStatusFilter, setPidStatusFilter] = useState(saved.pidStatusFilter || []);
  const [gpStatusFilter, setGpStatusFilter] = useState(saved.gpStatusFilter || []);
  const [medicalFilter, setMedicalFilter] = useState(saved.medicalFilter || []);
  const [trainingFilter, setTrainingFilter] = useState(saved.trainingFilter || []);
  const [workLocationFilter, setWorkLocationFilter] = useState(saved.workLocationFilter || []);
  const [pidExpiryFrom, setPidExpiryFrom] = useState(saved.pidExpiryFrom || '');
  const [pidExpiryTo, setPidExpiryTo] = useState(saved.pidExpiryTo || '');

  const {
    companyOptions, departmentOptions, pidStatusOptions,
    rlicStatusOptions, medicalResultOptions, trainingStatusOptions,
  } = useLookupOptions();
  const allGpStatusOptions = rlicStatusOptions;
  const allMedicalOptions = useMemo(() => [{ value: 'NEW', label: 'NEW' }, ...medicalResultOptions], [medicalResultOptions]);

  // Debounce search
  const searchDebounceRef = useRef(null);
  const handleSearchChange = useCallback((val) => {
    setSearchInput(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => { setSearch(val); setPage(0); }, 300);
  }, []);

  // Single shared query with Master List — real-time sync via invalidation.
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, '-created_date', 100000),
  });

  // Position hierarchy ranks (Admin Panel → Positions / Designations)
  const { data: positionRanks = [] } = useQuery({
    queryKey: ['position-ranks'],
    queryFn: () => base44.entities.PositionRank.list(undefined, 100000),
  });
  const rankMap = useMemo(() => buildRankMap(positionRanks), [positionRanks]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, { ...data, _last_updated_by: currentUser?.email || '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees-active'] }),
    onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
  });

  // ── Set Inactive / Demobilize — same modal & mutation as Master List.
  const [statusModal, setStatusModal] = useState({ open: false, emp: null, newStatus: 'Inactive' });
  const openStatusModal = (emp, newStatus) => setStatusModal({ open: true, emp, newStatus });

  const statusChangeMutation = useMutation({
    mutationFn: async ({ emp, newStatus, effectiveDate, lastWorkingDate, reason }) => {
      const updates = {
        personnel_status: newStatus,
        is_active: false,
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
      if (newStatus === 'Inactive') updates.inactive_date = effectiveDate;
      if (newStatus === 'Demobilized') updates.demobilization_date = effectiveDate;
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

  // ── Delete — same soft-delete flow as Master List.
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

  // COMO Camp dataset (Work Location = COMO CAMP, normalized)
  const comoEmployees = useMemo(() => employees.filter(isComoCamp), [employees]);

  // Base dataset per tab — All Locations uses all active personnel; COMO Camp is locked to COMO CAMP.
  const baseDataset = activeTab === 'como' ? comoEmployees : employees;

  // Distinct Work Location values across ALL active personnel (dynamic, free-text field).
  const workLocationOptions = useMemo(() => {
    const vals = [...new Set(employees.map(e => (e.current_location || '').trim()).filter(Boolean))].sort((a, b) =>
      a.toUpperCase().localeCompare(b.toUpperCase()));
    return vals.map(v => ({ value: v, label: v }));
  }, [employees]);

  const uniqueCompanies = useMemo(() => {
    const vals = [...new Set(baseDataset.map(e => e.company).filter(Boolean))].sort();
    return vals.map(v => ({ value: v, label: v }));
  }, [baseDataset]);

  const positions = useMemo(() => {
    const pos = [...new Set(baseDataset.map(e => e.designation_org_chart).filter(Boolean))].sort();
    return pos.map(p => ({ value: p, label: p }));
  }, [baseDataset]);

  const departments = useMemo(() => {
    const vals = [...new Set(baseDataset.map(e => e.department).filter(Boolean))].sort();
    return vals.map(v => ({ value: v, label: v }));
  }, [baseDataset]);

  const filtered = useMemo(() => {
    return baseDataset.filter((emp) => {
      const s = search.toLowerCase();
      const matchesSearch = !s ||
        emp.name?.toLowerCase().includes(s) ||
        emp.qid_no?.toLowerCase().includes(s) ||
        emp.pid?.toLowerCase().includes(s) ||
        emp.company?.toLowerCase().includes(s) ||
        emp.designation_org_chart?.toLowerCase().includes(s) ||
        emp.position_application?.toLowerCase().includes(s) ||
        emp.contact_details?.toLowerCase().includes(s);

      const matchesCompany = companyFilter.length === 0 || companyFilter.includes(emp.company);
      const matchesDepartment = departmentFilter.length === 0 || departmentFilter.includes(emp.department);
      const matchesPosition = positionFilter.length === 0 || positionFilter.includes(emp.designation_org_chart);
      const matchesManager = selectedManagerIds.length === 0 || selectedManagerIds.some(mid =>
        emp.assigned_manager_id ? emp.assigned_manager_id === mid : emp.assigned_manager_name === managers.find(m => m.id === mid)?.label
      );
      // Work Location filter only applies on the All Locations tab (COMO Camp tab is locked to COMO CAMP).
      const matchesWorkLocation = activeTab !== 'all' || workLocationFilter.length === 0 ||
        workLocationFilter.includes(emp.current_location);
      const gpStatus = computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status);
      const matchesGp = gpStatusFilter.length === 0 || gpStatusFilter.includes(gpStatus);
      const pidStatus = computePassStatus(emp.pid_expiry, 'pid', emp.pid_status);
      const matchesPid = pidStatusFilter.length === 0 || pidStatusFilter.includes(pidStatus);
      const matchesMedical = medicalFilter.length === 0 || medicalFilter.includes(emp.ftw_result) || (medicalFilter.includes('NEW') && !emp.ftw_result);
      const matchesTraining = trainingFilter.length === 0 || trainingFilter.includes(emp.training_status);
      const empPidExp = emp.pid_expiry ? emp.pid_expiry.substring(0, 10) : '';
      const matchesPidFrom = !pidExpiryFrom || (empPidExp && empPidExp >= pidExpiryFrom);
      const matchesPidTo = !pidExpiryTo || (empPidExp && empPidExp <= pidExpiryTo);

      return matchesSearch && matchesCompany && matchesDepartment && matchesPosition && matchesManager && matchesWorkLocation && matchesGp && matchesPid && matchesMedical && matchesTraining && matchesPidFrom && matchesPidTo;
    });
  }, [baseDataset, activeTab, search, companyFilter, departmentFilter, positionFilter, selectedManagerIds, managers, workLocationFilter, gpStatusFilter, pidStatusFilter, medicalFilter, trainingFilter, pidExpiryFrom, pidExpiryTo]);

  // Default sort:
  //  - All Locations: Work Location ASC (blank last) → Company ASC → Position Rank ASC → Full Name ASC
  //  - COMO Camp:     Company ASC → Position Rank ASC → Full Name ASC
  const sorted = useMemo(() => {
    const companySorted = applyReportSorting(filtered, { mode: 'company', direction: 'asc' }, rankMap);
    if (activeTab !== 'all') return companySorted;
    // Stable re-sort by Work Location keeps the company/rank/name order within each location.
    return [...companySorted].sort((a, b) => {
      const la = (a.current_location || '').trim().toUpperCase();
      const lb = (b.current_location || '').trim().toUpperCase();
      if (!la && !lb) return 0;
      if (!la) return 1;   // blank Work Location last
      if (!lb) return -1;
      return la.localeCompare(lb);
    });
  }, [filtered, rankMap, activeTab]);

  useEffect(() => {
    saveFilters({ activeTab, search, companyFilter, departmentFilter, positionFilter, pidStatusFilter, gpStatusFilter, medicalFilter, trainingFilter, workLocationFilter, pidExpiryFrom, pidExpiryTo, page });
  }, [activeTab, search, companyFilter, departmentFilter, positionFilter, pidStatusFilter, gpStatusFilter, medicalFilter, trainingFilter, workLocationFilter, pidExpiryFrom, pidExpiryTo, page]);

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    setPage(0);
  }, [companyFilter, departmentFilter, positionFilter, pidStatusFilter, gpStatusFilter, medicalFilter, trainingFilter, workLocationFilter, pidExpiryFrom, pidExpiryTo]);

  // Reset to page 0 when switching tabs (record counts differ between tabs).
  const switchTab = useCallback((tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setPage(0);
  }, [activeTab]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  useEffect(() => {
    if (totalPages > 0 && page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [totalPages, page]);
  const pagedRows = useMemo(() => sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [sorted, page]);

  // Preserve scroll position across View / Edit navigation
  const scrollRef = useRef(null);
  const scrollTopRef = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => { scrollTopRef.current = el.scrollTop; };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);
  const saveScroll = useCallback(() => {
    try { sessionStorage.setItem(SCROLL_KEY, String(scrollTopRef.current)); } catch {}
  }, []);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const savedScroll = Number(sessionStorage.getItem(SCROLL_KEY)) || 0;
    if (savedScroll) requestAnimationFrame(() => { el.scrollTop = savedScroll; });
  }, []);

  const hasActiveFilters = selectedManagerIds.length > 0 || searchInput || companyFilter.length > 0 || departmentFilter.length > 0 || positionFilter.length > 0 || pidStatusFilter.length > 0 || gpStatusFilter.length > 0 || medicalFilter.length > 0 || trainingFilter.length > 0 || (activeTab === 'all' && workLocationFilter.length > 0) || pidExpiryFrom || pidExpiryTo;

  const clearFilters = () => {
    setSelectedManagerIds([]); setSearchInput(''); setSearch(''); setCompanyFilter([]); setDepartmentFilter([]); setPositionFilter([]); setPidStatusFilter([]); setGpStatusFilter([]); setMedicalFilter([]); setTrainingFilter([]); setWorkLocationFilter([]); setPidExpiryFrom(''); setPidExpiryTo(''); setPage(0);
  };

  const getExportData = () => sorted.map(e => {
    const pidStatus = computePassStatus(e.pid_expiry, 'pid', e.pid_status);
    const gpStatus = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
    let daysLeft = '—';
    if (e.pid_expiry) {
      const d = new Date(e.pid_expiry.substring(0, 10)); d.setHours(0,0,0,0);
      const t = new Date(); t.setHours(0,0,0,0);
      const diff = Math.ceil((d - t) / 86400000);
      daysLeft = diff < 0 ? `Expired ${Math.abs(diff)}d` : `${diff}d`;
    }
    return {
      Name: e.name || '—',
      Company: e.company || '—',
      'QID No': e.qid_no || '—',
      'PID No': e.pid || '—',
      Medical: e.ftw_result || 'New',
      'Gate Pass': gpStatus,
      Training: e.training_status || '—',
      'PID Status': pidStatus,
      'PID Expiry': formatDate(e.pid_expiry),
      'PID Days Left': daysLeft,
      'Work Location': e.current_location || '—',
      Contact: e.contact_details || '—',
      Department: e.department || '—',
      'Designation / Position': e.designation_org_chart || e.position_application || '—',
      'Assigned Manager': e.assigned_manager_name || 'Unassigned',
    };
  });

  const printRecords = useMemo(() => sorted.map(e => {
    const pidStatus = computePassStatus(e.pid_expiry, 'pid', e.pid_status);
    const gpStatus = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
    let daysLeft = '—';
    if (e.pid_expiry) {
      const d = new Date(e.pid_expiry.substring(0, 10)); d.setHours(0,0,0,0);
      const t = new Date(); t.setHours(0,0,0,0);
      const diff = Math.ceil((d - t) / 86400000);
      daysLeft = diff < 0 ? `Expired ${Math.abs(diff)}d` : `${diff}d`;
    }
    return {
      Name: e.name || '—',
      Company: e.company || '—',
      'QID No': e.qid_no || '—',
      'PID No': e.pid || '—',
      Medical: e.ftw_result || 'New',
      'Gate Pass': gpStatus,
      Training: e.training_status || '—',
      'PID Status': pidStatus,
      'PID Expiry': formatDate(e.pid_expiry),
      'PID Days Left': daysLeft,
      'Work Location': e.current_location || '—',
      Contact: e.contact_details || '—',
    };
  }), [sorted]);

  const printColumns = [
    { key: 'Name', label: 'Name' },
    { key: 'Company', label: 'Company' },
    { key: 'QID No', label: 'QID No.' },
    { key: 'PID No', label: 'PID No.' },
    { key: 'Medical', label: 'Medical' },
    { key: 'Gate Pass', label: 'Gate Pass' },
    { key: 'Training', label: 'Training' },
    { key: 'PID Status', label: 'PID Status' },
    { key: 'PID Expiry', label: 'PID Expiry' },
    { key: 'PID Days Left', label: 'PID Days Left' },
    { key: 'Work Location', label: 'Work Location' },
    { key: 'Contact', label: 'Contact' },
  ];

  const appliedFilters = useMemo(() => {
    const chips = activeTab === 'como' ? ['Work Location: COMO CAMP'] : [];
    if (activeTab === 'all' && workLocationFilter.length) chips.push(`Work Location: ${workLocationFilter.join(', ')}`);
    if (companyFilter.length) chips.push(`Company: ${companyFilter.join(', ')}`);
    if (departmentFilter.length) chips.push(`Department: ${departmentFilter.join(', ')}`);
    if (positionFilter.length) chips.push(`Position: ${positionFilter.join(', ')}`);
    if (selectedManagerIds.length) chips.push(`Manager: ${selectedManagerIds.length} selected`);
    if (medicalFilter.length) chips.push(`Medical: ${medicalFilter.join(', ')}`);
    if (gpStatusFilter.length) chips.push(`Gate Pass: ${gpStatusFilter.join(', ')}`);
    if (trainingFilter.length) chips.push(`Training: ${trainingFilter.join(', ')}`);
    if (pidStatusFilter.length) chips.push(`PID Status: ${pidStatusFilter.join(', ')}`);
    if (pidExpiryFrom || pidExpiryTo) chips.push(`PID Expiry: ${pidExpiryFrom || '…'} → ${pidExpiryTo || '…'}`);
    if (search) chips.push(`Search: "${search}"`);
    return chips;
  }, [activeTab, workLocationFilter, companyFilter, departmentFilter, positionFilter, selectedManagerIds, medicalFilter, gpStatusFilter, trainingFilter, pidStatusFilter, pidExpiryFrom, pidExpiryTo, search]);

  const isComo = activeTab === 'como';
  const reportTitle = isComo ? 'GSO QATAR — COMO CAMP PERSONNEL REPORT' : 'GSO QATAR — PERSONNEL BY WORK LOCATION REPORT';
  const exportFilename = isComo ? 'como_camp_personnel.csv' : 'personnel_by_work_location.csv';
  const firstCardLabel = isComo ? 'Total COMO Camp' : 'Total Personnel';
  const subtitle = isComo
    ? `${sorted.length} COMO Camp personnel · ${employees.length} total active`
    : `${sorted.length} filtered · ${employees.length} total active`;
  const footerTotalLabel = isComo ? `${comoEmployees.length} total COMO Camp` : `${employees.length} total active`;
  const emptyMessage = isComo ? 'No COMO Camp personnel found' : 'No personnel found for the current filters';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            COMO Camp
            {isComo && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                <MapPin className="w-3 h-3" /> Work Location: COMO CAMP
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportButton getData={getExportData} filename={exportFilename} />
          <PrintReportButton
            records={printRecords}
            columns={printColumns}
            title={reportTitle}
            appliedFilters={appliedFilters}
            totalFiltered={sorted.length}
            sortBy={isComo ? ['Company'] : ['Work Location', 'Company']}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        <button
          onClick={() => switchTab('all')}
          className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            !isComo ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}
        >
          All Locations <span className="ml-1 text-xs font-semibold">({employees.length})</span>
        </button>
        <button
          onClick={() => switchTab('como')}
          className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            isComo ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}
        >
          COMO Camp <span className="ml-1 text-xs font-semibold">({comoEmployees.length})</span>
        </button>
      </div>

      {/* Summary cards */}
      <ComoCampSummaryCards data={sorted} firstCardLabel={firstCardLabel} />

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-3">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search Name, QID, PID, Company, Position, Contact..." value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} className="pl-9" />
          </div>
          <MultiSelect options={uniqueCompanies} value={companyFilter} onChange={setCompanyFilter} placeholder="All Companies" className="dropdown-company" />
          <MultiSelect options={positions} value={positionFilter} onChange={setPositionFilter} placeholder="Filter by position" className="dropdown-position" />
          <MultiSelect options={departments} value={departmentFilter} onChange={setDepartmentFilter} placeholder="Filter by department" className="dropdown-department" />
          <MultiSelect options={pidStatusOptions} value={pidStatusFilter} onChange={setPidStatusFilter} placeholder="PID Status" className="dropdown-status" />
          <MultiSelect options={allGpStatusOptions} value={gpStatusFilter} onChange={setGpStatusFilter} placeholder="Gate Pass Status" className="dropdown-status" />
          <MultiSelect options={allMedicalOptions} value={medicalFilter} onChange={setMedicalFilter} placeholder="Medical Status" className="dropdown-status" />
          <MultiSelect options={trainingStatusOptions} value={trainingFilter} onChange={setTrainingFilter} placeholder="Training Status" className="dropdown-training" />
          <MultiSelect
            options={managers.map(m => ({ value: m.id, label: m.label }))}
            value={selectedManagerIds}
            onChange={setSelectedManagerIds}
            placeholder="All Managers"
            className="dropdown-manager"
          />
          {activeTab === 'all' && (
            <MultiSelect options={workLocationOptions} value={workLocationFilter} onChange={setWorkLocationFilter} placeholder="All Work Locations" className="dropdown-location" />
          )}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground mb-1">PID Expiry</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1">
              <Input type="date" value={pidExpiryFrom} onChange={e => setPidExpiryFrom(e.target.value)} className="text-xs h-8 flex-1" title="From" placeholder="From" />
              <span className="hidden sm:block text-muted-foreground text-xs">–</span>
              <Input type="date" value={pidExpiryTo} onChange={e => setPidExpiryTo(e.target.value)} className="text-xs h-8 flex-1" title="To" placeholder="To" />
            </div>
          </div>
        </div>
        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="w-3.5 h-3.5 mr-1" /> Clear Filters
            </Button>
          </div>
        )}
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="table-scroll-x">
          <div className="table-scroll-y h-[560px]" ref={scrollRef}>
            <Table className="table-list-view">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap w-10">Photo</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap w-8">Docs</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Name</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Company</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">QID No.</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PID No.</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Medical</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Gate Pass</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Training</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PID Status</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PID Expiry</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PID Days Left</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Location</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Contact</TableHead>
                  <TableHead className="text-xs text-right bg-muted/50 whitespace-nowrap sticky right-0 z-20 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(8).fill(0).map((_, i) => (
                    <TableRow key={i}>{Array(15).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                  ))
                ) : sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-12 text-muted-foreground">{emptyMessage}</TableCell>
                  </TableRow>
                ) : (
                  pagedRows.map((emp) => (
                    <TableRow key={emp.id} className="hover:bg-muted/30">
                      <TableCell className="p-2"><PersonnelAvatar name={emp.name} photoUrl={emp.photo_url} size={8} /></TableCell>
                      <TableCell className="p-1"><SharepointDocIcon emp={emp} canEdit={canEdit} onSave={(id, url) => updateMutation.mutate({ id, data: { sharepoint_url: url } })} /></TableCell>
                      <TableCell className="text-xs font-medium whitespace-nowrap uppercase">{emp.name || '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap uppercase">{emp.company || '—'}</TableCell>
                      <TableCell className="text-xs font-mono whitespace-nowrap uppercase">{emp.qid_no || '—'}</TableCell>
                      <TableCell className="text-xs font-mono whitespace-nowrap uppercase">{emp.pid || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap"><Pill value={emp.ftw_result} map={MED_PILLS} /></TableCell>
                      <TableCell className="whitespace-nowrap"><StatusBadge dateStr={emp.gate_pass_expiry} type="rlic" storedStatus={emp.rlic_status} short /></TableCell>
                      <TableCell className="whitespace-nowrap"><Pill value={emp.training_status} map={TRAIN_PILLS} fallback="—" /></TableCell>
                      <TableCell className="whitespace-nowrap"><StatusBadge dateStr={emp.pid_expiry} type="pid" storedStatus={emp.pid_status} short /></TableCell>
                      <TableCell className="text-xs whitespace-nowrap font-mono">{formatDate(emp.pid_expiry)}</TableCell>
                      <TableCell className="whitespace-nowrap"><PidDaysLeftBadge dateStr={emp.pid_expiry} /></TableCell>
                      <TableCell className="text-xs whitespace-nowrap uppercase">{emp.current_location || '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap uppercase">{emp.contact_details || '—'}</TableCell>
                      <TableCell className="sticky right-0 bg-white z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">
                        <TooltipProvider delayDuration={200}>
                          <div className="flex justify-end gap-0.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link to={`/employees/${emp.id}`} onClick={saveScroll}>
                                  <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3.5 h-3.5" /></Button>
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent side="top">View Personnel</TooltipContent>
                            </Tooltip>
                            {canEdit && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Link to={`/employees/${emp.id}/edit`} onClick={saveScroll}>
                                    <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button>
                                  </Link>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Edit Personnel</TooltipContent>
                              </Tooltip>
                            )}
                            {canEdit && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700" onClick={() => openStatusModal(emp, 'Inactive')}><UserX className="w-3.5 h-3.5" /></Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Set Inactive</TooltipContent>
                              </Tooltip>
                            )}
                            {canEdit && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-600 hover:text-orange-700" onClick={() => openStatusModal(emp, 'Demobilized')}><LogOut className="w-3.5 h-3.5" /></Button>
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
            Showing <strong>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)}</strong> of <strong>{sorted.length}</strong> filtered · <strong>{footerTotalLabel}</strong>
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