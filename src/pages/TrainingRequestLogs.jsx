import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Search, ClipboardList, Printer, Download } from 'lucide-react';
import { formatDate } from '@/utils/constants';
import moment from 'moment';
import ExcelJS from 'exceljs';

const STATUS_OPTIONS = ['Booked', 'Submitted', 'Completed', 'Cancelled'];

const STATUS_COLORS = {
  Booked: 'bg-blue-50 text-blue-700',
  Submitted: 'bg-amber-50 text-amber-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-red-50 text-red-600',
};

export default function TrainingRequestLogs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['training-requests'],
    queryFn: () => base44.entities.TrainingRequest.list('-created_date', 10000),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, prevStatus }) => {
      await base44.entities.TrainingRequest.update(id, { status });

      // If cancelling, check if employee has other active bookings; if not, reset status
      if (status === 'Cancelled') {
        const record = logs.find(r => r.id === id);
        if (record?.employee_id) {
          const otherActive = logs.filter(r =>
            r.id !== id &&
            r.employee_id === record.employee_id &&
            r.status !== 'Cancelled'
          );
          if (otherActive.length === 0) {
            await base44.entities.Employee.update(record.employee_id, {
              training_status: 'PENDING',
              training_date_scheduled: null,
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-requests'] });
      queryClient.invalidateQueries({ queryKey: ['employees-active'] });
      toast({ title: 'Status updated' });
    }
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter(r => {
      const matchSearch = !q ||
        r.employee_name?.toLowerCase().includes(q) ||
        r.qid_no?.includes(q) ||
        r.company?.toLowerCase().includes(q) ||
        r.request_no?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const td = r.training_date || '';
      const matchFrom = !dateFrom || td >= dateFrom;
      const matchTo = !dateTo || td <= dateTo;
      return matchSearch && matchStatus && matchFrom && matchTo;
    });
  }, [logs, search, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handlePrint = () => {
    const rows = filtered.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.request_no || ''}</td>
        <td>${formatDate(r.request_date)}</td>
        <td>${r.requested_by_name || r.requested_by || ''}</td>
        <td>${r.employee_name || ''}</td>
        <td>${r.qid_no || ''}</td>
        <td>${r.company || ''}</td>
        <td>${r.designation || ''}</td>
        <td>${formatDate(r.training_date)}</td>
        <td>${r.language || ''}</td>
        <td>${r.overall_size || ''}</td>
        <td>${r.shoes_size || ''}</td>
        <td>${r.remarks || ''}</td>
        <td>${r.status || ''}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><title>Training Request Logs</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 10px; margin: 20px; }
      h2 { text-align: center; background: #f4a460; padding: 8px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
      th { background: #2c3e7b; color: white; font-size: 9px; }
      tr:nth-child(even) { background: #f9f9f9; }
      @media print { button { display: none; } }
    </style></head><body>
    <h2>TRAINING REQUEST LOGS</h2>
    <table>
      <thead><tr>
        <th>#</th><th>Request No</th><th>Request Date</th><th>Requested By</th>
        <th>Employee Name</th><th>QID</th><th>Company</th><th>Designation</th>
        <th>Training Date</th><th>Language</th><th>Overall</th><th>Shoes</th><th>Remarks</th><th>Status</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <script>window.print();</script>
    </body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  const handleExport = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Training Request Logs');

    ws.mergeCells('A1:N1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'TRAINING REQUEST LOGS';
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4A460' } };

    const headers = ['#', 'Request No', 'Request Date', 'Requested By', 'Employee Name', 'QID', 'Company', 'Designation', 'Training Date', 'Language', 'Overall Size', 'Shoes Size', 'Remarks', 'Status'];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E7B' } };
      cell.alignment = { horizontal: 'center' };
    });

    filtered.forEach((r, i) => {
      ws.addRow([
        i + 1, r.request_no || '', formatDate(r.request_date),
        r.requested_by_name || r.requested_by || '', r.employee_name || '',
        r.qid_no || '', r.company || '', r.designation || '',
        formatDate(r.training_date), r.language || '',
        r.overall_size || '', r.shoes_size || '', r.remarks || '', r.status || ''
      ]);
    });

    ws.columns = [
      { width: 5 }, { width: 22 }, { width: 14 }, { width: 20 }, { width: 26 },
      { width: 16 }, { width: 18 }, { width: 20 }, { width: 14 }, { width: 12 },
      { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training_request_logs_${moment().format('YYYYMMDD')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group by request_no for display
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      if (!map[r.request_no]) map[r.request_no] = [];
      map[r.request_no].push(r);
    });
    return map;
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Training Request Logs</h2>
            <p className="text-sm text-muted-foreground">History of all training bookings</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handlePrint}><Printer className="w-3.5 h-3.5 mr-1.5" />Print</Button>
          <Button size="sm" variant="outline" onClick={handleExport}><Download className="w-3.5 h-3.5 mr-1.5" />Export Excel</Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search name, QID, company, request no..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-8 text-xs" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">Training Date:</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs border border-input rounded-md px-2" />
            <span className="text-xs text-muted-foreground">—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs border border-input rounded-md px-2" />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="table-scroll-x">
          <div className="table-scroll-y" style={{ maxHeight: 560 }}>
            <Table className="table-list-view">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-muted/50">
                  <TableHead className="bg-muted/50">Request No</TableHead>
                  <TableHead className="bg-muted/50">Request Date</TableHead>
                  <TableHead className="bg-muted/50">Requested By</TableHead>
                  <TableHead className="bg-muted/50">Employee Name</TableHead>
                  <TableHead className="bg-muted/50">QID</TableHead>
                  <TableHead className="bg-muted/50">Company</TableHead>
                  <TableHead className="bg-muted/50">Designation</TableHead>
                  <TableHead className="bg-muted/50">Training Date</TableHead>
                  <TableHead className="bg-muted/50">Language</TableHead>
                  <TableHead className="bg-muted/50">Overall</TableHead>
                  <TableHead className="bg-muted/50">Shoes</TableHead>
                  <TableHead className="bg-muted/50">Remarks</TableHead>
                  <TableHead className="bg-muted/50">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={13} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : pagedRows.length === 0 ? (
                  <TableRow><TableCell colSpan={13} className="text-center py-10 text-muted-foreground">No training requests found</TableCell></TableRow>
                ) : pagedRows.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs font-mono">{r.request_no}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(r.request_date)}</TableCell>
                    <TableCell className="text-xs">{r.requested_by_name || r.requested_by}</TableCell>
                    <TableCell className="text-xs font-medium">{r.employee_name}</TableCell>
                    <TableCell className="text-xs font-mono">{r.qid_no}</TableCell>
                    <TableCell className="text-xs">{r.company}</TableCell>
                    <TableCell className="text-xs">{r.designation}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(r.training_date)}</TableCell>
                    <TableCell className="text-xs">{r.language}</TableCell>
                    <TableCell className="text-xs">{r.overall_size}</TableCell>
                    <TableCell className="text-xs">{r.shoes_size}</TableCell>
                    <TableCell className="text-xs">{r.remarks}</TableCell>
                    <TableCell>
                      <Select value={r.status || 'Booked'} onValueChange={v => updateStatus.mutate({ id: r.id, status: v, prevStatus: r.status })}>
                        <SelectTrigger className={`h-6 text-[10px] font-semibold px-2 border-0 rounded-full w-28 ${STATUS_COLORS[r.status] || 'bg-muted text-muted-foreground'}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="px-4 py-2 border-t bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground">
            Showing <strong>{Math.min(page * PAGE_SIZE + 1, filtered.length)}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)}</strong> of <strong>{filtered.length}</strong> · <strong>{logs.length}</strong> total
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
    </div>
  );
}