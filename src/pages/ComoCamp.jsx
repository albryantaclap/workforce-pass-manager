import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { useManagerFilter } from '@/hooks/useManagerFilter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Eye, Pencil, X, MapPin, UserX, LogOut, Trash2, Save, Check, LayoutDashboard, List, FileSpreadsheet, Printer } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import StatusChangeModal from '../components/common/StatusChangeModal';
import FilterToolbar from '@/components/common/FilterToolbar';
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
import PidDaysLeftBadge from '../components/comocamp/PidDaysLeftBadge';
import ComoCampDashboard from '../components/comocamp/dashboard/ComoCampDashboard';
import { exportDashboardExcel, printDashboardPdf } from '../components/comocamp/dashboard/exportComoCampDashboard';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import LocationGridDropdown from '../components/comocamp/LocationGridDropdown';
import { computePassStatus, formatDate, normalizeDate } from '@/utils/constants';
import { useLookupOptions } from '@/hooks/useLookupOptions';
import { usePermissions } from '@/lib/usePermissions';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { buildRankMap, applyReportSorting } from '../components/dashboard/reportSorting';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'comocamp_filters';
const SCROLL_KEY = 'comocamp_scroll';
const PAGE_SIZE = 50;

// Normalized inclusion rule — COMO CAMP lives in `current_location` in the Master List.
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
    const arr = (v) => Array.isArray(v) ? v : [];
    return {
      activeTab: s.activeTab === 'como' ? 'como' : 'all',
      search: s.search || '',
      companyFilter: arr(s.companyFilter),
      departmentFilter: arr(s.departmentFilter),
      positionFilter: arr(s.positionFilter),
      rlicStatusFilter: arr(s.rlicStatusFilter),
      trainingStatusFilter: arr(s.trainingStatusFilter),
      pidStatusFilter: arr(s.pidStatusFilter),
      medicalResultFilter: arr(s.medicalResultFilter),
      locationFilter: arr(s.locationFilter),
      dirIndirFilter: s.dirIndirFilter || '',
      trainingScheduledFrom: s.trainingScheduledFrom || '',
      trainingScheduledTo: s.trainingScheduledTo || '',
      trApprovedFrom: s.trApprovedFrom || '',
      trApprovedTo: s.trApprovedTo || '',
      gpIssueFrom: s.gpIssueFrom || '',
      gpIssueTo: s.gpIssueTo || '',
      gpReceivedFrom: s.gpReceivedFrom || '',
      gpReceivedTo: s.gpReceivedTo || '',
      pidIssueFrom: s.pidIssueFrom || '',
      pidIssueTo: s.pidIssueTo || '',
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
  const [activeTab, setActiveTab] = useState('como');
  const [view, setView] = useState('dashboard');
  const [searchInput, setSearchInput] = useState(saved.search || '');
  const [search, setSearch] = useState(saved.search || '');
  const [page, setPage] = useState(saved.page || 0);
  const [companyFilter, setCompanyFilter] = useState(saved.companyFilter || []);
  const [departmentFilter, setDepartmentFilter] = useState(saved.departmentFilter || []);
  const [positionFilter, setPositionFilter] = useState(saved.positionFilter || []);
  const [rlicStatusFilter, setRlicStatusFilter] = useState(saved.rlicStatusFilter || []);
  const [trainingStatusFilter, setTrainingStatusFilter] = useState(saved.trainingStatusFilter || []);
  const [pidStatusFilter, setPidStatusFilter] = useState(saved.pidStatusFilter || []);
  const [medicalResultFilter, setMedicalResultFilter] = useState(saved.medicalResultFilter || []);
  const [locationFilter, setLocationFilter] = useState(saved.locationFilter || []);
  const [dirIndirFilter, setDirIndirFilter] = useState(saved.dirIndirFilter || '');
  const [trainingScheduledFrom, setTrainingScheduledFrom] = useState(saved.trainingScheduledFrom || '');
  const [trainingScheduledTo, setTrainingScheduledTo] = useState(saved.trainingScheduledTo || '');
  const [trApprovedFrom, setTrApprovedFrom] = useState(saved.trApprovedFrom || '');
  const [trApprovedTo, setTrApprovedTo] = useState(saved.trApprovedTo || '');
  const [gpIssueFrom, setGpIssueFrom] = useState(saved.gpIssueFrom || '');
  const [gpIssueTo, setGpIssueTo] = useState(saved.gpIssueTo || '');
  const [gpReceivedFrom, setGpReceivedFrom] = useState(saved.gpReceivedFrom || '');
  const [gpReceivedTo, setGpReceivedTo] = useState(saved.gpReceivedTo || '');
  const [pidIssueFrom, setPidIssueFrom] = useState(saved.pidIssueFrom || '');
  const [pidIssueTo, setPidIssueTo] = useState(saved.pidIssueTo || '');

  const {
    companyOptions: allCompanyOptions = [],
    departmentOptions: allDepartmentOptions = [],
    locationOptions: allLocationOptions = [],
    rlicStatusOptions: allRlicOptions = [],
    pidStatusOptions: allPidOptions = [],
    medicalResultOptions: allMedicalResultOptions = [],
    trainingStatusOptions: allTrainingOptions = [],
  } = useLookupOptions();

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

  const [statusModal, setStatusModal] = useState({ open: false, emp: null, newStatus: 'Inactive' });
  const openStatusModal = (emp, newStatus) => setStatusModal({ open: true, emp, newStatus });

  // ── Edit in Grid — inline edit Location (current_location) & Contact only ──
  const [editMode, setEditMode] = useState(false);
  const [drafts, setDrafts] = useState({});      // { [empId]: { current_location, contact_details } }
  const [originals, setOriginals] = useState({}); // snapshot at edit entry
  const [selectedIds, setSelectedIds] = useState(new Set()); // bulk-edit selection (current page)
  const [bulkLocDialog, setBulkLocDialog] = useState({ open: false, location: '' });

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

  // Edit-in-Grid save — single updates per changed row so the "Track Employee
  // Changes" entity automation logs each field-level change (no duplicate logs).
  const gridSaveMutation = useMutation({
    mutationFn: async ({ changes }) => {
      const results = [];
      for (const c of changes) {
        const payload = { ...c.fields };
        if (currentUser?.email) payload._last_updated_by = currentUser.email;
        if (currentUser?.full_name) payload._last_updated_by_name = currentUser.full_name;
        if (currentUser?.role) payload._last_updated_by_role = currentUser.role;
        payload._last_updated_at = new Date().toISOString();
        results.push(base44.entities.Employee.update(c.id, payload));
      }
      return Promise.all(results);
    },
    onSuccess: (_, { changes }) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees-active'] });
      queryClient.invalidateQueries({ queryKey: ['employees-inactive'] });
      queryClient.invalidateQueries({ queryKey: ['employee'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      queryClient.invalidateQueries({ queryKey: ['projection'] });
      setEditMode(false); setDrafts({}); setOriginals({}); setSelectedIds(new Set());
      toast({ title: `Saved ${changes.length} record(s)`, description: 'Changes synced across all modules.' });
    },
    onError: () => toast({ title: 'Save failed', variant: 'destructive' }),
  });

  // COMO Camp dataset (Work Location = COMO CAMP, normalized)
  const comoEmployees = useMemo(() => employees.filter(isComoCamp), [employees]);
  const baseDataset = activeTab === 'como' ? comoEmployees : employees;
  const isComo = activeTab === 'como';

  // Cascading company options: when department is selected, only show companies with employees in that dept
  const cascadedCompanyOptions = useMemo(() => {
    if (departmentFilter.length === 0) return allCompanyOptions;
    const deptSet = new Set(departmentFilter.map(d => d.trim().toLowerCase()));
    const validCompanies = new Set(
      baseDataset
        .filter(e => deptSet.has((e.department || '').trim().toLowerCase()))
        .map(e => (e.company || '').trim().toUpperCase())
    );
    return allCompanyOptions.filter(c => validCompanies.has(c.value.trim().toUpperCase()));
  }, [allCompanyOptions, departmentFilter, baseDataset]);

  useEffect(() => {
    if (companyFilter.length === 0) return;
    const validSet = new Set(cascadedCompanyOptions.map(c => c.value.trim().toUpperCase()));
    const still = companyFilter.filter(cf => validSet.has(cf.trim().toUpperCase()));
    if (still.length !== companyFilter.length) setCompanyFilter(still);
  }, [cascadedCompanyOptions]);

  // Positions from the base dataset, cascaded by company/department/rlic/pid
  const allPositions = useMemo(() => {
    const seen = new Map();
    for (const e of baseDataset) {
      const raw = (e.designation_org_chart || '').trim();
      if (!raw) continue;
      const key = raw.toUpperCase();
      if (!seen.has(key)) seen.set(key, raw);
    }
    return [...seen.values()].sort().map(p => ({ value: p, label: p }));
  }, [baseDataset]);

  const filteredPositions = useMemo(() => {
    const hasFilter = companyFilter.length > 0 || departmentFilter.length > 0 || rlicStatusFilter.length > 0 || pidStatusFilter.length > 0;
    if (!hasFilter) return allPositions;
    const coSet = companyFilter.length > 0 ? new Set(companyFilter.map(c => c.trim().toUpperCase())) : null;
    const deptSet = departmentFilter.length > 0 ? new Set(departmentFilter.map(d => d.trim().toLowerCase())) : null;
    const seen = new Set();
    return baseDataset
      .filter(e => {
        if (!e.designation_org_chart) return false;
        if (coSet && !coSet.has((e.company || '').trim().toUpperCase())) return false;
        if (deptSet && !deptSet.has((e.department || '').trim().toLowerCase())) return false;
        if (rlicStatusFilter.length > 0 && !rlicStatusFilter.includes(computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status))) return false;
        if (pidStatusFilter.length > 0 && !pidStatusFilter.includes(computePassStatus(e.pid_expiry, 'pid', e.pid_status))) return false;
        return true;
      })
      .map(e => e.designation_org_chart.trim())
      .filter(p => { if (seen.has(p)) return false; seen.add(p); return true; })
      .sort()
      .map(p => ({ value: p, label: p }));
  }, [baseDataset, allPositions, companyFilter, departmentFilter, rlicStatusFilter, pidStatusFilter]);

  useEffect(() => {
    if (positionFilter.length === 0) return;
    const valid = new Set(filteredPositions.map(p => p.value));
    const still = positionFilter.filter(p => valid.has(p));
    if (still.length !== positionFilter.length) setPositionFilter(still);
  }, [filteredPositions]);

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

      const empCompany = (emp.company || '').trim().toUpperCase();
      const matchesCompany = companyFilter.length === 0 || companyFilter.some(cf => cf.trim().toUpperCase() === empCompany);
      const matchesDepartment = departmentFilter.length === 0 || departmentFilter.includes(emp.department);
      const matchesPosition = positionFilter.length === 0 || positionFilter.includes(emp.designation_org_chart);
      const matchesManager = selectedManagerIds.length === 0 || selectedManagerIds.some(mid =>
        emp.assigned_manager_id ? emp.assigned_manager_id === mid : emp.assigned_manager_name === managers.find(m => m.id === mid)?.label
      );
      const matchesLocation = locationFilter.length === 0 || locationFilter.includes(emp.current_location);
      const matchesDirIndir = !dirIndirFilter || (emp.dir_indir || '').trim().toUpperCase() === dirIndirFilter.toUpperCase();
      const effectiveRlic = computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status);
      const matchesRlic = rlicStatusFilter.length === 0 || rlicStatusFilter.includes(effectiveRlic);
      const effectivePid = computePassStatus(emp.pid_expiry, 'pid', emp.pid_status);
      const matchesPid = pidStatusFilter.length === 0 || pidStatusFilter.includes(effectivePid);
      const matchesTraining = trainingStatusFilter.length === 0 || trainingStatusFilter.includes(emp.training_status);
      const matchesMedical = medicalResultFilter.length === 0 || medicalResultFilter.includes(emp.ftw_result);

      const trainSchedDate = normalizeDate(emp.training_date_scheduled) || '';
      const matchTrainSchedFrom = !trainingScheduledFrom || trainSchedDate >= trainingScheduledFrom;
      const matchTrainSchedTo = !trainingScheduledTo || trainSchedDate <= trainingScheduledTo;
      const trDate = normalizeDate(emp.ftw_approved_date) || '';
      const matchTrFrom = !trApprovedFrom || trDate >= trApprovedFrom;
      const matchTrTo = !trApprovedTo || trDate <= trApprovedTo;
      const gpIssueDateVal = normalizeDate(emp.gate_pass_issue_date) || '';
      const matchGpIssueFrom = !gpIssueFrom || gpIssueDateVal >= gpIssueFrom;
      const matchGpIssueTo = !gpIssueTo || gpIssueDateVal <= gpIssueTo;
      const gpReceivedVal = normalizeDate(emp.gate_pass_received_date) || '';
      const matchGpReceivedFrom = !gpReceivedFrom || gpReceivedVal >= gpReceivedFrom;
      const matchGpReceivedTo = !gpReceivedTo || gpReceivedVal <= gpReceivedTo;
      const pidDate = normalizeDate(emp.pid_issue_date) || '';
      const matchPidFrom = !pidIssueFrom || pidDate >= pidIssueFrom;
      const matchPidTo = !pidIssueTo || pidDate <= pidIssueTo;

      return matchesSearch && matchesCompany && matchesDepartment && matchesPosition && matchesManager &&
        matchesLocation && matchesDirIndir && matchesRlic && matchesPid && matchesTraining && matchesMedical &&
        matchTrainSchedFrom && matchTrainSchedTo && matchTrFrom && matchTrTo &&
        matchGpIssueFrom && matchGpIssueTo && matchGpReceivedFrom && matchGpReceivedTo && matchPidFrom && matchPidTo;
    });
  }, [baseDataset, search, companyFilter, departmentFilter, positionFilter, selectedManagerIds, managers,
    locationFilter, dirIndirFilter, rlicStatusFilter, pidStatusFilter, trainingStatusFilter, medicalResultFilter,
    trainingScheduledFrom, trainingScheduledTo, trApprovedFrom, trApprovedTo, gpIssueFrom, gpIssueTo,
    gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo]);

  // Default sort:
  //  - All Locations: Work Location ASC (blank last) → Company ASC → Position Rank ASC → Full Name ASC
  //  - COMO Camp:     Company ASC → Position Rank ASC → Full Name ASC
  const sorted = useMemo(() => {
    const companySorted = applyReportSorting(filtered, { mode: 'company', direction: 'asc' }, rankMap);
    if (!isComo) {
      return [...companySorted].sort((a, b) => {
        const la = (a.current_location || '').trim().toUpperCase();
        const lb = (b.current_location || '').trim().toUpperCase();
        if (!la && !lb) return 0;
        if (!la) return 1;
        if (!lb) return -1;
        return la.localeCompare(lb);
      });
    }
    return companySorted;
  }, [filtered, rankMap, isComo]);

  useEffect(() => {
    saveFilters({
      activeTab, search, companyFilter, departmentFilter, positionFilter, rlicStatusFilter,
      trainingStatusFilter, pidStatusFilter, medicalResultFilter, locationFilter, dirIndirFilter,
      trainingScheduledFrom, trainingScheduledTo, trApprovedFrom, trApprovedTo, gpIssueFrom, gpIssueTo,
      gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo, page,
    });
  }, [activeTab, search, companyFilter, departmentFilter, positionFilter, rlicStatusFilter,
    trainingStatusFilter, pidStatusFilter, medicalResultFilter, locationFilter, dirIndirFilter,
    trainingScheduledFrom, trainingScheduledTo, trApprovedFrom, trApprovedTo, gpIssueFrom, gpIssueTo,
    gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo, page]);

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    setPage(0);
  }, [companyFilter, departmentFilter, positionFilter, rlicStatusFilter, trainingStatusFilter,
    pidStatusFilter, medicalResultFilter, locationFilter, dirIndirFilter,
    trainingScheduledFrom, trainingScheduledTo, trApprovedFrom, trApprovedTo, gpIssueFrom, gpIssueTo,
    gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo]);

  const switchTab = useCallback((tab) => {
    if (editMode) return;
    if (tab === activeTab) return;
    setActiveTab(tab);
    setPage(0);
  }, [activeTab, editMode]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  useEffect(() => {
    if (totalPages > 0 && page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [totalPages, page]);
  const pagedRows = useMemo(() => sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [sorted, page]);

  // ── Edit in Grid helpers ──
  const enterEditMode = useCallback(() => {
    const snap = {}, orig = {};
    for (const e of pagedRows) {
      snap[e.id] = { current_location: e.current_location || '', contact_details: e.contact_details || '' };
      orig[e.id] = { current_location: e.current_location || '', contact_details: e.contact_details || '' };
    }
    setDrafts(snap); setOriginals(orig); setSelectedIds(new Set()); setEditMode(true); setView('list');
  }, [pagedRows]);

  const updateDraft = (empId, field, value) => {
    setDrafts(prev => prev[empId] ? { ...prev, [empId]: { ...prev[empId], [field]: value } } : prev);
  };

  const cancelEditMode = () => { setEditMode(false); setDrafts({}); setOriginals({}); setSelectedIds(new Set()); };

  const gridChangeCount = useMemo(() => {
    let n = 0;
    for (const id of Object.keys(drafts)) {
      const d = drafts[id], o = originals[id] || {};
      if ((d.current_location ?? '').trim() !== (o.current_location ?? '') || (d.contact_details ?? '') !== (o.contact_details ?? '')) n++;
    }
    return n;
  }, [drafts, originals]);

  const saveGridChanges = () => {
    const changes = [];
    for (const id of Object.keys(drafts)) {
      const d = drafts[id], o = originals[id] || {};
      const fields = {};
      if ((d.current_location ?? '').trim() !== (o.current_location ?? '')) fields.current_location = (d.current_location || '').trim();
      if ((d.contact_details ?? '') !== (o.contact_details ?? '')) fields.contact_details = d.contact_details ?? '';
      if (Object.keys(fields).length) changes.push({ id, fields });
    }
    if (changes.length === 0) { cancelEditMode(); return; }
    gridSaveMutation.mutate({ changes });
  };

  // ── Bulk Change Location ──
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allPageSelected = pagedRows.length > 0 && pagedRows.every(r => selectedIds.has(r.id));
  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) pagedRows.forEach(r => next.delete(r.id));
      else pagedRows.forEach(r => next.add(r.id));
      return next;
    });
  };
  const applyBulkLocation = () => {
    const loc = (bulkLocDialog.location || '').trim();
    if (!loc || selectedIds.size === 0) return;
    setDrafts(prev => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (selectedIds.has(id)) next[id] = { ...next[id], current_location: loc };
      }
      return next;
    });
    setBulkLocDialog({ open: false, location: '' });
    toast({ title: `Location set to "${loc}"`, description: `Applied to ${selectedIds.size} row(s). Click Save Changes to persist.` });
  };

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

  const hasActiveFilters = selectedManagerIds.length > 0 || searchInput || companyFilter.length > 0 ||
    departmentFilter.length > 0 || positionFilter.length > 0 || rlicStatusFilter.length > 0 ||
    trainingStatusFilter.length > 0 || pidStatusFilter.length > 0 || medicalResultFilter.length > 0 ||
    (activeTab === 'all' && locationFilter.length > 0) || !!dirIndirFilter ||
    !!trainingScheduledFrom || !!trainingScheduledTo || !!trApprovedFrom || !!trApprovedTo ||
    !!gpIssueFrom || !!gpIssueTo || !!gpReceivedFrom || !!gpReceivedTo || !!pidIssueFrom || !!pidIssueTo;

  const clearFilters = () => {
    setSelectedManagerIds([]); setSearchInput(''); setSearch('');
    setCompanyFilter([]); setDepartmentFilter([]); setPositionFilter([]);
    setRlicStatusFilter([]); setTrainingStatusFilter([]); setPidStatusFilter([]); setMedicalResultFilter([]);
    setLocationFilter([]); setDirIndirFilter('');
    setTrainingScheduledFrom(''); setTrainingScheduledTo('');
    setTrApprovedFrom(''); setTrApprovedTo('');
    setGpIssueFrom(''); setGpIssueTo('');
    setGpReceivedFrom(''); setGpReceivedTo('');
    setPidIssueFrom(''); setPidIssueTo('');
    setPage(0);
  };

  // ── Dashboard drill-down — clicking a chart/table item applies the
  // matching page filter and switches to the personnel list so the user
  // sees the filtered records. Reuses existing filter options so the
  // applied value matches what the FilterToolbar expects.
  const findOpt = (opts, key) => { const k = String(key ?? '').toUpperCase(); return opts.find(o => String(o.value ?? '').toUpperCase() === k); };
  const drillAndShow = (apply) => { apply(); setView('list'); setPage(0); };
  const onDrill = {
    company: (key) => { if (key === 'Unassigned') return; drillAndShow(() => { const o = findOpt(allCompanyOptions, key); setCompanyFilter(o ? [o.value] : [key]); }); },
    department: (key) => { if (key === 'Unassigned') return; drillAndShow(() => { const o = findOpt(allDepartmentOptions, key); setDepartmentFilter(o ? [o.value] : [key]); }); },
    location: (key) => { if (key === 'Unassigned') return; drillAndShow(() => { const o = findOpt(allLocationOptions, key); setLocationFilter(o ? [o.value] : [key]); }); },
    position: (key) => { if (key === 'Unassigned') return; drillAndShow(() => { const o = findOpt(filteredPositions, key); setPositionFilter(o ? [o.value] : [key]); }); },
    manager: (key) => { if (key === 'Unassigned') return; const m = managers.find(m => (m.label || '').toLowerCase() === (key || '').toLowerCase()); if (m) drillAndShow(() => setSelectedManagerIds([m.id])); },
    medical: (key) => { if (key === 'NO MEDICAL RECORD') return; drillAndShow(() => { const o = findOpt(allMedicalResultOptions, key); setMedicalResultFilter(o ? [o.value] : [key]); }); },
    gatePass: (key) => drillAndShow(() => { const o = findOpt(allRlicOptions, key); setRlicStatusFilter(o ? [o.value] : [key]); }),
    training: (key) => { if (key === 'NO RECORD') return; drillAndShow(() => { const o = findOpt(allTrainingOptions, key); setTrainingStatusFilter(o ? [o.value] : [key]); }); },
    pid: (key) => drillAndShow(() => { const o = findOpt(allPidOptions, key); setPidStatusFilter(o ? [o.value] : [key]); }),
    pidExpiry: (key) => { if (key === 'expired') drillAndShow(() => setPidStatusFilter(['EXPIRED PID PASS'])); },
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
    const chips = isComo ? ['Work Location: COMO CAMP'] : [];
    if (!isComo && locationFilter.length) chips.push(`Location: ${locationFilter.join(', ')}`);
    if (companyFilter.length) chips.push(`Company: ${companyFilter.join(', ')}`);
    if (departmentFilter.length) chips.push(`Department: ${departmentFilter.join(', ')}`);
    if (positionFilter.length) chips.push(`Position: ${positionFilter.length} selected`);
    if (selectedManagerIds.length) chips.push(`Manager: ${selectedManagerIds.length} selected`);
    if (dirIndirFilter) chips.push(`DIR/INDIR: ${dirIndirFilter}`);
    if (medicalResultFilter.length) chips.push(`Medical: ${medicalResultFilter.join(', ')}`);
    if (rlicStatusFilter.length) chips.push(`Gate Pass: ${rlicStatusFilter.join(', ')}`);
    if (trainingStatusFilter.length) chips.push(`Training: ${trainingStatusFilter.join(', ')}`);
    if (pidStatusFilter.length) chips.push(`PID Status: ${pidStatusFilter.join(', ')}`);
    if (trainingScheduledFrom || trainingScheduledTo) chips.push(`Train Scheduled: ${trainingScheduledFrom || '…'} → ${trainingScheduledTo || '…'}`);
    if (trApprovedFrom || trApprovedTo) chips.push(`TR Approved: ${trApprovedFrom || '…'} → ${trApprovedTo || '…'}`);
    if (gpIssueFrom || gpIssueTo) chips.push(`GP Submitted: ${gpIssueFrom || '…'} → ${gpIssueTo || '…'}`);
    if (gpReceivedFrom || gpReceivedTo) chips.push(`GP Received: ${gpReceivedFrom || '…'} → ${gpReceivedTo || '…'}`);
    if (pidIssueFrom || pidIssueTo) chips.push(`PID Issue: ${pidIssueFrom || '…'} → ${pidIssueTo || '…'}`);
    if (search) chips.push(`Search: "${search}"`);
    return chips;
  }, [isComo, locationFilter, companyFilter, departmentFilter, positionFilter, selectedManagerIds,
    dirIndirFilter, medicalResultFilter, rlicStatusFilter, trainingStatusFilter, pidStatusFilter,
    trainingScheduledFrom, trainingScheduledTo, trApprovedFrom, trApprovedTo, gpIssueFrom, gpIssueTo,
    gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo, search]);

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
        <div className="flex gap-2 flex-wrap items-center">
          {canEdit && !editMode && (
            <Button variant="outline" onClick={enterEditMode} className="gap-1.5 rounded-full bg-muted/40 hover:bg-muted/60">
              <Pencil className="w-3.5 h-3.5" /> Edit in Grid
            </Button>
          )}
          {editMode ? (
            <>
              <Button onClick={saveGridChanges} disabled={gridSaveMutation.isPending} className="gap-1.5">
                <Save className="w-3.5 h-3.5" /> {gridSaveMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={cancelEditMode} disabled={gridSaveMutation.isPending} className="gap-1.5">
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
              {selectedIds.size > 0 && (
                <Button variant="outline" onClick={() => setBulkLocDialog({ open: true, location: '' })} className="gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Change Location ({selectedIds.size})
                </Button>
              )}
              {gridChangeCount > 0 && (
                <span className="text-xs text-muted-foreground font-medium">{gridChangeCount} row(s) changed</span>
              )}
            </>
          ) : (
            <>
              {view === 'list' && (
                <>
                  <ExportButton getData={getExportData} filename={exportFilename} />
                  <PrintReportButton
                    records={printRecords}
                    columns={printColumns}
                    title={reportTitle}
                    appliedFilters={appliedFilters}
                    totalFiltered={sorted.length}
                    sortBy={isComo ? ['Company'] : ['Work Location', 'Company']}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        <button
          onClick={() => switchTab('all')}
          disabled={editMode}
          className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
            !isComo ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}
        >
          All Locations <span className="ml-1 text-xs font-semibold">({employees.length})</span>
        </button>
        <button
          onClick={() => switchTab('como')}
          disabled={editMode}
          className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
            isComo ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}
        >
          COMO Camp <span className="ml-1 text-xs font-semibold">({comoEmployees.length})</span>
        </button>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg w-fit">
        <button
          onClick={() => !editMode && setView('dashboard')}
          disabled={editMode}
          className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50',
            view === 'dashboard' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
        </button>
        <button
          onClick={() => !editMode && setView('list')}
          disabled={editMode}
          className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50',
            view === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          <List className="w-3.5 h-3.5" /> Personnel List
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search Name, QID, PID, Company, Position, Contact..." value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} disabled={editMode} className="pl-9" />
      </div>

      {/* Filters — same FilterToolbar as Dashboard */}
      <FilterToolbar
        companyFilter={companyFilter} setCompanyFilter={setCompanyFilter} companyOptions={cascadedCompanyOptions}
        departmentFilter={departmentFilter} setDepartmentFilter={setDepartmentFilter} departmentOptions={allDepartmentOptions}
        positionFilter={positionFilter} setPositionFilter={setPositionFilter} positionOptions={filteredPositions}
        selectedManagerIds={selectedManagerIds} setSelectedManagerIds={setSelectedManagerIds} managers={managers}
        locationFilter={locationFilter} setLocationFilter={isComo ? undefined : setLocationFilter} locationOptions={allLocationOptions}
        dirIndirFilter={dirIndirFilter} setDirIndirFilter={setDirIndirFilter}
        rlicStatusFilter={rlicStatusFilter} setRlicStatusFilter={setRlicStatusFilter} rlicOptions={allRlicOptions}
        trainingStatusFilter={trainingStatusFilter} setTrainingStatusFilter={setTrainingStatusFilter} trainingOptions={allTrainingOptions}
        pidStatusFilter={pidStatusFilter} setPidStatusFilter={setPidStatusFilter} pidOptions={allPidOptions}
        medicalResultFilter={medicalResultFilter} setMedicalResultFilter={setMedicalResultFilter} medicalOptions={allMedicalResultOptions}
        trainingScheduledFrom={trainingScheduledFrom} setTrainingScheduledFrom={setTrainingScheduledFrom}
        trainingScheduledTo={trainingScheduledTo} setTrainingScheduledTo={setTrainingScheduledTo}
        trApprovedFrom={trApprovedFrom} setTrApprovedFrom={setTrApprovedFrom}
        trApprovedTo={trApprovedTo} setTrApprovedTo={setTrApprovedTo}
        gpIssueFrom={gpIssueFrom} setGpIssueFrom={setGpIssueFrom}
        gpIssueTo={gpIssueTo} setGpIssueTo={setGpIssueTo}
        gpReceivedFrom={gpReceivedFrom} setGpReceivedFrom={setGpReceivedFrom}
        gpReceivedTo={gpReceivedTo} setGpReceivedTo={setGpReceivedTo}
        pidIssueFrom={pidIssueFrom} setPidIssueFrom={setPidIssueFrom}
        pidIssueTo={pidIssueTo} setPidIssueTo={setPidIssueTo}
        totalFiltered={sorted.length} totalAll={baseDataset.length}
        onClearAll={clearFilters}
      />

      {view === 'dashboard' && (
        <div className="space-y-3">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportDashboardExcel({ data: sorted, isComo, filters: appliedFilters })}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => printDashboardPdf({ data: sorted, isComo, filters: appliedFilters })}>
              <Printer className="w-3.5 h-3.5" /> Print / PDF
            </Button>
          </div>
          <ComoCampDashboard data={sorted} isComo={isComo} firstCardLabel={firstCardLabel} onDrill={onDrill} />
        </div>
      )}

      {view === 'list' && (
        <Card className="overflow-hidden">
        <div className="table-scroll-x">
          <div className="table-scroll-y h-[560px]" ref={scrollRef}>
            <Table className="table-list-view">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-muted/50">
                  {editMode && (
                    <TableHead className="text-xs bg-muted/50 w-8 text-center">
                      <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll} className="h-3.5 w-3.5 cursor-pointer" />
                    </TableHead>
                  )}
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
                    <TableCell colSpan={editMode ? 16 : 15} className="text-center py-12 text-muted-foreground">{emptyMessage}</TableCell>
                  </TableRow>
                ) : (
                  pagedRows.map((emp) => (
                    <TableRow key={emp.id} className="hover:bg-muted/30">
                      {editMode && (
                        <TableCell className="p-2 text-center">
                          <input type="checkbox" checked={selectedIds.has(emp.id)} onChange={() => toggleSelect(emp.id)} className="h-3.5 w-3.5 cursor-pointer" />
                        </TableCell>
                      )}
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
                      <TableCell className="whitespace-nowrap">
                        {editMode && drafts[emp.id] ? (
                          <LocationGridDropdown
                            value={drafts[emp.id].current_location}
                            onChange={(v) => updateDraft(emp.id, 'current_location', v)}
                            options={allLocationOptions}
                          />
                        ) : (
                          <span className="text-xs uppercase">{emp.current_location || '—'}</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {editMode && drafts[emp.id] ? (
                          <input
                            value={drafts[emp.id].contact_details}
                            onChange={(e) => updateDraft(emp.id, 'contact_details', e.target.value)}
                            placeholder="Contact / Mobile"
                            className="w-32 text-xs px-1.5 py-1 rounded border border-input bg-background outline-none focus:ring-1 focus:ring-primary"
                          />
                        ) : (
                          <span className="text-xs uppercase">{emp.contact_details || '—'}</span>
                        )}
                      </TableCell>
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
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(0)} disabled={editMode || page === 0}>«</Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={editMode || page === 0}>‹ Prev</Button>
              <span className="text-xs px-2">Page {page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={editMode || page >= totalPages - 1}>Next ›</Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(totalPages - 1)} disabled={editMode || page >= totalPages - 1}>»</Button>
            </div>
          )}
        </div>
      </Card>
      )}

      <Dialog open={bulkLocDialog.open} onOpenChange={(o) => setBulkLocDialog(s => ({ ...s, open: o }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Location — {selectedIds.size} selected</DialogTitle>
            <DialogDescription>
              Choose an active Location to apply to all selected personnel. The change is saved when you click Save Changes.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">New Location</label>
            <LocationGridDropdown
              value={bulkLocDialog.location}
              onChange={(v) => setBulkLocDialog(s => ({ ...s, location: v }))}
              options={allLocationOptions}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkLocDialog({ open: false, location: '' })}>Cancel</Button>
            <Button onClick={applyBulkLocation} disabled={!bulkLocDialog.location || selectedIds.size === 0}>
              Apply Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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