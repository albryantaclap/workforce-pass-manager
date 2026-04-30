export const COMPANIES = [
  { value: 'GSO QATAR', label: 'GSO QATAR', type: 'Main' },
  { value: 'ITELLIGENT', label: 'ITELLIGENT', type: 'Sub-contractor' },
  { value: 'ANION', label: 'ANION', type: 'Sub-contractor' },
  { value: 'SEA QUEEN', label: 'SEA QUEEN', type: 'Sub-contractor' },
  { value: 'LMV E AND I', label: 'LMV E AND I', type: 'Sub-contractor' },
  { value: 'METAL WORLD', label: 'METAL WORLD', type: 'Sub-contractor' },
  { value: 'ASMA', label: 'ASMA', type: 'Sub-contractor' },
  { value: 'FIT', label: 'FIT', type: 'Sub-contractor' },
  { value: 'SPRAY CON', label: 'SPRAY CON', type: 'Sub-contractor' },
  { value: 'EMKAN', label: 'EMKAN', type: 'Sub-contractor' },
  { value: 'ENERTEC', label: 'ENERTEC', type: 'Sub-contractor' },
  { value: 'CRYSTAL', label: 'CRYSTAL', type: 'Sub-contractor' },
  { value: 'MEGATRONICS (GSO)', label: 'MEGATRONICS (GSO)', type: 'GSO Supervision' },
  { value: 'ENERSERVE (GSO)', label: 'ENERSERVE (GSO)', type: 'GSO Supervision' },
  { value: 'ENERTEC (GSO)', label: 'ENERTEC (GSO)', type: 'GSO Supervision' },
  { value: 'NTC (GSO)', label: 'NTC (GSO)', type: 'GSO Supervision' },
  { value: 'MIR (GSO)', label: 'MIR (GSO)', type: 'GSO Supervision' },
  { value: 'ALTAF (GSO)', label: 'ALTAF (GSO)', type: 'GSO Supervision' },
  { value: 'SWAN GLOBAL (GSO)', label: 'SWAN GLOBAL (GSO)', type: 'GSO Supervision' },
  { value: 'SIGEL (GSO)', label: 'SIGEL (GSO)', type: 'GSO Supervision' },
  { value: 'AL-RAMSHA (GSO)', label: 'AL-RAMSHA (GSO)', type: 'GSO Supervision' },
  { value: 'ALTHAF (GSO)', label: 'ALTHAF (GSO)', type: 'GSO Supervision' },
  { value: 'ZEAL-IT', label: 'ZEAL-IT', type: 'Sub-contractor' },
];

export const RLIC_STATUSES = [
  { value: 'VALID RLIC PASS', label: 'VALID RLIC PASS' },
  { value: 'EXPIRED RLIC PASS', label: 'EXPIRED RLIC PASS' },
  { value: 'SOON TO EXPIRE', label: 'SOON TO EXPIRE' },
  { value: 'NO RLIC PASS', label: 'NO RLIC PASS' },
];

export const PID_STATUSES = [
  { value: 'VALID PID PASS', label: 'VALID PID PASS' },
  { value: 'EXPIRED PID PASS', label: 'EXPIRED PID PASS' },
  { value: 'SOON TO EXPIRE', label: 'SOON TO EXPIRE' },
  { value: 'NO PID PASS', label: 'NO PID PASS' },
];

export const DEPARTMENTS = ['ELECTRICAL', 'MECHANICAL', 'CIVIL', 'SERVICES'];
export const FTW_RESULTS = ['ACCEPTED', 'REJECTED', 'WAITING TR APPROVAL', 'RE-ASSESS'];
export const MEDICAL_RESULTS = [
  { value: 'ACCEPTED', label: 'ACCEPTED' },
  { value: 'REJECTED', label: 'REJECTED' },
  { value: 'WAITING TR APPROVAL', label: 'WAITING TR APPROVAL' },
  { value: 'RE-ASSESS', label: 'RE-ASSESS' },
];
export const TRAINING_STATUSES = [
  { value: 'SCHEDULED', label: 'SCHEDULED' },
  { value: 'ON-GOING', label: 'ON-GOING' },
  { value: 'DONE', label: 'DONE' },
  { value: 'PENDING', label: 'PENDING' },
  { value: 'NOT REQUIRED', label: 'NOT REQUIRED' },
];
export const LOCATIONS = ['QATAR', 'COMO CAMP', 'OTHER'];

