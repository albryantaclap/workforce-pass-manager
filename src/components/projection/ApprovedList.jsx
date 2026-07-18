import React, { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { PencilLine, X, FileText, Sheet, Plus, Trash2, Link2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import InlineEditCell from '@/components/common/InlineEditCell';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { usePermissions } from '@/lib/usePermissions';
import {
  BadgeSpan, getMedStatus, getGPStatus, getTrainingStatus, getPIDStatus,
  defaultSort, fmtApprovalDate,
  EMP_MEDICAL_OPTIONS, EMP_GP_OPTIONS, EMP_TRAINING_OPTIONS, EMP_PID_OPTIONS,
  APPROVAL_STATUS_OPTIONS, PRINT_CLASS_MAP, EXCEL_COLOR_MAP,
} from './approvedListHelpers';
import ApprovedRecordForm from './ApprovedRecordForm';

const PAGE_SIZE = 25;
const COL_SPAN = 15;
const COL_HDR  = { background: '#DCE6F2', color: '#2D3748' };
const PID_HDR  = { background: '#DDEFE0', color: '#1A5C2A' };
const PID_CELL = { background: '#F5FBF6' };
const REMARKS_BG = '#FAFAFA';

const HEADERS = [
  ['#', 'center', 'w-10', null],
  ['Full Name', 'left', '', null],
  ['QID Number', 'center', 'w-28', null],
  ['PID No.', 'center', 'w-24', null],
  ['Mobile Number', 'center', 'w-28', null],
  ['Company', 'center', 'w-32', null],
  ['Designation / Position', 'center', 'w-44', null],
  ['Medical', 'center', 'w-28', null],
  ['Gate Pass Status', 'center', 'w-28', null],
  ['Training Status', 'center', 'w-28', null],
  ['Project ID Status', 'center', 'w-28', 'pid'],
  ['Approval Comments', 'left', 'w-44', null],
  ['Approval Date', 'center', 'w-28', null],
  ['Remarks', 'left', 'w-44', null],
  ['Actions', 'center', 'w-20', null],
];

export default function ApprovedList() {
  const { toast } = useToast();
  const currentUser = useCurrentUser();
  const { canEdit, canDelete } = usePermissions();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState([]);
  const [positionFilter, setPositionFilter] = useState([]);
  const [managerFilter, setManagerFilter] = useState([]);
  const [locationFilter, setLocationFilter] = useState([]);
  const [medFilter, setMedFilter] = useState([]);
  const [gpFilter, setGpFilter] = useState([]);
  const [trainFilter, setTrainFilter] = useState([]);
  const [pidFilter, setPidFilter] = useState([]);
  const [approvalFilter, setApprovalFilter] = useState([]);
  const [approvalFrom, setApprovalFrom] = useState('');
  const [approvalTo, setApprovalTo] = useState('');
  const [page, setPage] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [showForm, setShowForm] = useState(false);
  const [formInitial, setFormInitial] = useState(null);

  const { data: records = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['approvedRecords'],
    queryFn: () => base44.entities.ApprovedRecord.list('-created_date', 5000),
    staleTime: 5000,
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, '-created_date', 10000),
    staleTime: 30000,
  });

  const empMap = useMemo(() => {
    const m = new Map();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  const companyOptions = useMemo(() => uniq(records.map(r => r.company)), [records]);
  const positionOptions = useMemo(() => uniq(records.map(r => r.designation_position)), [records]);
  const managerOptions = useMemo(() => uniq(records.map(r => r.manager_assigned)), [records]);
  const locationOptions = useMemo(() => uniq(records.map(r => r.work_location)), [records]);
  const medOptions = useMemo(() => uniq(records.map(r => r.medical)), [records]);
  const gpOptions = useMemo(() => uniq(records.map(r => r.gate_pass_status)), [records]);
  const trainOptions = useMemo(() => uniq(records.map(r => r.training_status)), [records]);
  const pidOptions = useMemo(() => uniq(records.map(r => r.project_id_status)), [records]);

  const hasFilter = !!(search || companyFilter.length || positionFilter.length || managerFilter.length ||
    locationFilter.length || medFilter.length || gpFilter.length || trainFilter.length ||
    pidFilter.length || approvalFilter.length || approvalFrom || approvalTo);

  const clearFilters = () => {
    setSearch(''); setCompanyFilter([]); setPositionFilter([]); setManagerFilter([]);
    setLocationFilter([]); setMedFilter([]); setGpFilter([]); setTrainFilter([]);
    setPidFilter([]); setApprovalFilter([]); setApprovalFrom(''); setApprovalTo('');
  };

  const sortedFiltered = useMemo(() => {
    let rows = records.filter(r => {
      if (search) {
        const q = search.toLowerCase();
        const hay = [r.full_name, r.qid_number, r.pid_no, r.company, r.designation_position, r.manager_assigned, r.approval_comments]
          .map(s => (s || '').toLowerCase()).join(' ');
        if (!hay.includes(q)) return false;
      }
      if (companyFilter.length && !companyFilter.includes(r.company)) return false;
      if (positionFilter.length && !positionFilter.includes(r.designation_position)) return false;
      if (managerFilter.length && !managerFilter.includes(r.manager_assigned)) return false;
      if (locationFilter.length && !locationFilter.includes(r.work_location)) return false;
      if (medFilter.length && !medFilter.includes(r.medical)) return false;
      if (gpFilter.length && !gpFilter.includes(r.gate_pass_status)) return false;
      if (trainFilter.length && !trainFilter.includes(r.training_status)) return false;
      if (pidFilter.length && !pidFilter.includes(r.project_id_status)) return false;
      if (approvalFilter.length && !approvalFilter.includes(r.approval_status)) return false;
      const ad = r.approval_date ? r.approval_date.substring(0, 10) : '';
      if (approvalFrom && (!ad || ad < approvalFrom)) return false;
      if (approvalTo && (!ad || ad > approvalTo)) return false;
      return true;
    });
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey] ?? '';
        const bv = b[sortKey] ?? '';
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    } else {
      rows = defaultSort(rows);
    }
    return rows;
  }, [records, search, companyFilter, positionFilter, managerFilter, locationFilter, medFilter, gpFilter, trainFilter, pidFilter, approvalFilter, approvalFrom, approvalTo, sortKey, sortDir]);

  // Preserve page across inline edits — only reset when filters/sort change.
  useEffect(() => { setPage(1); }, [hasFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sortedFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ── Mutations ──────────────────────────────────────────────────────────────────
  const empUpdate = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees-active'] }),
    onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
  });
  const recUpdate = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ApprovedRecord.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approvedRecords'] }),
    onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
  });

  const handleEmpSave = (empId, field, newValue) => {
    const emp = empMap.get(empId);
    const oldValue = emp ? emp[field] : undefined;
    empUpdate.mutate({ id: empId, data: { [field]: newValue } });
    base44.entities.ActivityLog.create({
      action: 'update', entity_name: 'Employee', entity_id: empId,
      performed_by: currentUser?.email || '', record_name: emp?.name || empId,
      changed_fields: [field], record_snapshot: { [field]: newValue, _old: { [field]: oldValue } },
    }).catch(() => {});
  };
  const handleRecSave = (recId, field, newValue) => {
    const rec = records.find(r => r.id === recId);
    const oldValue = rec ? rec[field] : undefined;
    recUpdate.mutate({ id: recId, data: { [field]: newValue } });
    base44.entities.ActivityLog.create({
      action: 'update', entity_name: 'ApprovedRecord', entity_id: recId,
      performed_by: currentUser?.email || '', record_name: rec?.full_name || recId,
      changed_fields: [field], record_snapshot: { [field]: newValue, _old: { [field]: oldValue } },
    }).catch(() => {});
  };

  const handleSaveForm = async (form) => {
    const isEdit = !!formInitial?.id;
    if (form.personnel_id && form.approval_date) {
      const dup = records.find(r => r.personnel_id === form.personnel_id && r.approval_date === form.approval_date && r.id !== formInitial?.id);
      if (dup) {
        toast({ title: 'Duplicate record', description: 'An approved record with this personnel and approval date already exists.', variant: 'destructive' });
        return;
      }
    }
    if (isEdit) {
      await base44.entities.ApprovedRecord.update(formInitial.id, form);
      base44.entities.ActivityLog.create({
        action: 'update', entity_name: 'ApprovedRecord', entity_id: formInitial.id,
        performed_by: currentUser?.email || '', record_name: form?.full_name || formInitial.id,
        changed_fields: Object.keys(form).filter(k => form[k] !== formInitial[k]),
        record_snapshot: { prev: formInitial, next: form },
      }).catch(() => {});
    } else {
      await base44.entities.ApprovedRecord.create(form);
      base44.entities.ActivityLog.create({
        action: 'create', entity_name: 'ApprovedRecord', entity_id: '',
        performed_by: currentUser?.email || '', record_name: form?.full_name || '',
        changed_fields: [], record_snapshot: form,
      }).catch(() => {});
    }
    queryClient.invalidateQueries({ queryKey: ['approvedRecords'] });
    setShowForm(false); setFormInitial(null);
  };

  const handleDelete = async (rec) => {
    await base44.entities.ApprovedRecord.delete(rec.id);
    base44.entities.ActivityLog.create({
      action: 'delete', entity_name: 'ApprovedRecord', entity_id: rec.id,
      performed_by: currentUser?.email || '', record_name: rec?.full_name || rec.id,
      changed_fields: [], record_snapshot: rec,
    }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['approvedRecords'] });
    toast({ title: 'Record deleted' });
  };

  const handleLink = (rec) => { setFormInitial(rec); setShowForm(true); };

  // ── Excel Export ───────────────────────────────────────────────────────────────
  const handleExcelExport = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Approved List', {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    const COL_HEADERS = ['#','Full Name','QID Number','PID No.','Mobile Number','Company','Designation / Position','Medical','Gate Pass Status','Training Status','Project ID Status','Approval Comments','Approval Date','Remarks'];
    ws.columns = [
      { key: 'no', width: 4 }, { key: 'name', width: 28 }, { key: 'qid', width: 14 },
      { key: 'pid', width: 12 }, { key: 'mobile', width: 14 }, { key: 'company', width: 18 },
      { key: 'position', width: 26 }, { key: 'medical', width: 14 },
      { key: 'gp', width: 14 }, { key: 'training', width: 14 }, { key: 'pidStatus', width: 16 },
      { key: 'approvalComments', width: 30 }, { key: 'approvalDate', width: 14 }, { key: 'remarks', width: 30 },
    ];
    const thin = { style: 'thin', color: { argb: 'FFCBD5E1' } };
    const applyBorder = (cell) => { cell.border = { top: thin, left: thin, bottom: thin, right: thin }; };
    const hdr = ws.getRow(1); hdr.height = 28;
    COL_HEADERS.forEach((h, i) => {
      const cell = hdr.getCell(i + 1); cell.value = h;
      const isPid = i === 10;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (isPid ? 'DDEFE0' : 'DCE6F2') } };
      cell.font = { color: { argb: 'FF' + (isPid ? '1A5C2A' : '2D3748') }, bold: true, size: 9 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      applyBorder(cell);
    });
    sortedFiltered.forEach((r, idx) => {
      const emp = empMap.get(r.personnel_id);
      const med = getMedStatus(r, emp), gp = getGPStatus(r, emp), tr = getTrainingStatus(r, emp), pid = getPIDStatus(r, emp);
      const row = ws.getRow(idx + 2); row.height = 18;
      const rowBg = idx % 2 === 0 ? 'FFFFFF' : 'F7F9FC';
      const plain = (col, value, align = 'center', wrap = false) => {
        const cell = row.getCell(col);
        cell.value = value ?? ''; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + rowBg } };
        cell.font = { size: 9 }; cell.alignment = { horizontal: align, vertical: 'middle', wrapText: wrap }; applyBorder(cell); return cell;
      };
      const badgeCell = (col, b, bgOverride) => {
        const cell = row.getCell(col);
        const c = EXCEL_COLOR_MAP[b.colorKey] || EXCEL_COLOR_MAP['badge-softgray'];
        cell.value = b.label; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (bgOverride || rowBg) } };
        cell.font = { color: { argb: 'FF' + c.fg }, bold: true, size: 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' }; applyBorder(cell);
        // overlay badge fill via separate cell not possible; use fill of badge color
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + c.bg } };
      };
      plain(1, idx + 1); plain(2, r.full_name || '—', 'left'); plain(3, r.qid_number || '—'); plain(4, r.pid_no || '—');
      plain(5, r.mobile_number || '—'); plain(6, r.company || '—'); plain(7, r.designation_position || '—', 'left', true);
      badgeCell(8, med); badgeCell(9, gp); badgeCell(10, tr); badgeCell(11, pid, 'F5FBF6');
      const ac = row.getCell(12); ac.value = r.approval_comments || ''; ac.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
      ac.font = { size: 9 }; ac.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }; applyBorder(ac);
      plain(13, fmtApprovalDate(r.approval_date));
      const rc = row.getCell(14); rc.value = r.remarks || ''; rc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
      rc.font = { size: 9 }; rc.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }; applyBorder(rc);
    });
    const buf = await wb.xlsx.writeBuffer();
    downloadBlob(buf, `Approved_List_${format(new Date(), 'yyyy-MM-dd')}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  // ── Print / PDF ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const applied = [
      search && `Search: "${search}"`,
      companyFilter.length && `Company: ${companyFilter.join(', ')}`,
      positionFilter.length && `Position: ${positionFilter.join(', ')}`,
      managerFilter.length && `Manager: ${managerFilter.join(', ')}`,
      locationFilter.length && `Location: ${locationFilter.join(', ')}`,
      medFilter.length && `Medical: ${medFilter.join(', ')}`,
      gpFilter.length && `Gate Pass: ${gpFilter.join(', ')}`,
      trainFilter.length && `Training: ${trainFilter.join(', ')}`,
      pidFilter.length && `Project ID: ${pidFilter.join(', ')}`,
      approvalFilter.length && `Approval: ${approvalFilter.join(', ')}`,
      (approvalFrom || approvalTo) && `Approval Date: ${approvalFrom || '…'} → ${approvalTo || '…'}`,
    ].filter(Boolean);
    const win = window.open('', '_blank', 'width=1400,height=900');
    const html = buildPrintHTML(sortedFiltered, empMap, applied);
    win.document.write(`<!DOCTYPE html><html><head><title>Approved Personnel List</title><style>${PRINT_CSS}</style></head><body>${html}<script>setTimeout(() => window.print(), 300);<\/script></body></html>`);
    win.document.close();
  };

  const today = format(new Date(), 'dd-MMM-yyyy');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Approved List</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{today} · {sortedFiltered.length} of {records.length} records · {records.filter(r => r.personnel_match_status === 'Matched').length} matched</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <Button variant={editMode ? 'default' : 'outline'} onClick={() => setEditMode(v => !v)} className="gap-2">
              {editMode ? <><X className="w-4 h-4" /> Exit Edit Mode</> : <><PencilLine className="w-4 h-4" /> Edit in Grid</>}
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" onClick={() => { setFormInitial(null); setShowForm(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> Add Record
            </Button>
          )}
          <Button variant="outline" onClick={handleExcelExport} className="gap-2" disabled={!sortedFiltered.length}>
            <Sheet className="w-4 h-4" /> Export Excel
          </Button>
          <Button onClick={handlePrint} className="gap-2" disabled={!sortedFiltered.length}>
            <FileText className="w-4 h-4" /> Print / PDF
          </Button>
          <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        search={search} setSearch={setSearch}
        companyOptions={companyOptions} companyFilter={companyFilter} setCompanyFilter={setCompanyFilter}
        positionOptions={positionOptions} positionFilter={positionFilter} setPositionFilter={setPositionFilter}
        managerOptions={managerOptions} managerFilter={managerFilter} setManagerFilter={setManagerFilter}
        locationOptions={locationOptions} locationFilter={locationFilter} setLocationFilter={setLocationFilter}
        medOptions={medOptions} medFilter={medFilter} setMedFilter={setMedFilter}
        gpOptions={gpOptions} gpFilter={gpFilter} setGpFilter={setGpFilter}
        trainOptions={trainOptions} trainFilter={trainFilter} setTrainFilter={setTrainFilter}
        pidOptions={pidOptions} pidFilter={pidFilter} setPidFilter={setPidFilter}
        approvalFilter={approvalFilter} setApprovalFilter={setApprovalFilter}
        approvalFrom={approvalFrom} setApprovalFrom={setApprovalFrom}
        approvalTo={approvalTo} setApprovalTo={setApprovalTo}
        hasFilter={hasFilter} clearFilters={clearFilters}
      />

      {/* Table — same layout system as Onboarding Monitoring */}
      <div className="rounded-b border border-t-0 overflow-x-auto table-scroll-x">
        <table className="w-full text-xs border-collapse" style={{ minWidth: 1300 }}>
          <thead className="sticky top-0 z-10">
            <tr>
              {HEADERS.map(([label, align, w, kind], i) => {
                const style = kind === 'pid' ? PID_HDR : COL_HDR;
                const sortable = i >= 1 && i <= 13;
                return (
                  <th key={label}
                    onClick={() => sortable && toggleSort(sortKeyFor(i))}
                    className={`border border-slate-300 px-2 py-1.5 font-semibold ${align === 'left' ? 'text-left' : 'text-center'} ${w} ${sortable ? 'cursor-pointer select-none hover:bg-blue-100' : ''}`}
                    style={style}>
                    <span className="inline-flex items-center gap-1">{label}
                      {sortable && sortKey === sortKeyFor(i) && (sortDir === 'asc' ? '▲' : '▼')}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={COL_SPAN} className="text-center py-10 text-slate-400 bg-white border">Loading…</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={COL_SPAN} className="text-center py-10 text-slate-400 bg-white border">No records found.</td></tr>
            ) : paged.map((r, idx) => {
              const emp = empMap.get(r.personnel_id);
              const med = getMedStatus(r, emp), gp = getGPStatus(r, emp), tr = getTrainingStatus(r, emp), pid = getPIDStatus(r, emp);
              const rowBg = idx % 2 === 0 ? '#ffffff' : '#F7F9FC';
              const editableId = r.id;
              const empId = r.personnel_id;
              return (
                <tr key={r.id} style={{ background: rowBg }}>
                  <td className="border border-slate-200 px-1 py-1 text-center text-slate-400">{(safePage - 1) * PAGE_SIZE + idx + 1}</td>
                  <td className="border border-slate-200 px-2 py-1 font-medium text-slate-800">{r.full_name || '—'}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center text-slate-600">{r.qid_number || '—'}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center text-slate-600">{r.pid_no || '—'}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center text-slate-600">{r.mobile_number || '—'}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center text-slate-700">{r.company || '—'}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center text-slate-700">{r.designation_position || '—'}</td>
                  {/* Medical */}
                  <td className="border border-slate-200 px-1 py-1 text-center">
                    {emp && editMode
                      ? <InlineEditCell value={emp.ftw_result} field="ftw_result" empId={empId} type="select" options={EMP_MEDICAL_OPTIONS} onSave={handleEmpSave} editMode={editMode} />
                      : <BadgeSpan colorKey={med.colorKey} label={med.label} />}
                  </td>

                  {/* Gate Pass Status */}
                  <td className="border border-slate-200 px-1 py-1 text-center">
                    {emp && editMode
                      ? <InlineEditCell value={emp.rlic_status} field="rlic_status" empId={empId} type="select" options={EMP_GP_OPTIONS} onSave={handleEmpSave} editMode={editMode} />
                      : <BadgeSpan colorKey={gp.colorKey} label={gp.label} />}
                  </td>

                  {/* Training Status */}
                  <td className="border border-slate-200 px-1 py-1 text-center">
                    {emp && editMode
                      ? <InlineEditCell value={emp.training_status} field="training_status" empId={empId} type="select" options={EMP_TRAINING_OPTIONS} onSave={handleEmpSave} editMode={editMode} />
                      : <BadgeSpan colorKey={tr.colorKey} label={tr.label} />}
                  </td>

                  {/* Project ID Status (green-tinted) */}
                  <td className="border border-slate-200 px-1 py-1 text-center" style={PID_CELL}>
                    {emp && editMode
                      ? <InlineEditCell value={emp.pid_status} field="pid_status" empId={empId} type="select" options={EMP_PID_OPTIONS} onSave={handleEmpSave} editMode={editMode} />
                      : <BadgeSpan colorKey={pid.colorKey} label={pid.label} />}
                  </td>
                  {/* Approval Comments */}
                  <td className="border border-slate-200 px-2 py-1 text-slate-600 text-[11px] min-w-[160px]" style={{ background: REMARKS_BG }}>
                    <InlineEditCell value={r.approval_comments} field="approval_comments" empId={editableId} type="text" onSave={handleRecSave} editMode={editMode} />
                  </td>
                  {/* Approval Date (DD/MM/YYYY) */}
                  <td className="border border-slate-200 px-2 py-1 text-center text-slate-600">
                    {editMode
                      ? <InlineEditCell value={r.approval_date} field="approval_date" empId={editableId} type="date" onSave={handleRecSave} editMode={editMode} />
                      : (r.approval_date ? fmtApprovalDate(r.approval_date) : <span className="text-slate-400">—</span>)}
                  </td>
                  {/* Remarks */}
                  <td className="border border-slate-200 px-2 py-1 text-slate-600 text-[11px] min-w-[140px]" style={{ background: REMARKS_BG }}>
                    <InlineEditCell value={r.remarks} field="remarks" empId={editableId} type="text" onSave={handleRecSave} editMode={editMode} />
                  </td>
                  {/* Actions */}
                  <td className="border border-slate-200 px-1 py-1 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-0.5">
                      {!r.personnel_id && canEdit && (
                        <button onClick={() => handleLink(r)} title="Link to personnel" className="p-1 hover:bg-blue-50 rounded text-blue-600"><Link2 className="w-3.5 h-3.5" /></button>
                      )}
                      <button onClick={() => { setFormInitial(r); setShowForm(true); }} title="Edit" className="p-1 hover:bg-slate-100 rounded"><PencilLine className="w-3.5 h-3.5" /></button>
                      {canDelete && (
                        <button onClick={() => handleDelete(r)} title="Delete" className="p-1 hover:bg-red-50 rounded text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination — matches Onboarding design */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-t-0 rounded-b text-xs text-slate-600">
          <span>Page {safePage} of {totalPages} · {sortedFiltered.length} total</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={safePage === 1} className="px-2 py-1 rounded border bg-white disabled:opacity-40 hover:bg-slate-100">«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="px-2 py-1 rounded border bg-white disabled:opacity-40 hover:bg-slate-100">‹</button>
            {pageButtons(safePage, totalPages).map((p, i) =>
              p === '...' ? <span key={`e-${i}`} className="px-1">…</span> : (
                <button key={p} onClick={() => setPage(p)}
                  style={safePage === p ? { background: '#1E3A5F', color: '#fff', border: '1px solid #1E3A5F' } : {}}
                  className={`px-2 py-1 rounded border ${safePage === p ? '' : 'bg-white hover:bg-slate-100'}`}
                >{p}</button>
              )
            )}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="px-2 py-1 rounded border bg-white disabled:opacity-40 hover:bg-slate-100">›</button>
            <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="px-2 py-1 rounded border bg-white disabled:opacity-40 hover:bg-slate-100">»</button>
          </div>
        </div>
      )}

      {showForm && (
        <ApprovedRecordForm
          open={showForm}
          onClose={() => { setShowForm(false); setFormInitial(null); }}
          onSave={handleSaveForm}
          employees={employees}
          initial={formInitial}
        />
      )}
    </div>
  );
}

function sortKeyFor(i) {
  const map = [null, 'full_name', 'qid_number', 'pid_no', 'mobile_number', 'company', 'designation_position',
    'medical', 'gate_pass_status', 'training_status', 'project_id_status', 'approval_comments', 'approval_date', 'remarks'];
  return map[i];
}

function pageButtons(current, total) {
  const out = [];
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || Math.abs(p - current) <= 2) out.push(p);
    else if (out[out.length - 1] !== '...') out.push('...');
  }
  return out;
}

function uniq(arr) {
  const seen = new Set(); const out = [];
  for (const v of arr) { const k = (v || '').toString().trim(); if (k && !seen.has(k)) { seen.add(k); out.push(k); } }
  return out.sort();
}
function downloadBlob(buf, name, type) {
  const blob = new Blob([buf], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

// ── Filter bar ─────────────────────────────────────────────────────────────────
function FilterBar(props) {
  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 max-w-xs">
          <Input value={props.search} onChange={e => props.setSearch(e.target.value)} placeholder="Search name, QID, PID, company, comments..." className="h-8 text-sm" />
        </div>
        {props.hasFilter && (
          <button onClick={props.clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2 rounded hover:bg-accent">
            <X className="w-3 h-3" /> Clear All
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <MultiSel label="Company" options={props.companyOptions} value={props.companyFilter} onChange={props.setCompanyFilter} />
        <MultiSel label="Designation" options={props.positionOptions} value={props.positionFilter} onChange={props.setPositionFilter} />
        <MultiSel label="Manager" options={props.managerOptions} value={props.managerFilter} onChange={props.setManagerFilter} />
        <MultiSel label="Work Location" options={props.locationOptions} value={props.locationFilter} onChange={props.setLocationFilter} />
        <MultiSel label="Medical" options={props.medOptions} value={props.medFilter} onChange={props.setMedFilter} />
        <MultiSel label="Gate Pass" options={props.gpOptions} value={props.gpFilter} onChange={props.setGpFilter} />
        <MultiSel label="Training" options={props.trainOptions} value={props.trainFilter} onChange={props.setTrainFilter} />
        <MultiSel label="Project ID" options={props.pidOptions} value={props.pidFilter} onChange={props.setPidFilter} />
        <MultiSel label="Approval Status" options={APPROVAL_STATUS_OPTIONS.map(o => o.value)} value={props.approvalFilter} onChange={props.setApprovalFilter} />
        <DateRange label="Approval Date" from={props.approvalFrom} to={props.approvalTo} setFrom={props.setApprovalFrom} setTo={props.setApprovalTo} />
      </div>
    </div>
  );
}

function MultiSel({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const opts = Array.isArray(options) ? options : [];
  return (
    <div className="relative">
      <p className="text-[11px] font-medium text-muted-foreground mb-1">{label}</p>
      <button onClick={() => setOpen(o => !o)} className="w-full h-8 text-left text-xs border rounded px-2 flex items-center justify-between hover:bg-accent">
        <span className={value.length ? 'text-foreground' : 'text-muted-foreground'}>{value.length ? `${value.length} selected` : 'All'}</span>
        <span className="text-muted-foreground">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white border rounded-md shadow-lg p-1">
            {opts.map(o => (
              <label key={o} className="flex items-center gap-1.5 px-2 py-1 text-xs hover:bg-accent rounded cursor-pointer">
                <input type="checkbox" checked={value.includes(o)} onChange={e => onChange(e.target.checked ? [...value, o] : value.filter(x => x !== o))} />
                <span className="truncate">{o || '—'}</span>
              </label>
            ))}
            {opts.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">No options</p>}
          </div>
        </>
      )}
    </div>
  );
}

function DateRange({ label, from, to, setFrom, setTo }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground mb-1">{label}</p>
      <div className="flex gap-1">
        <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 text-xs" />
        <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 text-xs" />
      </div>
    </div>
  );
}

// ── Print ───────────────────────────────────────────────────────────────────────
const PRINT_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
body { font-family: Arial, sans-serif; font-size: 9px; background: white; color: #1e293b; }
.wrap { padding: 12px; }
.title { font-size: 16px; font-weight: 700; text-transform: uppercase; }
.meta { font-size: 10px; color: #475569; text-align: right; }
.filters { font-size: 8.5px; color: #475569; margin: 6px 0; }
table { width: 100%; border-collapse: collapse; font-size: 8.5px; }
thead { display: table-header-group; }
th { background: #DCE6F2; color: #2D3748; border: 1px solid #B0C4DE; padding: 3px 2px; text-align: center; font-weight: 700; }
th.pid-col { background: #DDEFE0; color: #1A5C2A; }
tbody tr { page-break-inside: avoid; }
tr:nth-child(odd) td { background: #ffffff; }
tr:nth-child(even) td { background: #F7F9FC; }
td { border: 1px solid #CBD5E1; padding: 2px 3px; vertical-align: middle; }
td.center { text-align: center; }
td.pid-cell { background: #F5FBF6 !important; }
td.remarks-cell { background: #FAFAFA !important; }
.badge { display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 8px; font-weight: 600; border: 1px solid transparent; }
.badge-green  { background: #D6EFD8; color: #1A5C2A; border-color: #A8D5AC; }
.badge-amber  { background: #FEF3C7; color: #7C4D00; border-color: #F6D860; }
.badge-orange { background: #FDEBD0; color: #7B3500; border-color: #F5C59A; }
.badge-red    { background: #FCE4E4; color: #8B1A1A; border-color: #F5A9A9; }
.badge-blue   { background: #DBEAFE; color: #1E3A6E; border-color: #93C5FD; }
.badge-purple { background: #EDE9FE; color: #4B2A8A; border-color: #C4B5FD; }
.badge-slate  { background: #F1F5F9; color: #475569; border-color: #CBD5E1; }
@media print { @page { size: A3 landscape; margin: 6mm; } }
`;

function buildPrintHTML(rows, empMap, applied) {
  const notVal = v => v || '—';
  const now = format(new Date(), 'dd-MMM-yyyy HH:mm');
  const heads = ['#','Full Name','QID Number','PID No.','Mobile Number','Company','Designation / Position','Medical','Gate Pass Status','Training Status','Project ID Status','Approval Comments','Approval Date','Remarks'];
  const body = rows.map((r, i) => {
    const emp = empMap.get(r.personnel_id);
    const med = getMedStatus(r, emp), gp = getGPStatus(r, emp), tr = getTrainingStatus(r, emp), pid = getPIDStatus(r, emp);
    const badged = b => `<span class="badge ${PRINT_CLASS_MAP[b.colorKey] || 'badge-slate'}">${b.label}</span>`;
    return `<tr>
      <td class="center">${i+1}</td><td>${notVal(r.full_name)}</td><td class="center">${notVal(r.qid_number)}</td>
      <td class="center">${notVal(r.pid_no)}</td><td class="center">${notVal(r.mobile_number)}</td><td class="center">${notVal(r.company)}</td>
      <td class="center">${notVal(r.designation_position)}</td><td class="center">${badged(med)}</td>
      <td class="center">${badged(gp)}</td>
      <td class="center">${badged(tr)}</td>
      <td class="center pid-cell">${badged(pid)}</td>
      <td class="remarks-cell">${notVal(r.approval_comments)}</td>
      <td class="center">${r.approval_date ? fmtApprovalDate(r.approval_date) : '—'}</td>
      <td class="remarks-cell">${notVal(r.remarks)}</td></tr>`;
  }).join('');
  return `<div class="wrap">
    <table style="width:100%; margin-bottom:8px; border:none; border-collapse:collapse;">
      <tr><td style="border:none;" class="title">GSO QATAR — APPROVED PERSONNEL LIST</td>
          <td style="border:none;" class="meta">Generated: ${now} · Total: ${rows.length}</td></tr>
    </table>
    ${applied.length ? `<div class="filters"><strong>Filters:</strong> ${applied.join(' · ')}</div>` : ''}
    <table><thead><tr>${heads.map((h, i) => `<th class="${i === 10 ? 'pid-col' : ''}">${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>
  </div>`;
}