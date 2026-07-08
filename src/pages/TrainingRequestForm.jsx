import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Search, FileText, Printer, Download, X, Plus, PencilLine } from 'lucide-react';
import { computePassStatus, formatDate } from '@/utils/constants';
import moment from 'moment';
import ExcelJS from 'exceljs';

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const LANG_OPTIONS = ['ENGLISH', 'HINDI', 'ARABIC', 'OTHER'];

const TRAINING_STATUS_STYLES = {
  'DONE':             'bg-emerald-50 text-emerald-700',
  'SCHEDULED':        'bg-blue-50 text-blue-700',
  'ON-GOING':         'bg-violet-50 text-violet-700',
  'TO BE SCHEDULED':  'bg-amber-50 text-amber-700',
  'PENDING':          'bg-slate-100 text-slate-600',
  'NOT REQUIRED':     'bg-gray-100 text-gray-500',
};

export default function TrainingRequestForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({}); // { empId: { language, remarks, overall_size, shoes_size } }
  const [trainingDate, setTrainingDate] = useState('');
  const [gridEdit, setGridEdit] = useState(false);
  const [gridEdits, setGridEdits] = useState({});

  const setGridField = (empId, field, value) =>
    setGridEdits(prev => ({ ...prev, [empId]: { ...(prev[empId] || {}), [field]: value } }));

  const saveGridField = async (empId, field, value) => {
    await base44.entities.Employee.update(empId, { [field]: value });
    queryClient.invalidateQueries({ queryKey: ['employees-active'] });
  };

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, 'name', 10000),
  });

  const { data: existingRequests = [] } = useQuery({
    queryKey: ['training-requests'],
    queryFn: () => base44.entities.TrainingRequest.list('-created_date', 10000),
  });

  // Eligible: Medical ACCEPTED + Gate Pass VALID or SOON TO EXPIRE + Training NOT DONE
  const eligible = useMemo(() => {
    return employees.filter(e => {
      const medical = (e.ftw_result || '').toUpperCase();
      const rlic = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
      const training = (e.training_status || '').toUpperCase();
      return (
        medical === 'ACCEPTED' &&
        (rlic === 'VALID RLIC PASS' || rlic === 'SOON TO EXPIRE') &&
        training !== 'DONE'
      );
    });
  }, [employees]);

  // Already booked employee IDs for the same training date (prevent duplicate)
  const bookedForDate = useMemo(() => {
    if (!trainingDate) return new Set();
    return new Set(
      existingRequests
        .filter(r => r.training_date === trainingDate && r.status !== 'Cancelled')
        .map(r => r.employee_id)
    );
  }, [existingRequests, trainingDate]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return eligible.filter(e =>
      !q || e.name?.toLowerCase().includes(q) || e.qid_no?.includes(q) || e.company?.toLowerCase().includes(q)
    );
  }, [eligible, search]);

  const selectedList = useMemo(() =>
    eligible.filter(e => selected[e.id]),
    [eligible, selected]
  );

  const toggleSelect = (emp) => {
    setSelected(prev => {
      if (prev[emp.id]) {
        const next = { ...prev };
        delete next[emp.id];
        return next;
      }
      return {
        ...prev,
        [emp.id]: {
          language: 'HINDI',
          remarks: 'BOOKED',
          overall_size: '',
          shoes_size: '',
        }
      };
    });
  };

  const updateField = (empId, field, value) => {
    setSelected(prev => ({
      ...prev,
      [empId]: { ...prev[empId], [field]: value }
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!trainingDate) throw new Error('Please set a Training Date first.');
      if (selectedList.length === 0) throw new Error('Please select at least one employee.');

      // Duplicate check
      const dups = selectedList.filter(e => bookedForDate.has(e.id));
      if (dups.length > 0) {
        throw new Error(`Already booked for this date: ${dups.map(e => e.name).join(', ')}`);
      }

      const requestDate = moment().format('YYYY-MM-DD');
      const requestNo = `TRQ-${moment().format('YYYYMMDD-HHmm')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      const records = selectedList.map(emp => ({
        request_no: requestNo,
        request_date: requestDate,
        requested_by: currentUser?.email || '',
        requested_by_name: currentUser?.full_name || '',
        training_date: trainingDate,
        employee_id: emp.id,
        employee_name: emp.name,
        company: emp.company || '',
        qid_no: emp.qid_no || '',
        nationality: emp.nationality || '',
        designation: emp.designation_org_chart || '',
        language: selected[emp.id]?.language || 'HINDI',
        remarks: selected[emp.id]?.remarks || 'BOOKED',
        overall_size: selected[emp.id]?.overall_size || '',
        shoes_size: selected[emp.id]?.shoes_size || '',
        status: 'Booked',
      }));

      await base44.entities.TrainingRequest.bulkCreate(records);

      // Update each employee's training_status to SCHEDULED and set scheduled date
      for (const emp of selectedList) {
        if (emp.training_status !== 'DONE') {
          await base44.entities.Employee.update(emp.id, {
            training_status: 'SCHEDULED',
            training_date_scheduled: trainingDate,
          });
        }
      }

      return records;
    },
    onSuccess: (records) => {
      queryClient.invalidateQueries({ queryKey: ['training-requests'] });
      queryClient.invalidateQueries({ queryKey: ['employees-active'] });
      toast({ title: `${records.length} booking(s) saved successfully.` });
      setSelected({});
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const handlePrint = () => {
    if (!trainingDate || selectedList.length === 0) {
      toast({ title: 'Select employees and set training date first.', variant: 'destructive' });
      return;
    }
    const formattedDate = moment(trainingDate).format('DD-MMM-YYYY');
    const rows = selectedList.map((emp, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td style="text-align:left">${emp.name}</td>
        <td style="text-align:left">${emp.company || ''}</td>
        <td style="text-align:center">${emp.qid_no || ''}</td>
        <td style="text-align:center">${emp.nationality || ''}</td>
        <td style="text-align:left">${emp.designation_org_chart || ''}</td>
        <td style="text-align:center">${selected[emp.id]?.language || 'HINDI'}</td>
        <td style="text-align:center">${formattedDate}</td>
        <td style="text-align:center;color:#F4A259;font-weight:bold">${selected[emp.id]?.remarks || 'BOOKED'}</td>
        <td style="text-align:center">${selected[emp.id]?.overall_size || ''}</td>
        <td style="text-align:center">${selected[emp.id]?.shoes_size || ''}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html><head><title>Training Request Form</title>
<style>
  @page { size: A4 landscape; margin: 10mm 8mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 0; background: #fff; }
  .title-bar {
    background: #F4A259;
    text-align: center;
    padding: 10px 0;
    font-size: 22px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #000;
    margin-bottom: 6px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  col.sr    { width: 4%; }
  col.name  { width: 14%; }
  col.comp  { width: 10%; }
  col.qid   { width: 10%; }
  col.nat   { width: 9%; }
  col.desig { width: 13%; }
  col.lang  { width: 11%; }
  col.date  { width: 8%; }
  col.rem   { width: 8%; }
  col.over  { width: 7%; }
  col.shoes { width: 6%; }
  th {
    background: #1e3a6e;
    color: #ffffff;
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
    text-align: center;
    vertical-align: middle;
    padding: 6px 4px;
    border: 1px solid #ccc;
  }
  td {
    font-size: 11px;
    vertical-align: middle;
    padding: 5px 4px;
    border: 1px solid #d0d0d0;
    color: #000;
    word-break: break-word;
  }
  tr:nth-child(even) td { background: #f9f9f9; }
  tr:nth-child(odd) td { background: #ffffff; }
  @media print {
    .title-bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    thead { display: table-header-group; }
    .title-bar { page-break-inside: avoid; }
  }
</style>
</head><body>
<div class="title-bar">TRAINING REQUEST FORM</div>
<table>
  <colgroup>
    <col class="sr"/><col class="name"/><col class="comp"/><col class="qid"/>
    <col class="nat"/><col class="desig"/><col class="lang"/><col class="date"/>
    <col class="rem"/><col class="over"/><col class="shoes"/>
  </colgroup>
  <thead>
    <tr>
      <th>SR.No</th>
      <th>EMPLOYEE NAME</th>
      <th>COMPANY</th>
      <th>QID</th>
      <th>NATIONALITY</th>
      <th>DESIGNATION</th>
      <th>LANGUAGE<br/>ENGLISH/HINDI</th>
      <th>Date</th>
      <th>REMARKS</th>
      <th>Overall<br/>Size</th>
      <th>Shoes<br/>Size</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<script>window.onload = function(){ window.print(); }</script>
</body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  const handleExport = async () => {
    if (!trainingDate || selectedList.length === 0) {
      toast({ title: 'Select employees and set training date first.', variant: 'destructive' });
      return;
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Training Request Form');

    ws.mergeCells('A1:K1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'TRAINING REQUEST FORM';
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4A460' } };

    const headers = ['SR.No', 'EMPLOYEE NAME', 'COMPANY', 'QID', 'NATIONALITY', 'DESIGNATION', 'LANGUAGE ENGLISH/HINDI', 'Date', 'REMARKS', 'Overall Size', 'Shoes Size'];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E7B' } };
      cell.alignment = { horizontal: 'center' };
    });

    selectedList.forEach((emp, i) => {
      ws.addRow([
        i + 1,
        emp.name,
        emp.company || '',
        emp.qid_no || '',
        emp.nationality || '',
        emp.designation_org_chart || '',
        selected[emp.id]?.language || 'HINDI',
        moment(trainingDate).format('DD-MMM-YY'),
        selected[emp.id]?.remarks || 'BOOKED',
        selected[emp.id]?.overall_size || '',
        selected[emp.id]?.shoes_size || '',
      ]);
    });

    ws.columns = [
      { width: 7 }, { width: 28 }, { width: 18 }, { width: 16 }, { width: 14 },
      { width: 20 }, { width: 22 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 12 }
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training_request_${trainingDate}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Training Request Form</h2>
          <p className="text-sm text-muted-foreground">Select eligible personnel and book training</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Training Date *</label>
            <input type="date" value={trainingDate} onChange={e => setTrainingDate(e.target.value)} className="h-8 text-xs border border-input rounded-md px-2" />
          </div>
          <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="w-3.5 h-3.5 mr-1.5" />Print</Button>
          <Button size="sm" variant="outline" onClick={handleExport}><Download className="w-3.5 h-3.5 mr-1.5" />Export Excel</Button>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || selectedList.length === 0 || !trainingDate}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            {saveMutation.isPending ? 'Saving...' : `Book ${selectedList.length > 0 ? `(${selectedList.length})` : ''}`}
          </Button>
        </div>
      </div>

      {/* Selected preview */}
      {selectedList.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 text-primary flex items-center gap-2">
            <FileText className="w-4 h-4" /> Selected for Booking ({selectedList.length})
          </h3>
          <div className="table-scroll-x">
            <Table className="table-list-view">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="bg-muted/50">SR.No</TableHead>
                  <TableHead className="bg-muted/50">Employee Name</TableHead>
                  <TableHead className="bg-muted/50">Company</TableHead>
                  <TableHead className="bg-muted/50">QID</TableHead>
                  <TableHead className="bg-muted/50">Nationality</TableHead>
                  <TableHead className="bg-muted/50">Designation</TableHead>
                  <TableHead className="bg-muted/50">Language</TableHead>
                  <TableHead className="bg-muted/50">Remarks</TableHead>
                  <TableHead className="bg-muted/50">Overall Size</TableHead>
                  <TableHead className="bg-muted/50">Shoes Size</TableHead>
                  <TableHead className="bg-muted/50"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedList.map((emp, i) => (
                  <TableRow key={emp.id}>
                    <TableCell className="text-xs">{i + 1}</TableCell>
                    <TableCell className="text-xs font-medium">{emp.name}</TableCell>
                    <TableCell className="text-xs">{emp.company}</TableCell>
                    <TableCell className="text-xs font-mono">{emp.qid_no}</TableCell>
                    <TableCell className="text-xs">{emp.nationality}</TableCell>
                    <TableCell className="text-xs">{emp.designation_org_chart}</TableCell>
                    <TableCell>
                      <Select value={selected[emp.id]?.language || 'HINDI'} onValueChange={v => updateField(emp.id, 'language', v)}>
                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>{LANG_OPTIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input value={selected[emp.id]?.remarks || 'BOOKED'} onChange={e => updateField(emp.id, 'remarks', e.target.value.toUpperCase())} className="h-7 text-xs w-24" />
                    </TableCell>
                    <TableCell>
                      <Select value={selected[emp.id]?.overall_size || ''} onValueChange={v => updateField(emp.id, 'overall_size', v)}>
                        <SelectTrigger className="h-7 text-xs w-20"><SelectValue placeholder="Size" /></SelectTrigger>
                        <SelectContent>{SIZE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input value={selected[emp.id]?.shoes_size || ''} onChange={e => updateField(emp.id, 'shoes_size', e.target.value)} placeholder="e.g. 42" className="h-7 text-xs w-20" />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleSelect(emp)}><X className="w-3.5 h-3.5 text-red-500" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Eligible employees list */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Eligible Personnel — Medical Accepted + Valid/Soon Gate Pass + Not Done Training ({eligible.length})
          </h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search name, QID, company..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-xs" />
          </div>
          <Button size="sm" variant={gridEdit ? 'default' : 'outline'} onClick={() => { setGridEdit(g => !g); setGridEdits({}); }}>
            <PencilLine className="w-3.5 h-3.5 mr-1.5" />{gridEdit ? 'Done Editing' : 'Edit in Grid'}
          </Button>
        </div>
        <div className="table-scroll-x">
          <div className="table-scroll-y" style={{ maxHeight: 420 }}>
            <Table className="table-list-view">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-muted/50">
                  <TableHead className="bg-muted/50 w-10"></TableHead>
                  <TableHead className="bg-muted/50">Name</TableHead>
                  <TableHead className="bg-muted/50">Company</TableHead>
                  <TableHead className="bg-muted/50">QID</TableHead>
                  <TableHead className="bg-muted/50">Nationality</TableHead>
                  <TableHead className="bg-muted/50">Designation</TableHead>
                  <TableHead className="bg-muted/50">Medical</TableHead>
                  <TableHead className="bg-muted/50">Gate Pass</TableHead>
                  <TableHead className="bg-muted/50">Training Status</TableHead>
                  <TableHead className="bg-muted/50">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No eligible personnel found</TableCell></TableRow>
                ) : filtered.map(emp => {
                  const isAlreadyBooked = trainingDate && bookedForDate.has(emp.id);
                  const isChecked = !!selected[emp.id];
                  return (
                    <TableRow key={emp.id} className={isAlreadyBooked ? 'opacity-40' : 'hover:bg-muted/30 cursor-pointer'} onClick={() => !isAlreadyBooked && toggleSelect(emp)}>
                      <TableCell className="p-2" onClick={e => e.stopPropagation()}>
                        <Checkbox checked={isChecked} disabled={isAlreadyBooked} onCheckedChange={() => !isAlreadyBooked && toggleSelect(emp)} />
                      </TableCell>
                      <TableCell className="text-xs font-medium">{emp.name}</TableCell>
                      <TableCell className="text-xs">{emp.company}</TableCell>
                      <TableCell className="text-xs font-mono">{emp.qid_no}</TableCell>
                      <TableCell className="text-xs">{emp.nationality}</TableCell>
                      <TableCell className="text-xs">{emp.designation_org_chart}</TableCell>
                      <TableCell><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{emp.ftw_result}</span></TableCell>
                      <TableCell><span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status)}</span></TableCell>
                      <TableCell>
                      {isAlreadyBooked
                        ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Already Booked</span>
                        : gridEdit
                          ? <Select value={gridEdits[emp.id]?.training_status ?? (emp.training_status || '')}
                              onValueChange={v => { setGridField(emp.id, 'training_status', v); saveGridField(emp.id, 'training_status', v); }}>
                              <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                              <SelectContent>{Object.keys(TRAINING_STATUS_STYLES).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                          : <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TRAINING_STATUS_STYLES[(emp.training_status || '').toUpperCase()] || 'bg-slate-100 text-slate-600'}`}>{emp.training_status || '—'}</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                       {gridEdit
                         ? <Input className="h-7 text-xs w-36"
                             defaultValue={emp.remarks || ''}
                             onBlur={e => saveGridField(emp.id, 'remarks', e.target.value)} />
                         : emp.remarks || '—'}
                      </TableCell>
                      </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>
    </div>
  );
}