// Normalize any date string to YYYY-MM-DD regardless of input format
// Handles: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY (treated as DD/MM/YYYY for this app)
export function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim().split('T')[0];
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or DD-MM-YYYY
  const slash = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slash) {
    const [, dd, mm, yyyy] = slash;
    return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
  }
  return s;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const normalized = normalizeDate(dateStr);
  if (!normalized) return dateStr;
  const parts = normalized.split('-');
  if (parts.length !== 3) return dateStr;
  const [yyyy, mm, dd] = parts;
  if (!yyyy || !mm || !dd) return dateStr;
  return `${dd}/${mm}/${yyyy}`;
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const normalized = normalizeDate(dateStr);
  if (!normalized) return null;
  const parts = normalized.split('-').map(Number);
  if (parts.length !== 3) return null;
  const [yyyy, mm, dd] = parts;
  if (!yyyy || !mm || !dd) return null;
  const d = new Date(yyyy, mm - 1, dd); // Local midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
}

// Built-in status values that are date-derivable — these should NOT be used as custom overrides
const BUILT_IN_RLIC = new Set(['VALID RLIC PASS', 'EXPIRED RLIC PASS', 'SOON TO EXPIRE', 'NO RLIC PASS']);
const BUILT_IN_PID = new Set(['VALID PID PASS', 'EXPIRED PID PASS', 'SOON TO EXPIRE', 'NO PID PASS']);

// Compute effective status for an employee record.
// If the employee has a custom stored status (not date-derivable), it takes priority.
// Otherwise status is derived from the expiry date.
// storedStatus: e.rlic_status or e.pid_status
// dateStr: e.gate_pass_expiry or e.pid_expiry
// type: 'rlic' | 'pid'
export function computePassStatus(dateStr, type, storedStatus) {
  const builtIn = type === 'rlic' ? BUILT_IN_RLIC : BUILT_IN_PID;

  // If stored status is a custom (non-built-in) value, respect it
  if (storedStatus && !builtIn.has(storedStatus)) return storedStatus;

  // Otherwise derive from expiry date
  if (!dateStr) return type === 'rlic' ? 'NO RLIC PASS' : 'NO PID PASS';
  const days = daysUntil(dateStr);
  if (days === null) return type === 'rlic' ? 'NO RLIC PASS' : 'NO PID PASS';
  if (days < 0) return type === 'rlic' ? 'EXPIRED RLIC PASS' : 'EXPIRED PID PASS';
  if (days <= 90) return 'SOON TO EXPIRE';
  return type === 'rlic' ? 'VALID RLIC PASS' : 'VALID PID PASS';
}

export function exportToCSV(data, filename) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => {
    const val = row[h] ?? '';
    return `"${String(val).replace(/"/g, '""')}"`;
  }).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToExcel(data, filename) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const headerRow = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  const dataRows = data.map(row =>
    `<tr>${headers.map(h => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`
  ).join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table>${headerRow}${dataRows}</table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/\.csv$/, '') + '.xls';
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToIQY(data, filename) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => String(row[h] ?? '')).join('\t'));
  const content = [headers.join('\t'), ...rows].join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/\.csv$/, '') + '.iqy';
  a.click();
  URL.revokeObjectURL(url);
}

export function exportData(data, filename, format) {
  if (format === 'excel') return exportToExcel(data, filename);
  if (format === 'iqy') return exportToIQY(data, filename);
  return exportToCSV(data, filename);
}