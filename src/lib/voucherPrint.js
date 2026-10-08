/**
 * Print one complete store issue voucher (I/V) — every item line with the
 * employee, PID and company each line was issued to, on a single sheet.
 */
const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

export function printVoucher(group) {
  if (!group) return false;
  const isOut = group.type === 'STOCK_OUT';
  const lines = group.lines || [];

  const rows = lines.map((t, idx) => `
    <tr>
      <td class="c">${idx + 1}</td>
      <td class="mono">${esc(t.item_sn)}</td>
      <td>${esc(t.item_name)}</td>
      <td class="c">${esc(t.unit)}</td>
      <td class="r b">${esc(t.quantity_abs)}</td>
      <td>${esc(t.employee_name || '—')}</td>
      <td class="mono c">${esc(t.pid || '—')}</td>
      <td>${esc(t.company || '—')}</td>
      <td>${esc(t.remarks || '—')}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html><head><title>${esc(group.documentNo || 'Store Issue Voucher')}</title>
<style>
  @page { size: A4 landscape; margin: 10mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0e1425; margin: 0; }
  .title-bar { background: #254dd0; color: #fff; text-align: center; padding: 10px 0; font-size: 20px;
    font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 18px; font-size: 11.5px; margin: 12px 2px; }
  .meta span { display: block; color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; }
  .meta b { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th { background: #eef2ff; color: #1e2a5a; font-size: 10.5px; text-transform: uppercase; padding: 6px 5px;
    border: 1px solid #c8ccd0; }
  td { font-size: 11.5px; padding: 5px 6px; border: 1px solid #dcdfe5; word-break: break-word; }
  .c { text-align: center; } .r { text-align: right; } .b { font-weight: bold; } .mono { font-family: Menlo, Consolas, monospace; }
  .sign { display: flex; justify-content: space-between; margin-top: 34px; font-size: 11px; }
  .sign div { width: 30%; border-top: 1px solid #9aa0a6; padding-top: 4px; text-align: center; color: #4b5563; }
  @media print { th, .title-bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    thead { display: table-header-group; } tr { page-break-inside: avoid; } }
</style>
</head><body>
<div class="title-bar">Store Issue Voucher</div>
<div class="meta">
  <div><span>I/V No.</span><b>${esc(group.documentNo || '—')}</b></div>
  <div><span>Date</span><b>${esc(group.date || '—')}</b></div>
  <div><span>Site</span><b>${esc(group.site || '—')}</b></div>
  <div><span>Store</span><b>${esc(group.store || '—')}</b></div>
  <div><span>Issued by</span><b>${esc(group.createdBy || '—')}</b></div>
  <div><span>Employees</span><b>${esc([...new Set(lines.map(l => l.employee_name).filter(Boolean))].length || '—')}</b></div>
  <div><span>Item lines</span><b>${lines.length}</b></div>
  <div><span>Total quantity</span><b>${group.totalQty}</b></div>
</div>
<table>
  <colgroup>
    <col style="width:4%" /><col style="width:11%" /><col style="width:20%" /><col style="width:6%" />
    <col style="width:6%" /><col style="width:17%" /><col style="width:9%" /><col style="width:12%" /><col style="width:15%" />
  </colgroup>
  <thead><tr>
    <th>#</th><th>Item S.N.</th><th>Item Name / Description</th><th>Unit</th><th>Qty</th>
    <th>Employee</th><th>PID No.</th><th>Company</th><th>Remarks</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="sign">
  <div>Issued By</div><div>Received By</div><div>Store Keeper</div>
</div>
<script>window.onload = function () { window.print(); };</script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}