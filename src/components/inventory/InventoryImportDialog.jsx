import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, CheckCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export default function InventoryImportDialog({ open, onClose, onImported, user }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState([]);
  const fileRef = useRef();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    setPreview(null);
    setErrors([]);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const buf = await f.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);

      const masterSheet = wb.getWorksheet('MASTER FILE');
      const invSheet = wb.getWorksheet('INVENTORY DETAILS');

      const items = [];
      const stockIn = [];
      const stockOut = [];
      const errs = [];

      // Parse MASTER FILE (items)
      if (masterSheet) {
        masterSheet.eachRow((row, rowNum) => {
          if (rowNum === 1) return; // header
          const sn = row.getCell(2).value;
          const desc = row.getCell(3).value;
          const uom = row.getCell(4).value;
          if (sn && desc) {
            items.push({
              item_sn: String(sn).trim(),
              item_name: String(desc).trim(),
              unit: String(uom || 'NOS').trim(),
              category: '',
              min_stock_level: 0,
            });
          }
        });
      }

      // Parse INVENTORY DETAILS (IN / OUT)
      if (invSheet) {
        invSheet.eachRow((row, rowNum) => {
          if (rowNum <= 3) return; // headers
          // IN section: cols 2-12 (date, item_sn, item_name, unit, dn, mrf, lpo, supplier, store, qty, remarks)
          const inDate = row.getCell(2).value;
          const inSn = row.getCell(4).value;
          const inName = row.getCell(5).value;
          const inUnit = row.getCell(6).value;
          const inDn = row.getCell(7).value;
          const inMrf = row.getCell(8).value;
          const inLpo = row.getCell(9).value;
          const inSupplier = row.getCell(10).value;
          const inStore = row.getCell(11).value;
          const inQty = row.getCell(12).value;
          if (inDate && inSn && inQty) {
            const d = inDate instanceof Date ? inDate.toISOString().slice(0, 10) : String(inDate).slice(0, 10);
            stockIn.push({
              transaction_date: d,
              item_sn: String(inSn).trim(),
              item_name: String(inName || '').trim(),
              unit: String(inUnit || 'NOS').trim(),
              dn_no: String(inDn || '').trim(),
              mrf_no: String(inMrf || '').trim(),
              lpo: String(inLpo || '').trim(),
              supplier: String(inSupplier || '').trim(),
              store: String(inStore || '').trim(),
              quantity: Number(inQty) || 0,
            });
          }
          // OUT section: cols 15-25 (date, item_sn, item_name, unit, iv, site, pid, emp_name, company, qty, remarks)
          const outDate = row.getCell(15).value;
          const outSn = row.getCell(17).value;
          const outName = row.getCell(18).value;
          const outUnit = row.getCell(19).value;
          const outIv = row.getCell(20).value;
          const outSite = row.getCell(21).value;
          const outPid = row.getCell(22).value;
          const outEmp = row.getCell(23).value;
          const outCompany = row.getCell(24).value;
          const outQty = row.getCell(25).value;
          if (outDate && outSn && outQty) {
            const d = outDate instanceof Date ? outDate.toISOString().slice(0, 10) : String(outDate).slice(0, 10);
            stockOut.push({
              transaction_date: d,
              item_sn: String(outSn).trim(),
              item_name: String(outName || '').trim(),
              unit: String(outUnit || 'NOS').trim(),
              iv_no: String(outIv || '').trim(),
              site: String(outSite || '').trim(),
              pid: String(outPid || '').trim(),
              employee_name: String(outEmp || '').trim(),
              company: String(outCompany || '').trim(),
              quantity: Number(outQty) || 0,
            });
          }
        });
      }

      // Validate: check for duplicate item S.N.
      const snSet = new Set();
      items.forEach(i => {
        if (snSet.has(i.item_sn)) errs.push(`Duplicate Item S.N. in MASTER FILE: ${i.item_sn}`);
        snSet.add(i.item_sn);
      });

      // Validate: stock in/out items exist in master
      stockIn.forEach(s => {
        if (!snSet.has(s.item_sn)) errs.push(`Stock In references unknown Item S.N.: ${s.item_sn}`);
      });
      stockOut.forEach(s => {
        if (!snSet.has(s.item_sn)) errs.push(`Stock Out references unknown Item S.N.: ${s.item_sn}`);
      });

      setPreview({ items, stockIn, stockOut });
      setErrors(errs);
    } catch (e) {
      setErrors([`Failed to parse file: ${e.message}`]);
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      const { base44 } = await import('@/api/base44Client');
      const batchId = `IMPORT-${Date.now()}`;

      // 1. Import items (create-or-update by item_sn)
      const existingItems = await base44.entities.InventoryItem.list('-created_date', 100000);
      const existingSnMap = new Map(existingItems.map(i => [i.item_sn, i]));
      const itemsToCreate = preview.items.filter(i => !existingSnMap.has(i.item_sn));
      if (itemsToCreate.length > 0) {
        await base44.entities.InventoryItem.bulkCreate(itemsToCreate);
      }

      // 2. Import stock in transactions
      const allItems = await base44.entities.InventoryItem.list('-created_date', 100000);
      const itemMap = new Map(allItems.map(i => [i.item_sn, i]));

      const stockInTxns = preview.stockIn.map(s => {
        const item = itemMap.get(s.item_sn);
        return {
          transaction_date: s.transaction_date,
          transaction_type: 'STOCK_IN',
          item_id: item?.id || '',
          item_sn: s.item_sn,
          item_name: s.item_name || item?.item_name || '',
          unit: s.unit || item?.unit || '',
          quantity: s.quantity,
          quantity_abs: s.quantity,
          dn_no: s.dn_no, mrf_no: s.mrf_no, lpo: s.lpo,
          supplier: s.supplier, store: s.store,
          created_by: user?.email || '',
          created_by_name: user?.full_name || user?.email || '',
          import_batch_id: batchId,
        };
      });

      const stockOutTxns = preview.stockOut.map(s => {
        const item = itemMap.get(s.item_sn);
        return {
          transaction_date: s.transaction_date,
          transaction_type: 'STOCK_OUT',
          item_id: item?.id || '',
          item_sn: s.item_sn,
          item_name: s.item_name || item?.item_name || '',
          unit: s.unit || item?.unit || '',
          quantity: -s.quantity,
          quantity_abs: s.quantity,
          iv_no: s.iv_no, site: s.site,
          pid: s.pid, employee_name: s.employee_name, company: s.company,
          created_by: user?.email || '',
          created_by_name: user?.full_name || user?.email || '',
          import_batch_id: batchId,
        };
      });

      const allTxns = [...stockInTxns, ...stockOutTxns].filter(t => t.item_id);
      if (allTxns.length > 0) {
        // Bulk create in batches of 500
        for (let i = 0; i < allTxns.length; i += 500) {
          await base44.entities.InventoryTransaction.bulkCreate(allTxns.slice(i, i + 500));
        }
      }

      toast({
        title: `Import complete`,
        description: `${itemsToCreate.length} new items, ${stockInTxns.length} stock in, ${stockOutTxns.length} stock out transactions. Batch: ${batchId}`,
      });
      onImported?.();
      onClose();
      setFile(null);
      setPreview(null);
      setErrors([]);
    } catch (e) {
      toast({ title: `Import failed: ${e.message}`, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setErrors([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Inventory from Excel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
            <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              Upload the INVENTORY DETAILS-GSOQ.xlsx file. Maps MASTER FILE → Items, IN → Stock In, OUT → Stock Out.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => handleFile(e.target.files[0])}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4" /> Choose Excel File
            </Button>
            {file && <p className="text-xs mt-2 text-muted-foreground">{file.name}</p>}
          </div>

          {errors.length > 0 && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <AlertDescription>
                <p className="font-semibold text-amber-800 mb-1">Validation Issues ({errors.length}):</p>
                <ul className="text-xs text-amber-700 max-h-32 overflow-y-auto">
                  {errors.slice(0, 20).map((e, i) => <li key={i}>• {e}</li>)}
                  {errors.length > 20 && <li>... and {errors.length - 20} more</li>}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {preview && (
            <div className="border rounded-lg p-4 bg-slate-50 space-y-2">
              <div className="flex items-center gap-2 text-green-600 font-semibold">
                <CheckCircle className="w-4 h-4" />
                Preview Summary
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-white rounded p-2 border">
                  <p className="text-xs text-muted-foreground">Items</p>
                  <p className="text-lg font-bold">{preview.items.length}</p>
                </div>
                <div className="bg-white rounded p-2 border">
                  <p className="text-xs text-muted-foreground">Stock In</p>
                  <p className="text-lg font-bold text-green-600">{preview.stockIn.length}</p>
                </div>
                <div className="bg-white rounded p-2 border">
                  <p className="text-xs text-muted-foreground">Stock Out</p>
                  <p className="text-lg font-bold text-orange-600">{preview.stockOut.length}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Existing items with matching S.N. will be skipped (no overwrite). Transactions will be assigned batch ID for traceability.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importing}>Cancel</Button>
          <Button onClick={handleImport} disabled={!preview || importing || errors.length > 0}>
            {importing ? 'Importing...' : 'Confirm Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}