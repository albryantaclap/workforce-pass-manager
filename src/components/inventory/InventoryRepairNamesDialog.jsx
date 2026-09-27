import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Wand2, CheckCircle, AlertTriangle, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { parseInventoryWorkbook, MASTER_SHEET } from '@/lib/inventoryImport';
import { isMissingText, textValue } from '@/lib/inventoryText';

const BATCH_SIZE = 500;

/**
 * Repairs Item Name / Unit on EXISTING inventory items from the original import
 * file, matched by Item S.N.
 *
 * Nothing is created and nothing is deleted: only the two text fields are filled
 * in on items whose stored value is blank or the leftover "[object Object]"
 * placeholder, plus the denormalised copies on the existing transactions that
 * point at the same item — so every module shows the same corrected text.
 * Quantities, dates, I/V numbers, PIDs and all other information are untouched.
 */
export default function InventoryRepairNamesDialog({ open, onClose, items = [], onRepaired }) {
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const { toast } = useToast();

  const reset = () => { setPreview(null); setFileName(''); };

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const { items: parsed, errors, hasMaster } = parseInventoryWorkbook(workbook);
      if (!hasMaster) {
        const sheets = workbook.worksheets.map((w) => w.name).join(', ');
        throw new Error(`No "${MASTER_SHEET}" sheet in this file. Sheets found: ${sheets}`);
      }

      const bySn = new Map(items.map((i) => [String(i.item_sn || '').trim().toUpperCase(), i]));
      const repairs = [];
      let alreadyOk = 0;
      let notInSystem = 0;

      for (const parsedItem of parsed) {
        const existing = bySn.get(String(parsedItem.item_sn || '').trim().toUpperCase());
        if (!existing) { notInSystem += 1; continue; }
        const name = textValue(parsedItem.item_name);
        const unit = textValue(parsedItem.unit);
        const fixName = isMissingText(existing.item_name) && !!name;
        const fixUnit = isMissingText(existing.unit) && !!unit;
        if (!fixName && !fixUnit) { alreadyOk += 1; continue; }
        repairs.push({
          id: existing.id,
          item_sn: existing.item_sn,
          item_name: fixName ? name : textValue(existing.item_name),
          unit: fixUnit ? unit : textValue(existing.unit),
          fixedName: fixName,
          fixedUnit: fixUnit,
        });
      }

      setPreview({ repairs, alreadyOk, notInSystem, errors });
    } catch (e) {
      setPreview({ repairs: [], alreadyOk: 0, notInSystem: 0, errors: [e.message] });
    }
  };

  const handleRepair = async () => {
    const repairs = preview?.repairs || [];
    if (repairs.length === 0) return;
    setBusy(true);
    try {
      const { base44 } = await import('@/api/base44Client');
      const patchByItemId = new Map(repairs.map((r) => [r.id, { item_name: r.item_name, unit: r.unit }]));

      const itemUpdates = repairs.map((r) => ({ id: r.id, ...patchByItemId.get(r.id) }));
      for (let i = 0; i < itemUpdates.length; i += BATCH_SIZE) {
        await base44.entities.InventoryItem.bulkUpdate(itemUpdates.slice(i, i + BATCH_SIZE));
      }

      // Re-sync the item name/unit copies already stored on this item's
      // transactions (linked by item_id) so Stock In, Stock Out, Transactions,
      // Reports, Returns and the exports all resolve to the same text.
      const transactions = await base44.entities.InventoryTransaction.list(undefined, 100000);
      const txnUpdates = [];
      for (const t of transactions) {
        const patch = patchByItemId.get(t.item_id);
        if (!patch) continue;
        if (textValue(t.item_name) === patch.item_name && textValue(t.unit) === patch.unit) continue;
        txnUpdates.push({ id: t.id, item_name: patch.item_name, unit: patch.unit });
      }
      for (let i = 0; i < txnUpdates.length; i += BATCH_SIZE) {
        await base44.entities.InventoryTransaction.bulkUpdate(txnUpdates.slice(i, i + BATCH_SIZE));
      }

      toast({
        title: 'Item details repaired',
        description: `${itemUpdates.length} item(s) and ${txnUpdates.length} transaction line(s) updated.`,
      });
      onRepaired?.();
      reset();
      onClose();
    } catch (e) {
      toast({ title: `Repair failed: ${e.message}`, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => { reset(); onClose(); };
  const repairs = preview?.repairs || [];
  const hasErrors = (preview?.errors || []).length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Repair Item Names &amp; Units</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
            <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              Choose the same inventory Excel file used for the import. Item Name and Unit are read from the
              <span className="font-semibold"> MASTER FILE </span>
              sheet and matched to existing items by Item S.N.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4" /> Choose Excel File
            </Button>
            {fileName && <p className="text-xs mt-2 text-muted-foreground">{fileName}</p>}
          </div>

          {hasErrors && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <AlertDescription>
                <p className="font-semibold text-amber-800 mb-1">Could not read the file:</p>
                <ul className="text-xs text-amber-700 max-h-32 overflow-y-auto">
                  {preview.errors.slice(0, 10).map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {preview && !hasErrors && (
            <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
              <div className="flex items-center gap-2 text-green-600 font-semibold">
                <CheckCircle className="w-4 h-4" />
                {repairs.length > 0 ? 'Ready to repair' : 'Nothing to repair'}
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-white rounded p-2 border">
                  <p className="text-xs text-muted-foreground">Will be filled in</p>
                  <p className="text-lg font-bold">{repairs.length}</p>
                </div>
                <div className="bg-white rounded p-2 border">
                  <p className="text-xs text-muted-foreground">Already complete</p>
                  <p className="text-lg font-bold">{preview.alreadyOk}</p>
                </div>
                <div className="bg-white rounded p-2 border">
                  <p className="text-xs text-muted-foreground">Not in the system (skipped)</p>
                  <p className="text-lg font-bold">{preview.notInSystem}</p>
                </div>
              </div>

              {repairs.length > 0 && (
                <div className="bg-white rounded border table-scroll-x">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-32">Item S.N.</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="w-20">Unit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repairs.slice(0, 8).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono">{r.item_sn}</TableCell>
                          <TableCell className={r.fixedName ? '' : 'text-muted-foreground'}>
                            {r.item_name || '—'}
                          </TableCell>
                          <TableCell className={r.fixedUnit ? '' : 'text-muted-foreground'}>
                            {r.unit || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {repairs.length > 8 && (
                    <p className="text-xs text-muted-foreground px-3 py-2">
                      … and {repairs.length - 8} more
                    </p>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Only the Item Name and Unit of existing records are updated — no items are created or deleted,
                and quantities, transactions, dates and employee details stay exactly as they are.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={busy}>Cancel</Button>
          <Button onClick={handleRepair} disabled={busy || repairs.length === 0} className="gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {busy ? 'Repairing...' : `Repair ${repairs.length || ''} Item(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}