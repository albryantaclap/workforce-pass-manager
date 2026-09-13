import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { formatTime, formatDateOnly, formatDuration } from '@/lib/attendanceUtils';

export default function AttendanceHistoryDialog({ open, emp, canCorrect, onCorrect, onClose }) {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['camp-stays-history', emp?.id],
    queryFn: () => base44.entities.ComoCampStay.filter({ personnel_id: emp.id, is_deleted: { $ne: true } }, '-stay_date', 100000),
    enabled: open && !!emp,
  });

  if (!emp) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Camp Stay History — {emp.name}</DialogTitle>
          <DialogDescription>{isLoading ? 'Loading…' : `${records.length} camp stay(s) on record. Historical records are never overwritten.`}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto table-scroll-y">
          <Table className="table-list-view">
            <TableHeader className="sticky top-0">
              <TableRow className="bg-muted/50">
                <TableHead className="bg-muted/50">Date</TableHead>
                <TableHead className="bg-muted/50">Camp Check-in</TableHead>
                <TableHead className="bg-muted/50">Camp Check-out</TableHead>
                <TableHead className="bg-muted/50">Stay Duration</TableHead>
                <TableHead className="bg-muted/50">Work Location</TableHead>
                <TableHead className="bg-muted/50">Checked-in By</TableHead>
                <TableHead className="bg-muted/50">Checked-out By</TableHead>
                {canCorrect && <TableHead className="bg-muted/50 text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>{Array(canCorrect ? 8 : 7).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : records.length === 0 ? (
                <TableRow><TableCell colSpan={canCorrect ? 8 : 7} className="text-center py-8 text-muted-foreground">No camp stay records yet.</TableCell></TableRow>
              ) : (
                records.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDateOnly(r.stay_date || r.check_in_at)}</TableCell>
                    <TableCell className="font-mono">{formatTime(r.check_in_at)}</TableCell>
                    <TableCell className="font-mono">{formatTime(r.check_out_at)}</TableCell>
                    <TableCell>{r.check_out_at ? formatDuration(r.duration_minutes) : '—'}</TableCell>
                    <TableCell className="uppercase">{r.work_location || '—'}</TableCell>
                    <TableCell className="uppercase">{r.checked_in_by_name || r.checked_in_by || '—'}</TableCell>
                    <TableCell className="uppercase">{r.checked_out_by_name || r.checked_out_by || '—'}</TableCell>
                    {canCorrect && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onCorrect(r, emp)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}