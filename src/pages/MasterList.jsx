import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { useManagerFilter } from '@/hooks/useManagerFilter';
import WorkforceSubmenuNav from '@/components/common/WorkforceSubmenuNav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PillTabsBar from '@/components/common/PillTabsBar';
import MasterListFilters from '@/components/masterlist/MasterListFilters';
import { Plus, Eye, Pencil, Trash2, Upload, X, PencilLine, UserX, HardHat, UserPlus } from 'lucide-react';
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
import { formatDate } from '@/utils/constants';
import { useLookupOptions } from '@/hooks/useLookupOptions';
import { useMasterListFilterOptions } from '@/hooks/useMasterListFilterOptions';
import { useLatestCampStays } from '@/hooks/useLatestCampStays';
import { formatDuration, formatDateTimeCompact } from '@/lib/attendanceUtils';

import ExportButton from '../components/common/ExportButton';
import InlineEditCell from '../components/common/InlineEditCell';
import DirIndirToggle from '../components/common/DirIndirToggle';
import BulkEditBar from '../components/common/BulkEditBar';
import { ONBOARDING, INACTIVE, isActiveRosterStatus, resolvePersonnelStatus, personnelStatusLabel } from '@/lib/personnelStatus';
import { usePermissions } from '@/lib/usePermissions';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useRbac } from '@/lib/useRbac';
import InactivePersonnelView, { readReturnContext } from '@/components/inactive/InactivePersonnelView';
import {
  createEmptyMasterFilters,
  loadMasterFilters,
  saveMasterFilters,
  hasActiveMasterFilters,
  buildMasterListFilterQuery,
  countMasterListTabs,
  filterMasterRows,
  matchesTabDataset,
  TAB_TOTAL_LABEL,
  MASTER_LIST_PAGE_SIZE,
} from '@/lib/masterListFilters';

