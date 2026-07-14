import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

/**
 * Reusable "Print / PDF" button — opens a print-ready landscape report in a new
 * window (File → Save as PDF works from the browser print dialog). Reuses the
 * same print-report pattern already used by TrainingRequestForm.
 *
 * Props:
 *  - records:        Array<row>   Pre-filtered/sorted rows. Each row is an object
 *                                  whose keys match the `columns` below.
 *  - columns:        Array<{key,label}>  Column spec (key + printed header label).
 *  - title:          string       Report title (e.g. "GSO Qatar — Inactive Personnel Report")
 *  - subtitle:       string|null  Optional subtitle shown under the title
 *  - appliedFilters: Array<string> Human-readable list of active filters (omitted when empty)
 *  - totalFiltered:   number|null  Total filtered personnel count to show in the meta line
 *                                 (defaults to records.length when omitted)
 *  - label:          string       Button label (default "Print / PDF")
 *  - disabled:       boolean
 *  - onBeforeOpen:   function|null  Hook run before opening (e.g. to surface a toast)
 */
export default function PrintReportButton({
  records = [],
  columns = [],
  title = 'Report',
  subtitle = null,
  appliedFilters = [],
  totalFiltered = null,
  label = 'Print / PDF',
  disabled = false,
  onBeforeOpen = null,
  sortBy = [],
}) {
  const handlePrint = () => {
    if (onBeforeOpen) onBeforeOpen();

    const cols = columns.length
      ? columns
      : (records.length ? Object.keys(records[0]).map(k => ({ key: k, label: k })) : []);

    // Sort records by the provided keys (case-insensitive, fallbacks preserved)
    let sorted = records;
    if (Array.isArray(sortBy) && sortBy.length > 0) {
      sorted = [...records].sort((a, b) => {
        for (const k of sortBy) {
          const va = (a[k] ?? '').toString().toLowerCase();
          const vb = (b[k] ?? '').toString().toLowerCase();
          if (va < vb) return -1;
          if (va > vb) return 1;
        }
        return 0;
      });
    }

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const generatedDate = `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    const total = totalFiltered != null ? totalFiltered : records.length;

    const colWidthPct = Math.floor(100 / cols.length);
    const colgroup = cols.map(c => `<col style="width:${colWidthPct}%">`).join('');

    const headerRow = cols
      .map(c => `<th>${(c.label || c.key).toString().replace(/</g, '<')}</th>`)
      .join('');

    const esc = (v) => {
      if (v === null || v === undefined) return '';
      return String(v).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
    };

    const cellHtml = (c, row) => {
      const val = row[c.key];
      const hasVal = val !== null && val !== undefined && String(val).trim() !== '';
      const content = hasVal ? esc(val) : '<span style="opacity:.8">—</span>';
      return `<td style="text-align:${c.align || 'left'}">${content}</td>`;
    };

    const bodyRows = sorted.length
      ? sorted.map((row, i) => {
          const cells = cols.map(c => cellHtml(c, row)).join('');
          const stripe = i % 2 === 0 ? '#ffffff' : '#f1f2f6';
          return `<tr style="background:${stripe}">${cells}</tr>`;
        }).join('')
      : `<tr><td colspan="${cols.length}" style="text-align:center;padding:16px;color:#777">No records to display</td></tr>`;

    const filtersBlock = (appliedFilters && appliedFilters.length > 0)
      ? `<div class="filters"><span class="filters-label">Applied Filters:</span> ${appliedFilters
          .map(f => `<span class="filter-chip">${esc(f)}</span>`).join('')}</div>`
      : '';

    const subtitleBlock = subtitle ? `<div class="subtitle">${esc(subtitle)}</div>` : '';

    const html = `<!DOCTYPE html>
<html><head><title>${esc(title)}</title>
<style>
  @page { size: A3 landscape; margin: 10mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; margin: 0; padding: 0; background: #fff; color: #2f3542; }
  .title-bar {
    background: #ff9f43;
    text-align: center;
    padding: 11px 0;
    font-size: 22px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #000;
    margin-bottom: 6px;
  }
  .subtitle { text-align: center; font-size: 13px; font-weight: 600; color: #2f3542; margin-bottom: 4px; }
  .meta { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; font-size: 11px; color: #2f3542; margin: 6px 2px 8px; }
  .meta .right { text-transform: uppercase; font-weight: 600; }
  .meta div { line-height: 1.4; }
  .filters { font-size: 11px; color: #2f3542; margin: 4px 2px 10px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .filters-label { font-weight: bold; margin-right: 4px; }
  .filter-chip { border: 1px solid #b9b9b9; border-radius: 10px; padding: 1px 8px; background: #f1f2f6; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th {
    background: #1e3799;
    color: #ffffff;
    font-size: 11px;
    font-weight: bold;
    text-transform: uppercase;
    text-align: center;
    vertical-align: middle;
    padding: 7px 5px;
    border: 1px solid #9aa0a6;
    line-height: 1.3;
  }
  td {
    font-size: 12px;
    vertical-align: middle;
    padding: 5px 7px;
    border: 1px solid #c8ccd0;
    color: #2f3542;
    word-break: break-word;
    line-height: 1.3;
  }
  @media print {
    .title-bar, th, .filter-chip { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    thead { display: table-header-group; }
    .title-bar, .filters { page-break-inside: avoid; }
    tr { page-break-inside: avoid; }
  }
</style>
</head><body>
<div class="title-bar">${esc(title)}</div>
${subtitleBlock}
<div class="meta">
  <div><strong>Generated:</strong> ${esc(generatedDate)}</div>
  <div class="right"><strong>Total Filtered Personnel:</strong> ${total}</div>
</div>
${filtersBlock}
<table>
  <colgroup>${colgroup}</colgroup>
  <thead><tr>${headerRow}</tr></thead>
  <tbody>${bodyRows}</tbody>
</table>
<script>window.onload = function(){ window.print(); }</script>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  return (
    <Button variant="outline" onClick={handlePrint} disabled={disabled || records.length === 0}>
      <Printer className="w-4 h-4 mr-2" /> {label}
    </Button>
  );
}