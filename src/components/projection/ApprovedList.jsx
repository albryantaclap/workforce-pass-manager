import React, { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PencilLine, X, FileText, Sheet, Plus, Trash2, Link2, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { usePermissions } from '@/lib/usePermissions';
import InlineEditCell from '@/components/common/InlineEditCell';
import {
  BadgeSpan, medBadge, gpBadge, trainBadge, pidBadge, approvalBadge, matchBadge, fmtDate,
  defaultSort, MEDICAL_OPTIONS, GP_OPTIONS, TRAINING_OPTIONS, PID_OPTIONS, APPROVAL_STATUS_OPTIONS,
} from './approvedListHelpers';
import ApprovedRecordForm from './ApprovedRecordForm';

const PAGE_SIZE = 25;
const COL_SPAN = 17;

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

  // Filter option lists derived from dataset
  const companyOptions = useMemo(() => uniq(records.map(r => r.company)), [records]);
  const positionOptions = useMemo(() => uniq(records.map(r => r.designation_position)), [records]);
  const managerOptions = useMemo(() => uniq(records.map(r => r.manager_assigned)), [records]);
  const locationOptions = useMemo(() => uniq(records.map(r => r.work_location)), [records]);
  const medOptions = useMemo(() => uniq(records.map(r => r.medical)), [records]);
  const gpOptions = useMemo(() => uniq(records.map(r => r.gate_pass_status)), [records]);
  const trainOptions = useMemo(() => uniq(records.map(r => r.training_status)), [records]);
  const pidOptions = useMemo(() => uniq(records.map(r => r.project_id_status)), [records]);

  const hasFilter = search || companyFilter.length || positionFilter.length || managerFilter.length ||
    locationFilter.length || medFilter.length || gpFilter.length || trainFilter.length ||
    pidFilter.length || approvalFilter.length || approvalFrom || approvalTo;

  const clearFilters = () => {
    setSearch(''); setCompanyFilter([]); setPositionFilter([]); setManagerFilter([]);
    setLocationFilter([]); setMedFilter([]); setGpFilter([]); setTrainFilter([]);
    setPidFilter([]); setApprovalFilter([]); setApprovalFrom(''); setApprovalTo('');
  };

  // Apply filters + sorting
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
        let cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    } else {
      rows = defaultSort(rows);
    }
    return rows;
  }, [records, search, companyFilter, positionFilter, managerFilter, locationFilter, medFilter, gpFilter, trainFilter, pidFilter, approvalFilter, approvalFrom, approvalTo, sortKey, sortDir]);

  useEffect(() => { setPage(1); }, [hasFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(sortedFiltered.length / PAGE_SIZE);
  const paged = sortedFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ApprovedRecord.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approvedRecords'] }),
    onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
  });

  const logActivity = (rec, action, changedFields, prev, next) =>
    base44.entities.ActivityLog.create({
      action,
      entity_name: 'ApprovedRecord',
      entity_id: rec?.id || '',
      performed_by: currentUser?.email || '',
      record_name: rec?.full_name || rec?.id || '',
      changed_fields: changedFields,
      record_snapshot: { prev, next },
    }).catch(() => {});

  const handleCellSave = (recId, field, newValue) => {
    const rec = records.find(r => r.id === recId);
    const oldValue = rec ? rec[field] : undefined;
    const next = { [field]: newValue };
    updateMutation.mutate({ id: recId, data: next });
    logActivity(rec, 'update', [field], { [field]: oldValue }, next);
  };

  const handleSaveForm = async (form) => {
    const isEdit = !!formInitial?.id;
    // Duplicate prevention: same personnel_id + approval_date
    if (form.personnel_id && form.approval_date) {
      const dup = records.find(r => r.personnel_id === form.personnel_id && r.approval_date === form.approval_date && r.id !== formInitial?.id);
      if (dup) {
        toast({ title: 'Duplicate record', description: 'An approved record with this personnel and approval date already exists.', variant: 'destructive' });
        return;
      }
    }
    if (isEdit) {
      await base44.entities.ApprovedRecord.update(formInitial.id, form);
      logActivity(formInitial, 'update', Object.keys(form).filter(k => form[k] !== formInitial[k]), formInitial, form);
    } else {
      await base44.entities.ApprovedRecord.create(form);
      logActivity(form, 'create', [], null, form);
    }
    queryClient.invalidateQueries({ queryKey: ['approvedRecords'] });
    setShowForm(false);
    setFormInitial(null);
  };

  const handleDelete = async (rec) => {
    await base44.entities.ApprovedRecord.delete(rec.id);
    logActivity(rec, 'delete', [], rec, null);
    queryClient.invalidateQueries({ queryKey: ['approvedRecords'] });
    toast({ title: 'Record deleted' });
  };

  const handleLink = (rec) => {
    setFormInitial(rec);
    setShowForm(true);
  };

  // ── Export Excel ───────────────────────────────────────────────────────────
  const handleExcelExport = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Approved List', {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    const HEADERS = ['#', 'Full Name', 'QID Number', 'PID No.', 'Mobile Number', 'Company', 'Designation / Position', 'Medical', 'Gate Pass Status', 'Training Status', 'Project ID Status', 'Manager Assigned', 'Work Location', 'Approval Comments', 'Approval Date', 'Remarks', 'Approval Status', 'Match'];
    ws.columns = HEADERS.map((h, i) => ({ key: 'c' + i, width: h.length < 8 ? 8 : Math.min(h.length + 4, 30) }));
    const hdr = ws.getRow(1);
    HEADERS.forEach((h, i) => {
      const c = hdr.getCell(i + 1);
      c.value = h; c.font = { bold: true, size: 9, color: { argb: 'FF2D3748' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F2' } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    sortedFiltered.forEach((r, idx) => {
      const row = ws.getRow(idx + 2);
      const vals = [
        idx + 1, r.full_name, r.qid_number, r.pid_no, r.mobile_number, r.company, r.designation_position,
        r.medical, r.gate_pass_status, r.training_status, r.project_id_status, r.manager_assigned, r.work_location,
        r.approval_comments, r.approval_date ? format(new Date(r.approval_date.substring(0, 10)), 'dd/MM/yyyy') : '',
        r.remarks, r.approval_status, r.personnel_match_status,
      ];
      vals.forEach((v, i) => {
        const c = row.getCell(i + 1);
        c.value = v || '';
        c.font = { size: 9 };
        c.alignment = { vertical: 'middle', wrapText: [13, 15].includes(i) };
        if ([7, 8, 9, 10, 16].includes(i) && v) {
          const b = [medBadge, gpBadge, trainBadge, pidBadge, approvalBadge][i === 16 ? 4 : i - 7](v);
          if (b) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + { green: 'D6EFD8', amber: 'FEF3C7', orange: 'FDEBD0', red: 'FCE4E4', blue: 'DBEAFE', purple: 'EDE9FE', slate: 'F1F5F9' }[b.color] } }; c.font = { size: 9, bold: true }; }
        }
      });
      row.height = 16;
    });
    const buf = await wb.xlsx.writeBuffer();
    downloadBlob(buf, `Approved_List_${format(new Date(), 'yyyy-MM-dd')}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  // ── Print / PDF ────────────────────────────────────────────────────────────
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
    const html = buildPrintHTML(sortedFiltered, applied);
    const win = window.open('', '_blank', 'width=1400,height=900');
    win.document.write(`<!DOCTYPE html><html><head><title>Approved Personnel List</title><style>${PRINT_CSS}</style></head><body>${html}<script>setTimeout(() => window.print(), 300);<\/script></body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Approved List</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {sortedFiltered.length} of {records.length} records · {records.filter(r => r.personnel_match_status === 'Matched').length} matched
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <Button variant={editMode ? 'default' : 'outline'} onClick={() => setEditMode(v => !v)} className="gap-2">
              {editMode ? <><X className="w-4 h-4" /> Exit Edit Mode</> : <><PencilLine className="w-4 h-4" /> Edit in Grid</>}
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" onClick={() => { setFormInitial(null); setShowForm(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> Add Approved Record
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

      {/* Table */}
      <div className="bg-white rounded-xl border shadow overflow-auto table-scroll-x" style={{ maxHeight: '70vh' }}>
        <table className="w-full border-collapse text-[11px] table-list-view">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/50">
              <Th onClick={() => toggleSort('serial_no')} sorted={sortKey === 'serial_no'} dir={sortDir}>#</Th>
              <Th onClick={() => toggleSort('full_name')} sorted={sortKey === 'full_name'} dir={sortDir}>Full Name</Th>
              <Th left onClick={() => toggleSort('qid_number')} sorted={sortKey === 'qid_number'} dir={sortDir}>QID Number</Th>
              <Th onClick={() => toggleSort('pid_no')} sorted={sortKey === 'pid_no'} dir={sortDir}>PID No.</Th>
              <Th>Mobile Number</Th>
              <Th onClick={() => toggleSort('company')} sorted={sortKey === 'company'} dir={sortDir}>Company</Th>
              <Th onClick={() => toggleSort('designation_position')} sorted={sortKey === 'designation_position'} dir={sortDir}>Designation / Position</Th>
              <Th>Medical</Th>
              <Th>Gate Pass Status</Th>
              <Th>Training Status</Th>
              <Th>Project ID Status</Th>
              <Th onClick={() => toggleSort('manager_assigned')} sorted={sortKey === 'manager_assigned'} dir={sortDir}>Manager Assigned</Th>
              <Th onClick={() => toggleSort('work_location')} sorted={sortKey === 'work_location'} dir={sortDir}>Work Location</Th>
              <Th>Approval Comments</Th>
              <Th onClick={() => toggleSort('approval_date')} sorted={sortKey === 'approval_date'} dir={sortDir}>Approval Date</Th>
              <Th>Remarks</Th>
              <Th onClick={() => toggleSort('approval_status')} sorted={sortKey === 'approval_status'} dir={sortDir}>Approval Status</Th>
              <Th>Match</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={COL_SPAN} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={COL_SPAN} className="text-center py-10 text-muted-foreground">No records found.</td></tr>
            ) : (
              paged.map((r, idx) => (
                <tr key={r.id} className={`hover:bg-muted/30 ${idx % 2 ? 'bg-slate-50/40' : 'bg-white'}`}>
                  <td className="border border-slate-200 px-1 py-1 text-center text-slate-400">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                  <td className="border border-slate-200 px-2 py-1 font-medium text-slate-800">{r.full_name || '—'}</td>
                  <td className="border border-slate-200 px-2 py-1 font-mono whitespace-nowrap">{r.qid_number || '—'}</td>
                  <td className="border border-slate-200 px-2 py-1 font-mono whitespace-nowrap">{r.pid_no || '—'}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center">{r.mobile_number || '—'}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center">{r.company || '—'}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center">{r.designation_position || '—'}</td>
                  <td className="border border-slate-200 px-1 py-1 text-center">{r.medical ? <BadgeSpan color={medBadge(r.medical)?.color} label={medBadge(r.medical)?.label} /> : '—'}</td>
                  <td className="border border-slate-200 px-1 py-1 text-center">{r.gate_pass_status ? <BadgeSpan color={gpBadge(r.gate_pass_status)?.color} label={gpBadge(r.gate_pass_status)?.label} /> : '—'}</td>
                  <td className="border border-slate-200 px-1 py-1 text-center">{r.training_status ? <BadgeSpan color={trainBadge(r.training_status)?.color} label={trainBadge(r.training_status)?.label} /> : '—'}</td>
                  <td className="border border-slate-200 px-1 py-1 text-center">{r.project_id_status ? <BadgeSpan color={pidBadge(r.project_id_status)?.color} label={pidBadge(r.project_id_status)?.label} /> : '—'}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center">{editMode ? <InlineEditCell value={r.manager_assigned} field="manager_assigned" empId={r.id} type="text" onSave={handleCellSave} editMode={editMode} /> : (r.manager_assigned || '—')}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center">{editMode ? <InlineEditCell value={r.work_location} field="work_location" empId={r.id} type="text" onSave={handleCellSave} editMode={editMode} /> : (r.work_location || '—')}</td>
                  <td className="border border-slate-200 px-2 py-1 text-left min-w-[160px]">{editMode ? <InlineEditCell value={r.approval_comments} field="approval_comments" empId={r.id} type="text" onSave={handleCellSave} editMode={editMode} /> : (r.approval_comments || '—')}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center whitespace-nowrap">{editMode ? <InlineEditCell value={r.approval_date} field="approval_date" empId={r.id} type="date" onSave={handleCellSave} editMode={editMode} /> : fmtDate(r.approval_date)}</td>
                  <td className="border border-slate-200 px-2 py-1 text-left min-w-[140px]">{editMode ? <InlineEditCell value={r.remarks} field="remarks" empId={r.id} type="text" onSave={handleCellSave} editMode={editMode} /> : (r.remarks || '—')}</td>
                  <td className="border border-slate-200 px-1 py-1 text-center">{editMode ? <InlineEditCell value={r.approval_status} field="approval_status" empId={r.id} type="select" options={APPROVAL_STATUS_OPTIONS} onSave={handleCellSave} editMode={editMode} /> : <BadgeSpan color={approvalBadge(r.approval_status).color} label={approvalBadge(r.approval_status).label} />}</td>
                  <td className="border border-slate-200 px-1 py-1 text-center"><BadgeSpan color={matchBadge(r.personnel_match_status).color} label={matchBadge(r.personnel_match_status).label} /></td>
                  <td className="border border-slate-200 px-1 py-1 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-0.5 flex-nowrap">
                      {!r.personnel_id && canEdit && (
                        <button onClick={() => handleLink(r)} title="Link to personnel" className="p-1 hover:bg-accent rounded text-blue-600"><Link2 className="w-3.5 h-3.5" /></button>
                      )}
                      <button onClick={() => { setFormInitial(r); setShowForm(true); }} title="Edit" className="p-1 hover:bg-accent rounded"><PencilLine className="w-3.5 h-3.5" /></button>
                      {canDelete && (
                        <button onClick={() => handleDelete(r)} title="Delete" className="p-1 hover:bg-red-50 rounded text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
          <span>Page {page} of {totalPages} · {sortedFiltered.length} total</span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => setPage(1)} disabled={page === 1}>«</Button>
            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</Button>
            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</Button>
            <Button size="sm" variant="outline" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</Button>
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

// ── Header cell with sort ───────────────────────────────────────────────────────
function Th({ children, onClick, sorted, dir, left }) {
  return (
    <th onClick={onClick} className={`border border-slate-200 px-2 py-1.5 font-semibold ${left ? 'text-left' : 'text-center'} cursor-pointer select-none hover:bg-slate-100`}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sorted && (dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </span>
    </th>
  );
}

// ── Filter bar ─────────────────────────────────────────────────────────────────
function FilterBar(props) {
  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Input value={props.search} onChange={e => props.setSearch(e.target.value)} placeholder="Search name, QID, PID, company, comments..." className="h-8 text-sm pl-3" />
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
  const opts = Array.isArray(options) && options.length && typeof options[0] === 'string' ? options : (Array.isArray(options) ? options.map(o => o.value || o) : []);
  return (
    <div className="relative">
      <p className="text-[11px] font-medium text-muted-foreground mb-1">{label}</p>
      <button onClick={() => setOpen(o => !o)} className="w-full h-8 text-left text-xs border rounded px-2 flex items-center justify-between hover:bg-accent">
        <span className={value.length ? 'text-foreground' : 'text-muted-foreground'}>{value.length ? `${value.length} selected` : 'All'}</span>
        <ChevronDown className="w-3 h-3" />
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

// ── Helpers ────────────────────────────────────────────────────────────────────
function uniq(arr) {
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    const k = (v || '').toString().trim();
    if (k && !seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out.sort();
}
function downloadBlob(buf, name, type) {
  const blob = new Blob([buf], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

// ── Print ───────────────────────────────────────────────────────────────────────
const PRINT_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
body { font-family: Arial, sans-serif; font-size: 8.5px; background: white; color: #1e293b; }
.wrap { padding: 12px; }
.title { text-align: center; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
.meta { text-align: center; font-size: 10px; color: #475569; margin: 4px 0 6px; }
.filters { font-size: 8.5px; color: #475569; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; font-size: 8px; }
thead th { background: #DCE6F2; color: #2D3748; border: 1px solid #B0C4DE; padding: 4px 3px; text-align: center; font-weight: 700; }
thead { display: table-header-group; }
tbody tr { page-break-inside: avoid; }
td { border: 1px solid #CBD5E1; padding: 2px 3px; vertical-align: middle; }
td.c { text-align: center; }
.badge { display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 7.5px; font-weight: 600; }
.b-green { background: #D6EFD8; color: #1A5C2A; } .b-amber { background: #FEF3C7; color: #7C4D00; }
.b-orange { background: #FDEBD0; color: #7B3500; } .b-red { background: #FCE4E4; color: #8B1A1A; }
.b-blue { background: #DBEAFE; color: #1E3A6E; } .b-purple { background: #EDE9FE; color: #4B2A8A; }
.b-slate { background: #F1F5F9; color: #475569; }
@media print { @page { size: A3 landscape; margin: 6mm; } }
`;

function buildPrintHTML(rows, applied) {
  const notVal = v => v || '—';
  const now = format(new Date(), 'dd/MM/yyyy HH:mm');
  const heads = ['#','Full Name','QID Number','PID No.','Mobile','Company','Designation / Position','Medical','Gate Pass','Training','Project ID','Manager','Work Location','Approval Comments','Approval Date','Remarks','Approval Status','Match'];
  const body = rows.map((r, i) => {
    const badged = (b) => b ? `<span class="badge b-${b.color}">${b.label}</span>` : '—';
    return `<tr>
      <td class="c">${i+1}</td><td>${notVal(r.full_name)}</td><td class="c">${notVal(r.qid_number)}</td>
      <td class="c">${notVal(r.pid_no)}</td><td class="c">${notVal(r.mobile_number)}</td><td class="c">${notVal(r.company)}</td>
      <td class="c">${notVal(r.designation_position)}</td><td class="c">${badged(medBadge(r.medical))}</td>
      <td class="c">${badged(gpBadge(r.gate_pass_status))}</td><td class="c">${badged(trainBadge(r.training_status))}</td>
      <td class="c">${badged(pidBadge(r.project_id_status))}</td><td class="c">${notVal(r.manager_assigned)}</td>
      <td class="c">${notVal(r.work_location)}</td><td>${notVal(r.approval_comments)}</td>
      <td class="c">${r.approval_date ? format(new Date(r.approval_date.substring(0,10)), 'dd/MM/yyyy') : '—'}</td>
      <td>${notVal(r.remarks)}</td><td class="c">${badged(approvalBadge(r.approval_status))}</td>
      <td class="c">${badged(matchBadge(r.personnel_match_status))}</td></tr>`;
  }).join('');
  return `<div class="wrap">
    <div class="title">GSO QATAR — APPROVED PERSONNEL LIST</div>
    <div class="meta">Generated: ${now} · Total filtered records: ${rows.length}</div>
    ${applied.length ? `<div class="filters"><strong>Filters:</strong> ${applied.join(' · ')}</div>` : ''}
    <table><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>
  </div>`;
}