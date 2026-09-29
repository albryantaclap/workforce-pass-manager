import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { useManagerFilter } from '@/hooks/useManagerFilter';
import WorkforceSubmenuNav from '@/components/common/WorkforceSubmenuNav';
import PillTabsBar from '@/components/common/PillTabsBar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Eye, Pencil, X, MapPin, UserX, Trash2, Save, Check, LayoutDashboard, List, FileSpreadsheet, Printer, FileText, History, ArrowLeftRight } from 'lucide-react';
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
import QidExpiryBadge from '../components/comocamp/QidExpiryBadge';
import ComoCampDashboard from '../components/comocamp/dashboard/ComoCampDashboard';
import { exportDashboardExcel, printDashboardPdf } from '../components/comocamp/dashboard/exportComoCampDashboard';
import ReportConfigModal from '@/components/dashboard/ReportConfigModal';
import DashboardReport from '@/components/dashboard/DashboardReport';
import { todayStr, formatTime, formatDuration, calcDuration, getAttendanceStatus, statusLabel, groupByPersonnel, getLatestSession, getOpenSession, ATT_STATUS, formatDateTimeCompact } from '@/lib/attendanceUtils';
import { useLatestCampStays } from '@/hooks/useLatestCampStays';
import { useCampStaysByDate } from '@/hooks/useCampStaysByDate';
import CheckInDialog from '../components/comocamp/CheckInDialog';
import CheckOutDialog from '../components/comocamp/CheckOutDialog';
import { demobilizeFromCamp, recordCampMovement } from '@/lib/campDemobilization';
import { CAMP_STATUS } from '@/lib/campStatus';
import AttendanceHistoryDialog from '../components/comocamp/AttendanceHistoryDialog';
import AttendanceCorrectionDialog from '../components/comocamp/AttendanceCorrectionDialog';
import ComoCampEditDialog from '../components/comocamp/ComoCampEditDialog';
import AttendanceKpiCards from '../components/comocamp/AttendanceKpiCards';
import AttendanceFilterBar from '../components/comocamp/AttendanceFilterBar';
import { CheckInCell, CheckOutCell } from '../components/comocamp/AttendanceCells';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import LocationGridDropdown from '../components/comocamp/LocationGridDropdown';
import { computePassStatus, computeQidStatus, formatDate, normalizeDate, QID_STATUSES } from '@/utils/constants';
import { useLookupOptions } from '@/hooks/useLookupOptions';
import { usePermissions } from '@/lib/usePermissions';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { buildRankMap, applyReportSorting } from '../components/dashboard/reportSorting';
import { cn } from '@/lib/utils';
import { useRbac } from '@/lib/useRbac';
import InactivePersonnelView, { useInactiveRoster, statusList, readReturnContext } from '@/components/inactive/InactivePersonnelView';

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
      qidStatusFilter: arr(s.qidStatusFilter),
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
  const [activeTab, setActiveTab] = useState(() => readReturnContext()?.tab === 'demobilized' ? 'demobilized' : 'como');

  // Demobilized personnel — shown in the Demobilized tab beside COMO Camp
  // (permission: Inactive / Demobilized → View)
  const { canView } = useRbac();
  const canViewInactive = canView('workforce.inactive');
  const { employees: inactiveRoster } = useInactiveRoster();
  const demobilizedCount = useMemo(() => statusList(inactiveRoster, 'Demobilized').length, [inactiveRoster]);
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
  const [qidStatusFilter, setQidStatusFilter] = useState(saved.qidStatusFilter || []);
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
  // Quick filter from clicking the Outside / COMO Camp KPI cards (work_location).
  const [workLocationQuick, setWorkLocationQuick] = useState('');

  // Shared Report Configuration (same engine as the main Dashboard).
  const [showReportConfig, setShowReportConfig] = useState(false);
  const [reportConfig, setReportConfig] = useState(null);
  const [showReport, setShowReport] = useState(false);

  // ── Attendance (COMO Camp check-in / check-out) ──
  const [attendanceDate, setAttendanceDate] = useState(todayStr());
  const [attendanceStatus, setAttendanceStatus] = useState('all');
  const [checkInDialog, setCheckInDialog] = useState({ open: false, emp: null });
  const [checkOutDialog, setCheckOutDialog] = useState({ open: false, emp: null, record: null });
  const [historyDialog, setHistoryDialog] = useState({ open: false, emp: null });
  const [correctDialog, setCorrectDialog] = useState({ open: false, record: null, emp: null });
  const [editDialog, setEditDialog] = useState({ open: false, emp: null });

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

  // Today's camp stays for the selected date — one record per personnel.
  // Loaded only in the COMO Camp tab; full history is fetched on demand.
  // Uses the dedicated ComoCampStay entity — completely separate from work
  // attendance (AttendanceRecord).
  const isToday = attendanceDate === todayStr();
  const canCorrect = currentUser?.role === 'admin';
  const {
    sessionsByPersonnel, openByPersonnel, countByPersonnel, daySessionIds,
  records: dayCampStays,
  } = useCampStaysByDate(activeTab === 'como' ? attendanceDate : null);

  // Latest camp stay per personnel — single shared query (all dates, not just
  // the selected date). This is the CAMP STAY source of truth for the row
  // display. Completely separate from work attendance (useLatestAttendance).
  const { latestByPersonnel } = useLatestCampStays();
  const latestOpenByPersonnel = useMemo(() => {
    const m = new Map();
    for (const [id, rec] of latestByPersonnel) {
      if (rec && rec.check_in_at && !rec.check_out_at) m.set(id, rec);
    }
    return m;
  }, [latestByPersonnel]);

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
      // Personnel status only — demobilization is a COMO Camp status and never
      // set from a plain status change.
      if (newStatus === 'Inactive') {
        updates.inactive_date = effectiveDate;
        updates.inactive_reason = reason || '';
      }
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

  // ── Camp Stay mutations (COMO Camp — accommodation movement, NOT work attendance) ──
  const checkInMutation = useMutation({
    mutationFn: async ({ emp, at }) => {
      const stayDate = at.toLocaleDateString('en-CA');
      // Allow only one open camp stay at a time.
      const existing = await base44.entities.ComoCampStay.filter({ personnel_id: emp.id, is_deleted: { $ne: true } }, undefined, 1000);
      const openStay = existing.find(r => r.check_in_at && !r.check_out_at);
      if (openStay) throw new Error('An open camp stay already exists. Check out first before starting a new camp stay.');
      const rec = await base44.entities.ComoCampStay.create({
        personnel_id: emp.id, employee_name: emp.name, company: emp.company,
        stay_date: stayDate, check_in_at: at.toISOString(), check_out_at: '',
        duration_minutes: 0, work_location: emp.current_location || 'COMO CAMP',
        camp_location: emp.current_location || 'COMO CAMP',
        checked_in_by: currentUser?.email || '', checked_in_by_name: currentUser?.full_name || '',
        status: 'open',
      });
      await base44.entities.ActivityLog.create({
        action: 'create', entity_name: 'ComoCampStay', entity_id: rec.id,
        performed_by: currentUser?.email || '', record_name: emp.name,
        record_snapshot: { stay_date: stayDate, check_in_at: rec.check_in_at, check_out_at: '', work_location: rec.work_location, action_type: 'Camp Check-in' },
        changed_fields: ['check_in_at'],
      });
      // Camp movement only — the personnel/project status is never changed by a
      // camp check-in.
      await recordCampMovement({ emp, status: CAMP_STATUS.INSIDE_CAMP, checkInAt: at.toISOString(), user: currentUser });
      return rec;
    },
    onSuccess: (_, { emp, at }) => {
      queryClient.invalidateQueries({ queryKey: ['camp-stays'] });
      queryClient.invalidateQueries({ queryKey: ['employees-active'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      toast({ title: 'Camp Check-in', description: `${emp.name} checked in to camp at ${formatTime(at.toISOString())}` });
    },
    onError: (e) => toast({ title: 'Camp Check-in failed', description: e.message || 'Could not check in', variant: 'destructive' }),
  });

  const checkOutMutation = useMutation({
    mutationFn: async ({ emp, record, at, demobilize, reason }) => {
      const outIso = at.toISOString();
      const duration = calcDuration(record.check_in_at, outIso);
      const updated = await base44.entities.ComoCampStay.update(record.id, {
        check_out_at: outIso, duration_minutes: duration, status: 'completed',
        checked_out_by: currentUser?.email || '', checked_out_by_name: currentUser?.full_name || '',
      });
      await base44.entities.ActivityLog.create({
        action: 'update', entity_name: 'ComoCampStay', entity_id: record.id,
        performed_by: currentUser?.email || '', record_name: record.employee_name,
        record_snapshot: {
          check_out_at: outIso, duration_minutes: duration, work_location: record.work_location,
          action_type: demobilize ? 'Camp Check-out + Demobilization' : 'Camp Check-out',
          reason: reason || '',
        },
        changed_fields: ['check_out_at'],
      });
      // Scenario A — Camp Check-out Only: the camp status changes and the
      // personnel / project status is left exactly as it is.
      // Scenario B — Demobilize from Project: personnel status becomes Inactive
      // and camp status Demobilized, so the person stays in the Inactive list
      // and also appears under Demobilized.
      if (demobilize) {
        await demobilizeFromCamp({ emp, checkOutAt: outIso, reason, user: currentUser });
      } else {
        await recordCampMovement({ emp, status: CAMP_STATUS.CHECKED_OUT, checkOutAt: outIso, user: currentUser });
      }
      return { updated, demobilized: !!demobilize };
    },
    onSuccess: (result, { emp }) => {
      queryClient.invalidateQueries({ queryKey: ['camp-stays'] });
      queryClient.invalidateQueries({ queryKey: ['employees-active'] });
      queryClient.invalidateQueries({ queryKey: ['employees-inactive'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      toast({
        title: result?.demobilized ? 'Demobilized from Project' : 'Camp Check-out',
        description: result?.demobilized
          ? `${emp?.name || 'Personnel'} checked out of COMO Camp, set Inactive and demobilized.`
          : `${emp?.name || 'Personnel'} checked out of COMO Camp. Personnel status unchanged.`,
      });
    },
    onError: () => toast({ title: 'Camp Check-out failed', variant: 'destructive' }),
  });

  const correctAttendanceMutation = useMutation({
    mutationFn: async ({ record, field, originalValue, newValue, reason }) => {
      const updates = { [field]: newValue };
      const previousDuration = record.duration_minutes || 0;
      if (field === 'check_out_at' && record.check_in_at) updates.duration_minutes = calcDuration(record.check_in_at, newValue);
      if (field === 'check_in_at' && record.check_out_at) updates.duration_minutes = calcDuration(newValue, record.check_out_at);
      await base44.entities.ComoCampStay.update(record.id, updates);
      await base44.entities.ActivityLog.create({
        action: 'update', entity_name: 'ComoCampStay', entity_id: record.id,
        performed_by: currentUser?.email || '', record_name: record.employee_name,
        record_snapshot: {
          field, original_value: originalValue, new_value: newValue, reason, correction: true,
          source: 'COMO Camp',
          previous_check_in: record.check_in_at, previous_check_out: record.check_out_at,
          previous_duration: previousDuration, new_duration: updates.duration_minutes ?? previousDuration,
        },
        changed_fields: [field],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camp-stays'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      toast({ title: 'Camp stay corrected', description: 'Correction recorded in the audit log.' });
    },
    onError: () => toast({ title: 'Correction failed', variant: 'destructive' }),
  });

  // Consolidated, transactional save from the COMO Camp Edit dialog. Persists
  // personnel fields (Location / Contact) and the linked camp stay in one
  // mutation: create a new camp stay, or correct the existing latest stay
  // (with a required reason). Throws on failure so the dialog stays open.
  // Uses ComoCampStay — does NOT write to AttendanceRecord.
  const saveEditMutation = useMutation({
    mutationFn: async ({ emp, record, personnelFields, checkInAt, checkOutAt, reason }) => {
      const email = currentUser?.email || '';
      const name = currentUser?.full_name || '';
      const role = currentUser?.role || '';
      // 1. Personnel fields (shared Master List record)
      if (Object.keys(personnelFields).length) {
        const payload = { ...personnelFields, _last_updated_by: email, _last_updated_by_name: name, _last_updated_by_role: role, _last_updated_at: new Date().toISOString() };
        await base44.entities.Employee.update(emp.id, payload);
      }
      // 2. Camp stay
      const hasRecord = !!record;
      if (!hasRecord) {
        if (!checkInAt) return; // nothing to save
        const stayDate = checkInAt.toLocaleDateString('en-CA');
        const existing = await base44.entities.ComoCampStay.filter({ personnel_id: emp.id, is_deleted: { $ne: true } }, undefined, 1000);
        const openStay = existing.find(r => r.check_in_at && !r.check_out_at);
        if (openStay) throw new Error('An open camp stay already exists. Check out first before starting a new camp stay.');
        const completed = !!checkOutAt;
        const outIso = completed ? checkOutAt.toISOString() : '';
        const duration = completed ? calcDuration(checkInAt.toISOString(), outIso) : 0;
        const rec = await base44.entities.ComoCampStay.create({
          personnel_id: emp.id, employee_name: emp.name, company: emp.company,
          stay_date: stayDate, check_in_at: checkInAt.toISOString(), check_out_at: outIso,
          duration_minutes: duration, work_location: emp.current_location || 'COMO CAMP',
          camp_location: emp.current_location || 'COMO CAMP',
          checked_in_by: email, checked_in_by_name: name,
          checked_out_by: completed ? email : '', checked_out_by_name: completed ? name : '',
          status: completed ? 'completed' : 'open',
        });
        await base44.entities.ActivityLog.create({
          action: 'create', entity_name: 'ComoCampStay', entity_id: rec.id,
          performed_by: email, record_name: emp.name,
          record_snapshot: { stay_date: stayDate, check_in_at: rec.check_in_at, check_out_at: outIso, duration_minutes: duration, action_type: completed ? 'Camp Check-in + Check-out' : 'Camp Check-in' },
          changed_fields: completed ? ['check_in_at', 'check_out_at'] : ['check_in_at'],
        });
        return;
      }
      // Correct the existing (latest) camp stay
      const finalIn = checkInAt ? checkInAt.toISOString() : record.check_in_at;
      const finalOut = checkOutAt ? checkOutAt.toISOString() : '';
      const inChanged = record.check_in_at && checkInAt && checkInAt.toISOString() !== record.check_in_at;
      const outChanged = record.check_out_at ? (!!checkOutAt && checkOutAt.toISOString() !== record.check_out_at) : !!checkOutAt;
      const outCleared = record.check_out_at && !checkOutAt;
      const anyAttChange = inChanged || outChanged || outCleared;
      if (!anyAttChange) return;
      if (!reason.trim()) throw new Error('A correction reason is required when modifying an existing camp stay.');
      const updates = {};
      if (inChanged) updates.check_in_at = finalIn;
      if (outChanged) updates.check_out_at = finalOut;
      if (outCleared) updates.check_out_at = '';
      updates.duration_minutes = (finalIn && finalOut) ? calcDuration(finalIn, finalOut) : 0;
      updates.status = finalOut ? 'completed' : 'open';
      if (outChanged || outCleared) {
        updates.checked_out_by = finalOut ? email : '';
        updates.checked_out_by_name = finalOut ? name : '';
      }
      await base44.entities.ComoCampStay.update(record.id, updates);
      await base44.entities.ActivityLog.create({
        action: 'update', entity_name: 'ComoCampStay', entity_id: record.id,
        performed_by: email, record_name: record.employee_name,
        record_snapshot: { ...updates, correction: true, source: 'COMO Camp Edit', action_type: 'Camp Stay Corrected', previous_check_in: record.check_in_at, previous_check_out: record.check_out_at, previous_duration: record.duration_minutes, reason: reason.trim() },
        changed_fields: Object.keys(updates).filter(k => k !== 'duration_minutes' && k !== 'status'),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camp-stays'] });
      queryClient.invalidateQueries({ queryKey: ['employees-active'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      toast({ title: 'Changes saved', description: 'Camp stay and personnel updates synced across all modules.' });
    },
    onError: (e) => toast({ title: 'Save failed', description: e.message || 'Could not save changes', variant: 'destructive' }),
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

  // Reset the Work Location quick filter whenever the tab changes.
  useEffect(() => { setWorkLocationQuick(''); }, [activeTab]);

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
      const effectiveQid = computeQidStatus(emp.qid_expiry);
      const matchesQid = qidStatusFilter.length === 0 || qidStatusFilter.includes(effectiveQid);
      const matchesTraining = trainingStatusFilter.length === 0 || trainingStatusFilter.includes(emp.training_status);
      const matchesMedical = medicalResultFilter.length === 0 || medicalResultFilter.includes(emp.ftw_result);
      const matchesWorkLocQuick = !workLocationQuick || (emp.current_location || '').trim().toUpperCase() === workLocationQuick;
      // Attendance status filter uses the LATEST session for Checked In /
      // Checked Out (so it matches the row display and the Master List), and
      // the selected-date session set for "Not Checked In" (no session on the
      // selected date).
      const latestRec = isComo ? latestByPersonnel.get(emp.id) : null;
      const latestSt = getAttendanceStatus(latestRec);
      const hasDaySession = isComo ? daySessionIds.has(emp.id) : false;
      const matchesAtt = !isComo || attendanceStatus === 'all' ||
        (attendanceStatus === ATT_STATUS.CHECKED_IN && latestSt === ATT_STATUS.CHECKED_IN) ||
        (attendanceStatus === ATT_STATUS.CHECKED_OUT && latestSt === ATT_STATUS.CHECKED_OUT) ||
        (attendanceStatus === ATT_STATUS.NOT_CHECKED_IN && !hasDaySession);

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
        matchesLocation && matchesDirIndir && matchesRlic && matchesPid && matchesQid && matchesTraining && matchesMedical &&
        matchesWorkLocQuick &&
        matchTrainSchedFrom && matchTrainSchedTo && matchTrFrom && matchTrTo &&
        matchGpIssueFrom && matchGpIssueTo && matchGpReceivedFrom && matchGpReceivedTo && matchPidFrom && matchPidTo &&
        matchesAtt;
    });
  }, [baseDataset, search, companyFilter, departmentFilter, positionFilter, selectedManagerIds, managers,
    locationFilter, dirIndirFilter, rlicStatusFilter, pidStatusFilter, qidStatusFilter, trainingStatusFilter, medicalResultFilter,
    trainingScheduledFrom, trainingScheduledTo, trApprovedFrom, trApprovedTo, gpIssueFrom, gpIssueTo,
    gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo, workLocationQuick, isComo, attendanceStatus, latestByPersonnel, daySessionIds]);

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

  // Augment the filtered dataset with the selected date's attendance fields so
  // the shared Report Configuration / preview engine can render Check-in /
  // Check-out / Duration / Attendance Status columns (COMO Camp tab only).
  const reportDataset = useMemo(() => {
    return sorted.map(e => {
      const base = { ...e, qid_status: computeQidStatus(e.qid_expiry) };
      if (!isComo) return base;
      const rec = latestByPersonnel.get(e.id);
      if (!rec) return base;
      return { ...base, check_in_at: rec.check_in_at, check_out_at: rec.check_out_at, duration_minutes: rec.duration_minutes, attendance_status: getAttendanceStatus(rec) };
    });
  }, [sorted, latestByPersonnel, isComo]);

  useEffect(() => {
    saveFilters({
      activeTab, search, companyFilter, departmentFilter, positionFilter, rlicStatusFilter,
      trainingStatusFilter, pidStatusFilter, qidStatusFilter, medicalResultFilter, locationFilter, dirIndirFilter,
      trainingScheduledFrom, trainingScheduledTo, trApprovedFrom, trApprovedTo, gpIssueFrom, gpIssueTo,
      gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo, page,
    });
  }, [activeTab, search, companyFilter, departmentFilter, positionFilter, rlicStatusFilter,
    trainingStatusFilter, pidStatusFilter, qidStatusFilter, medicalResultFilter, locationFilter, dirIndirFilter,
    trainingScheduledFrom, trainingScheduledTo, trApprovedFrom, trApprovedTo, gpIssueFrom, gpIssueTo,
    gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo, page]);

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    setPage(0);
  }, [companyFilter, departmentFilter, positionFilter, rlicStatusFilter, trainingStatusFilter,
    pidStatusFilter, qidStatusFilter, medicalResultFilter, locationFilter, dirIndirFilter,
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
    trainingStatusFilter.length > 0 || pidStatusFilter.length > 0 || qidStatusFilter.length > 0 || medicalResultFilter.length > 0 ||
    (activeTab === 'all' && locationFilter.length > 0) || !!dirIndirFilter ||
    !!trainingScheduledFrom || !!trainingScheduledTo || !!trApprovedFrom || !!trApprovedTo ||
    !!gpIssueFrom || !!gpIssueTo || !!gpReceivedFrom || !!gpReceivedTo || !!pidIssueFrom || !!pidIssueTo ||
    (isComo && attendanceStatus !== 'all');

  const clearFilters = () => {
    setSelectedManagerIds([]); setSearchInput(''); setSearch('');
    setCompanyFilter([]); setDepartmentFilter([]); setPositionFilter([]);
    setRlicStatusFilter([]); setTrainingStatusFilter([]); setPidStatusFilter([]); setQidStatusFilter([]); setMedicalResultFilter([]);
    setLocationFilter([]); setDirIndirFilter('');
    setTrainingScheduledFrom(''); setTrainingScheduledTo('');
    setTrApprovedFrom(''); setTrApprovedTo('');
    setGpIssueFrom(''); setGpIssueTo('');
    setGpReceivedFrom(''); setGpReceivedTo('');
    setPidIssueFrom(''); setPidIssueTo('');
    setWorkLocationQuick('');
    setAttendanceStatus('all');
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

  // ── Attendance KPI card click → set attendance status filter + switch to list
  const handleAttCardClick = (id) => {
    const map = {
      attTotal: 'all', attCheckedIn: 'checked_in', attCheckedOut: 'checked_out',
      attInside: 'checked_in', attNotCheckedIn: 'not_checked_in',
    };
    const st = map[id];
    if (!st) return;
    setAttendanceStatus(st);
    setView('list');
    setPage(0);
  };

  // ── KPI card click → quick filter + switch to personnel list
  const handleCardClick = (id) => {
    switch (id) {
      case 'total': drillAndShow(() => setWorkLocationQuick('')); break;
      case 'gpValid': drillAndShow(() => setRlicStatusFilter(['VALID RLIC PASS', 'SOON TO EXPIRE'])); break;
      case 'trainDone': drillAndShow(() => setTrainingStatusFilter(['DONE'])); break;
      case 'trainOnGoing': drillAndShow(() => setTrainingStatusFilter(['ON-GOING'])); break;
      case 'trainPending': drillAndShow(() => setTrainingStatusFilter(['PENDING', 'TO BE SCHEDULED'])); break;
      case 'pidValid': drillAndShow(() => setPidStatusFilter(['VALID PID PASS', 'SOON TO EXPIRE'])); break;
      case 'pidExpired': drillAndShow(() => setPidStatusFilter(['EXPIRED PID PASS'])); break;
      case 'outside': drillAndShow(() => setWorkLocationQuick('OUTSIDE')); break;
      case 'comoCamp': drillAndShow(() => setWorkLocationQuick('COMO CAMP')); break;
      default: break;
    }
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
      'QID Expiry': formatDate(e.qid_expiry),
      'QID Status': computeQidStatus(e.qid_expiry),
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
      ...(isComo ? {
        'Camp Check-in Date': (() => { const r = latestByPersonnel.get(e.id); return r ? (r.stay_date || '') : '—'; })(),
        'Camp Check-in Time': (() => { const r = latestByPersonnel.get(e.id); return r ? formatTime(r.check_in_at) : '—'; })(),
        'Camp Check-out Time': (() => { const r = latestByPersonnel.get(e.id); return r ? formatTime(r.check_out_at) : '—'; })(),
        'Camp Stay Duration': (() => { const r = latestByPersonnel.get(e.id); return r && r.check_out_at ? formatDuration(r.duration_minutes) : '—'; })(),
        'Camp Status': statusLabel(latestByPersonnel.get(e.id)),
      } : {}),
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
    const rec = isComo ? latestByPersonnel.get(e.id) : null;
    return {
      Name: e.name || '—',
      Company: e.company || '—',
      'QID No': e.qid_no || '—',
      'QID Expiry': formatDate(e.qid_expiry),
      'QID Status': computeQidStatus(e.qid_expiry),
      'PID No': e.pid || '—',
      Medical: e.ftw_result || 'New',
      'Gate Pass': gpStatus,
      Training: e.training_status || '—',
      'PID Status': pidStatus,
      'PID Expiry': formatDate(e.pid_expiry),
      'PID Days Left': daysLeft,
      'Work Location': e.current_location || '—',
      'Camp Check-in': rec ? formatTime(rec.check_in_at) : '—',
      'Camp Check-out': rec ? formatTime(rec.check_out_at) : '—',
      'Camp Stay Duration': rec && rec.check_out_at ? formatDuration(rec.duration_minutes) : '—',
      Contact: e.contact_details || '—',
    };
  }), [sorted, isComo, latestByPersonnel]);

  const printColumns = [
    { key: 'Name', label: 'Name' },
    { key: 'Company', label: 'Company' },
    { key: 'QID No', label: 'QID No.' },
    { key: 'QID Expiry', label: 'QID Expiry' },
    { key: 'QID Status', label: 'QID Status' },
    { key: 'PID No', label: 'PID No.' },
    { key: 'Medical', label: 'Medical' },
    { key: 'Gate Pass', label: 'Gate Pass' },
    { key: 'Training', label: 'Training' },
    { key: 'PID Status', label: 'PID Status' },
    { key: 'PID Expiry', label: 'PID Expiry' },
    { key: 'PID Days Left', label: 'PID Days Left' },
    { key: 'Work Location', label: 'Work Location' },
    ...(isComo ? [
      { key: 'Camp Check-in', label: 'Camp Check-in' },
      { key: 'Camp Check-out', label: 'Camp Check-out' },
      { key: 'Camp Stay Duration', label: 'Camp Stay Duration' },
    ] : []),
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
    if (qidStatusFilter.length) chips.push(`QID Status: ${qidStatusFilter.map(s => QID_STATUSES.find(o => o.value === s)?.label || s).join(', ')}`);
    if (trainingScheduledFrom || trainingScheduledTo) chips.push(`Train Scheduled: ${trainingScheduledFrom || '…'} → ${trainingScheduledTo || '…'}`);
    if (trApprovedFrom || trApprovedTo) chips.push(`TR Approved: ${trApprovedFrom || '…'} → ${trApprovedTo || '…'}`);
    if (gpIssueFrom || gpIssueTo) chips.push(`GP Submitted: ${gpIssueFrom || '…'} → ${gpIssueTo || '…'}`);
    if (gpReceivedFrom || gpReceivedTo) chips.push(`GP Received: ${gpReceivedFrom || '…'} → ${gpReceivedTo || '…'}`);
    if (pidIssueFrom || pidIssueTo) chips.push(`PID Issue: ${pidIssueFrom || '…'} → ${pidIssueTo || '…'}`);
    if (search) chips.push(`Search: "${search}"`);
    return chips;
  }, [isComo, locationFilter, companyFilter, departmentFilter, positionFilter, selectedManagerIds,
    dirIndirFilter, medicalResultFilter, rlicStatusFilter, trainingStatusFilter, pidStatusFilter, qidStatusFilter,
    trainingScheduledFrom, trainingScheduledTo, trApprovedFrom, trApprovedTo, gpIssueFrom, gpIssueTo,
    gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo, search]);

  const reportTitle = isComo ? 'GSO QATAR — COMO CAMP PERSONNEL REPORT' : 'GSO QATAR — WORK LOCATION PERSONNEL REPORT';

  // COMO Camp-specific extensions to the shared Report Configuration (the modal
  // and preview engine are reused from the main Dashboard; these extras surface
  // Work Location as a first-class section / column / sort field here only).
  const COMO_EXTRA_SECTIONS = [{ id: 'work_location_summary', label: 'Work Location Summary' }];
  const COMO_EXTRA_COLUMNS = [
    { id: 'photo', label: 'Photo' },
    { id: 'docs', label: 'Docs' },
    { id: 'company_type', label: 'Company Type' },
    { id: 'work_location', label: 'Work Location' },
    { id: 'ftw_medical_date', label: 'Medical Date' },
    { id: 'ftw_approved_date', label: 'TR Date Approved' },
    { id: 'gate_pass_received_date', label: 'Gate Pass Received Date' },
    { id: 'training_date_scheduled', label: 'Training Date Scheduled' },
    { id: 'training_date_start', label: 'Training Date Started' },
    { id: 'pid_issue_date', label: 'PID Issue Date' },
    { id: 'qid_expiry', label: 'QID Expiry' },
    { id: 'qid_status', label: 'QID Status' },
    { id: 'pid_days_left', label: 'PID Days Left' },
    { id: 'check_in_at', label: 'Camp Check-in' },
    { id: 'check_out_at', label: 'Camp Check-out' },
    { id: 'duration_minutes', label: 'Camp Stay Duration' },
    { id: 'attendance_status', label: 'Camp Status' },
  ];
  const COMO_EXTRA_SORT_FIELDS = [
    { id: 'work_location', label: 'Work Location', kind: 'text' },
    { id: 'pid_days_left', label: 'PID Days Left', kind: 'score' },
    { id: 'pid_issue_date', label: 'PID Issue Date', kind: 'date' },
    { id: 'nationality', label: 'Nationality', kind: 'text' },
    { id: 'contact_details', label: 'Mobile / Contact', kind: 'text' },
    { id: 'pid', label: 'PID Number', kind: 'text' },
  ];
  const exportFilename = isComo ? 'como_camp_personnel.csv' : 'personnel_by_work_location.csv';
  const firstCardLabel = isComo ? 'Total COMO Camp' : 'Total Personnel';
  const subtitle = isComo
    ? `${sorted.length} COMO Camp personnel · ${employees.length} total active`
    : `${sorted.length} filtered · ${employees.length} total active`;
  const footerTotalLabel = isComo ? `${comoEmployees.length} total COMO Camp` : `${employees.length} total active`;
  const emptyMessage = isComo ? 'No COMO Camp personnel found' : 'No personnel found for the current filters';

  // Category cards for the shared report preview (same shape as the main Dashboard).
  const getRlicR = (e) => computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
  const getPidR = (e) => computePassStatus(e.pid_expiry, 'pid', e.pid_status);
  const categoryCards = useMemo(() => {
    const validRlic = sorted.filter(e => getRlicR(e) === 'VALID RLIC PASS').length;
    const soonRlic = sorted.filter(e => getRlicR(e) === 'SOON TO EXPIRE').length;
    const expiredRlic = sorted.filter(e => getRlicR(e) === 'EXPIRED RLIC PASS').length;
    const validPid = sorted.filter(e => getPidR(e) === 'VALID PID PASS').length;
    const soonPid = sorted.filter(e => getPidR(e) === 'SOON TO EXPIRE').length;
    const expiredPid = sorted.filter(e => getPidR(e) === 'EXPIRED PID PASS').length;
    const medAccepted = sorted.filter(e => (e.ftw_result || '').trim().toUpperCase() === 'ACCEPTED').length;
    const medWaiting = sorted.filter(e => e.ftw_result === 'WAITING TR APPROVAL').length;
    const medRejected = sorted.filter(e => e.ftw_result === 'REJECTED').length;
    const trainDone = sorted.filter(e => (e.training_status || '').trim().toUpperCase() === 'DONE').length;
    const trainOnGoing = sorted.filter(e => ['ON-GOING', 'ONGOING', 'ON GOING'].includes((e.training_status || '').trim().toUpperCase())).length;
    const trainPending = sorted.filter(e => ['PENDING', 'TO BE SCHEDULED'].includes((e.training_status || '').trim().toUpperCase())).length;
    return [
      { title: 'Medical Data', combined: medAccepted, combinedLabel: 'Accepted', stats: [
        { label: 'Accepted', value: medAccepted, color: 'text-green-600' },
        { label: 'Waiting TR', value: medWaiting, color: 'text-amber-600' },
        { label: 'Rejected', value: medRejected, color: 'text-red-600' },
      ] },
      { title: 'Gate Pass (RLIC)', combined: validRlic + soonRlic, combinedLabel: 'Total Valid', stats: [
        { label: 'Valid', value: validRlic, color: 'text-green-600' },
        { label: 'Soon', value: soonRlic, color: 'text-amber-600' },
        { label: 'Expired', value: expiredRlic, color: 'text-red-600' },
      ] },
      { title: 'Training', combined: trainDone, combinedLabel: 'Done', stats: [
        { label: 'Done', value: trainDone, color: 'text-green-600' },
        { label: 'On-Going', value: trainOnGoing, color: 'text-blue-600' },
        { label: 'Pending', value: trainPending, color: 'text-amber-600' },
      ] },
      { title: 'Project ID', combined: validPid + soonPid, combinedLabel: 'Total Valid', stats: [
        { label: 'Valid', value: validPid, color: 'text-green-600' },
        { label: 'Soon', value: soonPid, color: 'text-amber-600' },
        { label: 'Expired', value: expiredPid, color: 'text-red-600' },
      ] },
    ];
  }, [sorted]);

  return (
    <div className="space-y-5">
      <WorkforceSubmenuNav />
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
              <Button variant="outline" onClick={() => setShowReportConfig(true)} className="gap-1.5 rounded-full bg-muted/40 hover:bg-muted/60">
                <FileText className="w-3.5 h-3.5" /> Report Configuration
              </Button>
              {view === 'list' && activeTab !== 'demobilized' && (
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
      <PillTabsBar
        activeKey={activeTab}
        onChange={switchTab}
        tabs={[
          { key: 'all', label: 'All Locations', count: employees.length, disabled: editMode },
          { key: 'como', label: 'COMO Camp', count: comoEmployees.length, disabled: editMode },
          ...(canViewInactive
            ? [{ key: 'demobilized', label: 'Demobilized', count: demobilizedCount, icon: ArrowLeftRight, color: 'text-orange-600', disabled: editMode }]
            : []),
        ]}
      />

      {activeTab === 'demobilized' && canViewInactive ? (
        <InactivePersonnelView status="Demobilized" />
      ) : (
      <>
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
        qidStatusFilter={qidStatusFilter} setQidStatusFilter={setQidStatusFilter} qidOptions={QID_STATUSES}
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

      {workLocationQuick && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs w-fit">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          <span className="font-medium text-primary">Location: {workLocationQuick}</span>
          <button onClick={() => setWorkLocationQuick('')} className="text-primary/70 hover:text-primary" title="Clear quick filter">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isComo && (
        <AttendanceFilterBar
          attendanceDate={attendanceDate}
          setAttendanceDate={setAttendanceDate}
          attendanceStatus={attendanceStatus}
          setAttendanceStatus={setAttendanceStatus}
        />
      )}

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
          {isComo && (
            <AttendanceKpiCards data={sorted} latestByPersonnel={latestByPersonnel} daySessionIds={daySessionIds} onCard={handleAttCardClick} />
          )}
          <ComoCampDashboard data={sorted} isComo={isComo} firstCardLabel={firstCardLabel} onDrill={onDrill} onCard={handleCardClick} />
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
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">QID Expiry</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PID No.</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Medical</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Gate Pass</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Training</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PID Status</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PID Expiry</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">PID Days Left</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Location</TableHead>
                  {isComo && <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Camp Check-in</TableHead>}
                  {isComo && <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Camp Check-out</TableHead>}
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Contact</TableHead>
                  <TableHead className="text-xs text-right bg-muted/50 whitespace-nowrap sticky right-0 z-20 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(8).fill(0).map((_, i) => (
                    <TableRow key={i}>{Array(16).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                  ))
                ) : sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={editMode ? 17 : 16} className="text-center py-12 text-muted-foreground">{emptyMessage}</TableCell>
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
                      <TableCell className="whitespace-nowrap"><QidExpiryBadge dateStr={emp.qid_expiry} /></TableCell>
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
                      {isComo && (
                        <TableCell className="whitespace-nowrap">
                          <CheckInCell
                            emp={emp}
                            openRecord={latestOpenByPersonnel.get(emp.id)}
                            latestRecord={latestByPersonnel.get(emp.id)}
                            sessionCount={countByPersonnel.get(emp.id) || 0}
                            canEdit={canEdit}
                            isToday={isToday}
                            isComoCamp={(emp.current_location || '').trim().toUpperCase() === 'COMO CAMP'}
                            onCheckIn={(e) => setCheckInDialog({ open: true, emp: e })}
                            onHistory={(e) => setHistoryDialog({ open: true, emp: e })}
                          />
                        </TableCell>
                      )}
                      {isComo && (
                        <TableCell className="whitespace-nowrap">
                          <CheckOutCell
                            emp={emp}
                            openRecord={latestOpenByPersonnel.get(emp.id)}
                            latestRecord={latestByPersonnel.get(emp.id)}
                            canEdit={canEdit}
                            isToday={isToday}
                            isComoCamp={(emp.current_location || '').trim().toUpperCase() === 'COMO CAMP'}
                            onCheckOut={(e, r) => setCheckOutDialog({ open: true, emp: e, record: r })}
                          />
                        </TableCell>
                      )}
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
                            {isComo && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setHistoryDialog({ open: true, emp })}>
                                    <History className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Attendance History</TooltipContent>
                              </Tooltip>
                            )}
                            {canEdit && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  {isComo ? (
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditDialog({ open: true, emp })}>
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                  ) : (
                                    <Link to={`/employees/${emp.id}/edit`} onClick={saveScroll}>
                                      <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button>
                                    </Link>
                                  )}
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
      </>
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

      {showReportConfig && (
        <ReportConfigModal
          filtered={reportDataset}
          extraSections={COMO_EXTRA_SECTIONS}
          extraColumns={COMO_EXTRA_COLUMNS}
          extraSortFields={COMO_EXTRA_SORT_FIELDS}
          onClose={() => setShowReportConfig(false)}
          onGenerate={(cfg) => { setReportConfig(cfg); setShowReportConfig(false); setShowReport(true); }}
        />
      )}
      {showReport && reportConfig && (
        <DashboardReport
          filtered={reportDataset}
          categoryCards={categoryCards}
          reportTitle={reportTitle}
          extraColumns={COMO_EXTRA_COLUMNS}
          onClose={() => setShowReport(false)}
          companyFilter={companyFilter}
          config={reportConfig}
          selectedManagerIds={selectedManagerIds}
          managers={managers}
        />
      )}

      <CheckInDialog
        open={checkInDialog.open}
        emp={checkInDialog.emp}
        onClose={() => setCheckInDialog({ open: false, emp: null })}
        onConfirm={(emp, at) => { setCheckInDialog({ open: false, emp: null }); checkInMutation.mutate({ emp, at }); }}
      />
      <CheckOutDialog
        open={checkOutDialog.open}
        emp={checkOutDialog.emp}
        record={checkOutDialog.record}
        onClose={() => setCheckOutDialog({ open: false, emp: null, record: null })}
        onConfirm={(record, at, { demobilize, reason }) => { const emp = checkOutDialog.emp; setCheckOutDialog({ open: false, emp: null, record: null }); checkOutMutation.mutate({ emp, record, at, demobilize, reason }); }}
      />
      <AttendanceHistoryDialog
        open={historyDialog.open}
        emp={historyDialog.emp}
        canCorrect={canCorrect}
        onCorrect={(record, emp) => { setHistoryDialog({ open: false, emp: null }); setCorrectDialog({ open: true, record, emp }); }}
        onClose={() => setHistoryDialog({ open: false, emp: null })}
      />
      <AttendanceCorrectionDialog
        open={correctDialog.open}
        record={correctDialog.record}
        emp={correctDialog.emp}
        onClose={() => setCorrectDialog({ open: false, record: null, emp: null })}
        onConfirm={(data) => {
          setCorrectDialog({ open: false, record: null, emp: null });
          correctAttendanceMutation.mutate(data);
        }}
      />
      <ComoCampEditDialog
        open={editDialog.open}
        emp={editDialog.emp}
        record={editDialog.emp ? latestByPersonnel.get(editDialog.emp.id) : null}
        attendanceDate={attendanceDate}
        canEdit={canEdit}
        locationOptions={allLocationOptions}
        onClose={() => setEditDialog({ open: false, emp: null })}
        onSave={(emp, record, personnelFields, checkInAt, checkOutAt, reason) =>
          saveEditMutation.mutateAsync({ emp, record, personnelFields, checkInAt, checkOutAt, reason })}
      />
    </div>
  );
}