export default function MasterList() {
  const { canEdit, canDelete } = usePermissions();
  const currentUser = useCurrentUser();
  // Managers only — which managers are selected lives in the shared filter state.
  const { managers } = useManagerFilter();
  const [editMode, setEditMode] = useState(false);
  // 'all' = Active on Site + Onboarding (the active roster). The Inactive tab
  // lists non-active personnel and restores itself after returning from Edit.
  const [activeTab, setActiveTab] = useState(() => readReturnContext()?.tab === 'inactive' ? 'inactive' : 'all');

  // ── ONE filter state for ALL FOUR tabs ──
  // Restored from the session, kept when switching tabs, and handed unchanged to
  // the single shared filter section (and to the Inactive list).
  const initialFilters = useMemo(() => loadMasterFilters(), []);
  const [filters, setFilters] = useState(initialFilters);
  const [searchInput, setSearchInput] = useState(initialFilters.search || '');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = MASTER_LIST_PAGE_SIZE;

  // A filter change keeps everything else selected and just re-runs the filters.
  const updateFilters = useCallback((patch) => {
    setFilters(prev => ({ ...prev, ...patch }));
    setPage(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(createEmptyMasterFilters());
    setSearchInput('');
    setPage(0);
  }, []);

  // Debounce the search box, then apply it like any other filter.
  const searchDebounceRef = useRef(null);
  const handleSearchChange = useCallback((val) => {
    setSearchInput(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: val }));
      setPage(0);
    }, 300);
  }, []);

  // The shared filter state survives tab switches and page visits.
  useEffect(() => { saveMasterFilters(filters); }, [filters]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { departmentOptions, locationOptions, medicalResultOptions, trainingStatusOptions, rlicStatusOptions } = useLookupOptions();

  // Inactive tab access (permission: Inactive / Demobilized → View)
  const { canView } = useRbac();
  const canViewInactive = canView('workforce.inactive');

  // ── ONE query for the whole Master List ──
  // Every filter the database can apply is pushed into the query, so only
  // matching records travel to the browser. The query is deliberately NOT
  // restricted to the selected tab: its result carries all four tab datasets, so
  // the tab counts are computed from the very rows the table lists — the count of
  // a tab can never disagree with what that tab shows.
  // (The key keeps the ['employees-active'] prefix every module already
  // invalidates, so edits made anywhere refresh this list.)
  const masterQuery = useMemo(
    () => buildMasterListFilterQuery(filters, managers),
    [filters, managers]
  );
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['employees-active', 'master', masterQuery],
    queryFn: () => base44.entities.Employee.filter(masterQuery, '-created_date', 100000),
  });

  // One set of filter options for all four tabs.
  const filterOptions = useMasterListFilterOptions();

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

  // Same rule on every tab — the shared filter state decides.
  const hasActiveFilters = hasActiveMasterFilters(filters);

  const masterBulkFields = [
    { key: 'ftw_result', label: 'Medical Result', type: 'select', options: medicalResultOptions },
    { key: 'training_status', label: 'Training Status', type: 'select', options: trainingStatusOptions },
    { key: 'rlic_status', label: 'RLIC Status', type: 'select', options: rlicStatusOptions },
    { key: 'current_location', label: 'Location', type: 'select', options: locationOptions },
  ];

  const handleBulkApply = async (field, value) => {
    await Promise.all(tabData.map(e => base44.entities.Employee.update(e.id, { [field]: value })));
    queryClient.invalidateQueries({ queryKey: ['employees-active'] });
    toast({ title: `Updated ${tabData.length} records` });
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
      // Personnel / project status only. Demobilization is a COMO Camp status
      // and is recorded through the camp check-out flow, never here.
      if (newStatus === INACTIVE) {
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

  // The filter option lists are NOT derived from the tab's dataset: they come from
  // the lookup tables and from whole-workforce distinct values (see
  // useMasterListFilterOptions), so they are identical on every tab and switching
  // a tab can never change an option or silently drop a selection.

  // ONE shared rule for every tab (@/lib/masterListFilters): the same filters,
  // applied to the same query result. Not restricted to the selected tab — the
  // four tab counts and the table below both come from this one dataset.
  const filtered = useMemo(
    () => filterMasterRows(rows, filters, { latestByPersonnel: latestAttByPersonnel, managers }),
    [rows, filters, latestAttByPersonnel, managers]
  );

  // ── Tab counts ──
  // Counted from the FULL filtered dataset with the current Search & Filters in
  // force — never from the page on screen, so pagination can never shrink a count.
  const tabCounts = useMemo(() => countMasterListTabs(filtered), [filtered]);

  // ── Tab dataset ──
  // The selected tab's slice of that same filtered dataset: exactly the records
  // its count above promises.
  const tabData = useMemo(
    () => filtered.filter(e => matchesTabDataset(e, activeTab)),
    [filtered, activeTab]
  );
  const tabTotal = tabCounts[activeTab] ?? tabData.length;

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
          <p className="text-sm text-muted-foreground mt-1">{tabData.length.toLocaleString()} of {tabTotal.toLocaleString()} {TAB_TOTAL_LABEL[activeTab]} personnel</p>
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

      {/* Filters — ONE shared section for all four tabs (All Personnel, Active on
          Site, Onboarding, Inactive), always ABOVE the tabs. The tab only changes
          the dataset; the filters themselves never change. */}
      <MasterListFilters
        filters={filters}
        onChange={updateFilters}
        options={{ ...filterOptions, managers }}
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
      />

      {activeTab !== 'inactive' && editMode && hasActiveFilters && tabData.length > 0 && (
        <BulkEditBar fields={masterBulkFields} filteredCount={tabData.length} onApply={handleBulkApply} isLoading={updateMutation.isPending} />
      )}

      {/* Personnel Status Tabs — Active + Onboarding = Active on Site + Onboarding */}
      <PillTabsBar
        activeKey={activeTab}
        onChange={(key) => { setActiveTab(key); setPage(0); }}
        tabs={[
          { key: 'all', label: 'All Personnel', count: tabCounts.all, icon: null, color: '' },
          { key: 'active_on_site', label: 'Active on Site', count: tabCounts.active_on_site, icon: HardHat, color: 'text-emerald-600' },
          { key: 'onboarding', label: 'Onboarding', count: tabCounts.onboarding, icon: UserPlus, color: 'text-indigo-600' },
          ...(canViewInactive
            ? [{ key: 'inactive', label: 'Inactive', count: tabCounts.inactive, icon: UserX, color: 'text-red-600' }]
            : []),
        ]}
      />

      {/* The Inactive tab is the same list, of the same filtered rows: its base
          dataset is queried here and the shared filter state is handed over
          unchanged, so it filters exactly like the other three tabs. */}
      {activeTab === 'inactive' && canViewInactive ? (
        <InactivePersonnelView
          status="Inactive"
          rows={tabData}
          isLoading={isLoading}
          managers={managers}
          filters={filters}
          totalCount={tabCounts.inactive}
        />
      ) : (
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
                    <TableCell className="text-xs whitespace-nowrap">
                      <div className="flex justify-center">
                        <DirIndirToggle
                          value={emp.dir_indir}
                          disabled={!canEdit}
                          onToggle={(v) => handleCellSave(emp.id, 'dir_indir', v)}
                        />
                      </div>
                    </TableCell>
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
            Showing <strong>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, tabData.length)}</strong> of <strong>{tabData.length.toLocaleString()}</strong> filtered · <strong>{tabTotal.toLocaleString()}</strong> {TAB_TOTAL_LABEL[activeTab]} personnel
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
      )}

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