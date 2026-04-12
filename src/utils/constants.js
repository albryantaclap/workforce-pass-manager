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

export const FTW_RESULTS = ['ACCEPTED', 'REJECTED', 'PENDING', 'RE-ASSESS'];
export const TRAINING_STATUSES = ['DONE', 'PENDING', 'NOT REQUIRED'];
export const LOCATIONS = ['QATAR', 'COMO CAMP', 'OTHER'];

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
}

export function exportToCSV(data, filename) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => {
    const val = row[h] ?? '';
    return `"${String(val).replace(/"/g, '""')}"`;
  }).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}