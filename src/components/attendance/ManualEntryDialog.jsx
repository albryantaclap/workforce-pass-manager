import React, { useState, useEffect, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import PersonnelAvatar from '@/components/common/PersonnelAvatar';
import { toDateStr, toTimeStr, buildDateTime } from '@/lib/attendanceUtils';
import { saveManualEntry } from '@/lib/attendanceService';
import { resolveShift } from '@/lib/attendanceEngine';

export default function ManualEntryDialog({
  open, onClose, employees, settings, shifts, assignments,
  selectedDate, editRecord, onSaved,
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [date, setDate] = useState(selectedDate || '');
  const [firstInDate, setFirstInDate] = useState('');
  const [firstInTime, setFirstInTime] = useState('');
  const [firstOutDate, setFirstOutDate] = useState('');
  const [firstOutTime, setFirstOutTime] = useState('');
  const [secondInDate, setSecondInDate] = useState('');
  const [secondInTime, setSecondInTime] = useState('');
  const [finalOutDate, setFinalOutDate] = useState('');
  const [finalOutTime, setFinalOutTime] = useState('');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  // Pre-fill when editing
  useEffect(() => {
    if (editRecord) {
      const emp = employees.find(e => e.id === editRecord.personnel_id);
      setSelectedEmp(emp || { id: editRecord.personnel_id, name: editRecord.employee_name, company: editRecord.company });
      setDate(editRecord.attendance_date || selectedDate || '');
      setFirstInDate(toDateStr(editRecord.first_in_at));
      setFirstInTime(toTimeStr(editRecord.first_in_at));
      setFirstOutDate(toDateStr(editRecord.first_out_at));
      setFirstOutTime(toTimeStr(editRecord.first_out_at));
      setSecondInDate(toDateStr(editRecord.second_in_at));
      setSecondInTime(toTimeStr(editRecord.second_in_at));
      setFinalOutDate(toDateStr(editRecord.final_out_at));
      setFinalOutTime(toTimeStr(editRecord.final_out_at));
      setReason(editRecord.manual_reason || '');
      setRemarks(editRecord.remarks || '');
    } else {
      setSelectedEmp(null);
      setDate(selectedDate || '');
      setFirstInDate(''); setFirstInTime('');
      setFirstOutDate(''); setFirstOutTime('');
      setSecondInDate(''); setSecondInTime('');
      setFinalOutDate(''); setFinalOutTime('');
      setReason(''); setRemarks('');
    }
  }, [editRecord, selectedDate, employees]);

  const filteredEmps = useMemo(() => {
    if (!empSearch) return employees.slice(0, 20);
    const q = empSearch.toLowerCase();
    return employees.filter(e => `${e.name} ${e.qid_no || ''} ${e.pid || ''}`.toLowerCase().includes(q)).slice(0, 20);
  }, [employees, empSearch]);

  const handleSave = async () => {
    if (!selectedEmp) { toast({ title: 'Please select an employee.', variant: 'destructive' }); return; }
    if (!date) { toast({ title: 'Please select an attendance date.', variant: 'destructive' }); return; }
    if (!reason.trim()) { toast({ title: 'A reason is required for manual entry.', variant: 'destructive' }); return; }

    const firstIn = buildDateTime(firstInDate, firstInTime);
    const firstOut = buildDateTime(firstOutDate, firstOutTime);
    const secondIn = buildDateTime(secondInDate, secondInTime);
    const finalOut = buildDateTime(finalOutDate, finalOutTime);

    // Validation: first in must exist if any other punch exists
    if (!firstIn && (firstOut || secondIn || finalOut)) {
      toast({ title: 'First Clock In is required when other punches are provided.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const shift = resolveShift(selectedEmp, assignments || [], shifts || [], settings);
      await saveManualEntry({
        personnelId: selectedEmp.id,
        employeeName: selectedEmp.name,
        company: selectedEmp.company,
        attendanceDate: date,
        firstInAt: firstIn, firstOutAt: firstOut,
        secondInAt: secondIn, finalOutAt: finalOut,
        reason, remarks,
        workLocation: selectedEmp.current_location || '',
        currentUser: user,
        shiftId: shift?.id || '',
        shiftName: shift?.shift_name || '',
      });
      toast({ title: editRecord ? 'Attendance updated successfully.' : 'Manual attendance entry saved.' });
      onSaved?.();
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">{editRecord ? 'Edit Attendance' : 'Manual Attendance Entry'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Employee selection */}
          {!editRecord && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Employee</label>
              {selectedEmp ? (
                <div className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <PersonnelAvatar name={selectedEmp.name} photoUrl={selectedEmp.photo_url} size="sm" />
                    <div>
                      <p className="text-sm font-medium">{selectedEmp.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedEmp.company} · {selectedEmp.qid_no || '—'}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedEmp(null)} className="text-xs text-muted-foreground hover:text-foreground">Change</button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search employee by name, QID, PID..." value={empSearch}
                      onChange={e => setEmpSearch(e.target.value)} className="pl-9" autoFocus />
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                    {filteredEmps.map(emp => (
                      <button key={emp.id} onClick={() => setSelectedEmp(emp)}
                        className="w-full flex items-center gap-2 p-2 hover:bg-muted text-left border-b border-border/50 last:border-0">
                        <PersonnelAvatar name={emp.name} photoUrl={emp.photo_url} size="sm" />
                        <div>
                          <p className="text-sm font-medium">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">{emp.company} · {emp.qid_no || '—'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Date */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Attendance Date</label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          {/* Punch inputs */}
          <div className="grid grid-cols-2 gap-3">
            <PunchInput label="First Clock In" date={firstInDate} time={firstInTime}
              onDate={setFirstInDate} onTime={setFirstInTime} />
            <PunchInput label="First Clock Out" date={firstOutDate} time={firstOutTime}
              onDate={setFirstOutDate} onTime={setFirstOutTime} />
            <PunchInput label="Second Clock In" date={secondInDate} time={secondInTime}
              onDate={setSecondInDate} onTime={setSecondInTime} />
            <PunchInput label="Final Clock Out" date={finalOutDate} time={finalOutTime}
              onDate={setFinalOutDate} onTime={setFinalOutTime} />
          </div>

          {/* Reason */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Reason (required)</label>
            <Input placeholder="e.g. Device malfunction, employee forgot to punch..."
              value={reason} onChange={e => setReason(e.target.value)} />
          </div>

          {/* Remarks */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Remarks</label>
            <Input placeholder="Optional remarks" value={remarks} onChange={e => setRemarks(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editRecord ? 'Update Attendance' : 'Save Entry'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function PunchInput({ label, date, time, onDate, onTime }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground uppercase">{label}</label>
      <div className="flex gap-1">
        <Input type="date" value={date} onChange={e => onDate(e.target.value)} className="flex-1" />
        <Input type="time" value={time} onChange={e => onTime(e.target.value)} className="w-24" />
      </div>
    </div>
  );
}