import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileWarning } from 'lucide-react';

function DecisionRow({ doc, initial, onChange }) {
  const [mode, setMode] = useState(initial.mode);
  const [renewalDate, setRenewalDate] = useState(initial.renewalDate);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    onChange(doc.documentType, { mode, renewalDate, remarks });
  }, [mode, renewalDate, remarks]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-slate-50/50">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm">{doc.documentType === 'Gate Pass' ? 'Gate Pass (RLIC)' : 'Project ID'}</div>
        <span className="text-[11px] text-muted-foreground">{doc.isRenewalKey ? 'Expiry / document no. changed' : 'Field correction'}</span>
      </div>
      <div className="space-y-1">
        {doc.changes.map((c) => (
          <div key={c.field} className="text-[11px] flex gap-2 items-center">
            <span className="text-muted-foreground w-28 shrink-0">{c.label}:</span>
            <span className="line-through text-muted-foreground">{c.from || '—'}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium text-foreground">{c.to || '—'}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => setMode('renewal')}
          className={`text-xs font-medium px-3 py-1.5 rounded-md border-2 transition-colors ${mode === 'renewal' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-foreground hover:border-primary/40'}`}
        >
          Renewal
        </button>
        <button
          type="button"
          onClick={() => setMode('correction')}
          className={`text-xs font-medium px-3 py-1.5 rounded-md border-2 transition-colors ${mode === 'correction' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-foreground hover:border-primary/40'}`}
        >
          Correction
        </button>
      </div>
      {mode === 'renewal' && (
        <div>
          <Label className="text-xs">Actual Renewal Date</Label>
          <Input type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} className="text-xs h-8" />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {doc.documentType === 'Gate Pass' ? 'Defaults to the Gate Pass Received Date' : 'Defaults to the Project ID Issue Date'}. Leave blank if unconfirmed.
          </p>
        </div>
      )}
      <div>
        <Label className="text-xs">{mode === 'correction' ? 'Correction Reason' : 'Remarks'}</Label>
        <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} className="text-xs h-8" placeholder={mode === 'correction' ? 'Reason for correction' : 'Optional remarks'} />
      </div>
    </div>
  );
}

/**
 * Confirmation dialog shown by Edit Personnel when a Gate Pass or Project ID
 * renewal-relevant field changed. The user must classify each change as a Renewal
 * (new history entry, previous version preserved) or a Correction (audited update,
 * no renewal count increase). A change in expiry date is never auto-classified.
 */
export default function RenewalConfirmDialog({ open, onClose, onConfirm, documents, employeeName }) {
  const [decisions, setDecisions] = useState({});

  useEffect(() => {
    if (open && documents) {
      const init = {};
      for (const d of documents) {
        init[d.documentType] = { mode: d.isRenewalKey ? 'renewal' : 'correction', renewalDate: d.defaultRenewalDate || '', remarks: '' };
      }
      setDecisions(init);
    }
  }, [open, documents]);

  const handle = (dt, dec) => setDecisions((prev) => ({ ...prev, [dt]: dec }));

  const handleConfirm = () => {
    const out = (documents || []).map((d) => ({
      documentType: d.documentType,
      ...(decisions[d.documentType] || { mode: d.isRenewalKey ? 'renewal' : 'correction', renewalDate: d.defaultRenewalDate || '', remarks: '' }),
    }));
    onConfirm(out);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileWarning className="w-4 h-4 text-amber-500" /> Confirm Document Change
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {employeeName ? <span className="font-medium text-foreground">{employeeName}</span> : null}
          {' '}— the following document field(s) changed. A change in expiry date or a new issuance must be confirmed as a Renewal or a Correction before saving.
        </p>
        <div className="space-y-3 max-h-[55vh] overflow-auto pr-1">
          {(documents || []).map((d) => (
            <DecisionRow
              key={d.documentType}
              doc={d}
              initial={decisions[d.documentType] || { mode: d.isRenewalKey ? 'renewal' : 'correction', renewalDate: d.defaultRenewalDate || '', remarks: '' }}
              onChange={handle}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm}>Confirm & Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}