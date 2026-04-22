export const COMPANIES = [
  { value: 'GSO QATAR', label: 'GSO Qatar', type: 'Main' },
  { value: 'ITELLIGENT', label: 'Itelligent', type: 'Sub-contractor' },
  { value: 'ANION', label: 'Anion', type: 'Sub-contractor' },
  { value: 'SEA QUEEN', label: 'Sea Queen', type: 'Sub-contractor' },
  { value: 'LMV E AND I', label: 'LMV E and I', type: 'Sub-contractor' },
  { value: 'METAL WORLD', label: 'Metal World', type: 'Sub-contractor' },
  { value: 'ASMA', label: 'ASMA', type: 'Sub-contractor' },
  { value: 'FIT', label: 'FIT', type: 'Sub-contractor' },
  { value: 'SPRAY CON', label: 'Spray Con', type: 'Sub-contractor' },
  { value: 'EMKAN', label: 'Emkan', type: 'Sub-contractor' },
  { value: 'ENERTEC', label: 'Enertec', type: 'Sub-contractor' },
  { value: 'CRYSTAL', label: 'Crystal', type: 'Sub-contractor' },
  { value: 'MEGATRONICS (GSO)', label: 'Megatronics (GSO)', type: 'GSO Supervision' },
  { value: 'ENERSERVE (GSO)', label: 'Enerserve (GSO)', type: 'GSO Supervision' },
  { value: 'ENERTEC (GSO)', label: 'Enertec (GSO)', type: 'GSO Supervision' },
  { value: 'NTC (GSO)', label: 'NTC (GSO)', type: 'GSO Supervision' },
  { value: 'MIR (GSO)', label: 'MIR (GSO)', type: 'GSO Supervision' },
  { value: 'ALTAF (GSO)', label: 'Altaf (GSO)', type: 'GSO Supervision' },
  { value: 'SWAN GLOBAL (GSO)', label: 'Swan Global (GSO)', type: 'GSO Supervision' },
  { value: 'SIGEL (GSO)', label: 'Sigel (GSO)', type: 'GSO Supervision' },
  { value: 'AL-RAMSHA (GSO)', label: 'Al-Ramsha (GSO)', type: 'GSO Supervision' },
  { value: 'ALTHAF (GSO)', label: 'Althaf (GSO)', type: 'GSO Supervision' },
  { value: 'ZEAL-IT', label: 'Zeal-IT', type: 'Sub-contractor' },
];

export const RLIC_STATUSES = [
  { value: 'VALID RLIC PASS', label: 'Valid' },
  { value: 'EXPIRED RLIC PASS', label: 'Expired' },
  { value: 'SOON TO EXPIRE', label: 'Soon to Expire' },
  { value: 'NO RLIC PASS', label: 'No Pass' },
];

export const PID_STATUSES = [
  { value: 'VALID PID PASS', label: 'Valid' },
  { value: 'EXPIRED PID PASS', label: 'Expired' },
  { value: 'SOON TO EXPIRE', label: 'Soon to Expire' },
  { value: 'NO PID PASS', label: 'No Pass' },
];

export const DEPARTMENTS = ['Electrical', 'Mechanical', 'Civil', 'Services'];
export const FTW_RESULTS = ['ACCEPTED', 'REJECTED', 'WAITING TR APPROVAL', 'RE-ASSESS'];
export const MEDICAL_RESULTS = [
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WAITING TR APPROVAL', label: 'Waiting TR Approval' },
  { value: 'RE-ASSESS', label: 'Re-Assess' },
];
export const TRAINING_STATUSES = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'ON-GOING', label: 'On-Going' },
  { value: 'DONE', label: 'Done' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'NOT REQUIRED', label: 'Not Required' },
];
export const LOCATIONS = ['QATAR', 'COMO CAMP', 'OTHER'];

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  // Parse date parts directly to avoid timezone shifting
  const parts = String(dateStr).split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  const [yyyy, mm, dd] = parts;
  if (!yyyy || !mm || !dd) return dateStr;
  return `${dd}/${mm}/${yyyy}`;
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  // Parse YYYY-MM-DD directly to avoid timezone shifting
  const parts = String(dateStr).split('T')[0].split('-');
  if (parts.length !== 3) return null;
  const [yyyy, mm, dd] = parts.map(Number);
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