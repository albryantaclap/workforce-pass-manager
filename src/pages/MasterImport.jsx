import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Direct CSV column → entity field mapping
const COL_MAP = {
  'SL': 'sl_no',
  'Name': 'name',
  'Position_Application': 'position_application',
  'Designation_Org_Chart': 'designation_org_chart',
  'Department': 'department',
  'Company': 'company',
  'Company_Type': 'company_type',
  'Nationality': 'nationality',
  'Religion': 'religion',
  'Location': 'current_location',
  'DIR_INDIR': 'dir_indir',
  'Contact': 'contact_details',
  'Sponsor': 'sponsor',
  'Remarks': 'remarks',
  'QID_No': 'qid_no',
  'QID_Expiry': 'qid_expiry',
  'Passport_No': 'pp_no',
  'PP_Expiry': 'pp_expiry',
  'Visa_Date_Applied': 'visa_date_applied',
  'Visa_Date_Received': 'visa_date_received',
  'Visa_Expiry': 'visa_expiry',
  'Medical_Date': 'ftw_medical_date',
  'FTW_Received_Date': 'ftw_received_date',
  'FTW_Approval_Request': 'ftw_approval_request_date',
  'FTW_Count_Days': 'ftw_count_days',
  'FTW_Approved_Date': 'ftw_approved_date',
  'Medical_Result': 'ftw_result',
  'Doctor': 'ftw_doctor',
  'Doctor_Mobile': 'ftw_mobile',
  'Gate_Pass_Issue': 'gate_pass_issue_date',
  'Gate_Pass_Received': 'gate_pass_received_date',
  'Gate_Pass_Expiry': 'gate_pass_expiry',
  'Staff_No': 'staff_no',
  'RLIC_Status': 'rlic_status',
  'PID_No': 'pid',
  'PID_Issue_Date': 'pid_issue_date',
  'PID_Expiry': 'pid_expiry',
  'PID_Projected_Date': 'pid_projected_date',
  'PID_Status': 'pid_status',
  'Training_Date': 'training_date',
  'Training_Status': 'training_status',
};

// Normalize status values to match entity enums
const RLIC_MAP = {
  'no pass': 'NO RLIC PASS',
  'valid': 'VALID RLIC PASS',
  'expired': 'EXPIRED RLIC PASS',
  'soon to expire': 'SOON TO EXPIRE',
  'valid rlic pass': 'VALID RLIC PASS',
  'expired rlic pass': 'EXPIRED RLIC PASS',
  'no rlic pass': 'NO RLIC PASS',
};
const PID_MAP = {
  'no pass': 'NO PID PASS',
  'valid': 'VALID PID PASS',
  'expired': 'EXPIRED PID PASS',
  'soon to expire': 'SOON TO EXPIRE',
  'valid pid pass': 'VALID PID PASS',
  'expired pid pass': 'EXPIRED PID PASS',
  'no pid pass': 'NO PID PASS',
};
const MEDICAL_MAP = {
  'accepted': 'ACCEPTED', 'rejected': 'REJECTED', 'pending': 'PENDING', 're-assess': 'RE-ASSESS',
};
const TRAINING_MAP = {
  'done': 'DONE', 'pending': 'PENDING', 'not required': 'NOT REQUIRED',
};

// Month name abbreviation map for formats like "05-Oct-26"
const MONTH_MAP = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function parseImportDate(raw) {
  if (!raw) return null;
  const s = raw.trim();

  // Already ISO: 2026-02-23
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // dd/mm/yyyy or dd-mm-yyyy
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;

  // 05-Oct-26 or 05-Oct-2026
  const dmonY = s.match(/^(\d{1,2})[\/\-]([a-zA-Z]{3})[\/\-](\d{2,4})$/);
  if (dmonY) {
    const mon = MONTH_MAP[dmonY[2].toLowerCase()];
    if (mon) {
      let year = parseInt(dmonY[3]);
      if (year < 100) year += year >= 50 ? 1900 : 2000;
      return `${year}-${mon}-${dmonY[1].padStart(2,'0')}`;
    }
  }

  // Fallback: try native Date parse
  const d = new Date(s);
  if (!isNaN(d)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

// Date field names (entity keys)
const DATE_FIELDS = new Set([
  'qid_expiry','pp_expiry','visa_date_applied','visa_date_received','visa_expiry',
  'ftw_medical_date','ftw_received_date','ftw_approval_request_date','ftw_approved_date',
  'ftw_reassess_date','gate_pass_issue_date','gate_pass_received_date','gate_pass_expiry',
  'pid_issue_date','pid_expiry','pid_projected_date','training_date_start','training_date_end','training_date',
]);

function parseCSV(text) {
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse header - strip BOM from first header too
  const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, ''));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    try {
      const values = lines[i].split(',');
      const obj = {};
      headers.forEach((h, idx) => {
        const field = COL_MAP[h];
        if (!field) return;
        const raw = (values[idx] || '').trim();
        if (!raw) return;

        if (field === 'sl_no' || field === 'ftw_count_days') {
          const n = parseFloat(raw);
          if (!isNaN(n)) obj[field] = n;
        } else if (field === 'rlic_status') {
          obj[field] = RLIC_MAP[raw.toLowerCase()] || raw;
        } else if (field === 'pid_status') {
          obj[field] = PID_MAP[raw.toLowerCase()] || raw;
        } else if (field === 'ftw_result') {
          obj[field] = MEDICAL_MAP[raw.toLowerCase()] || raw;
        } else if (field === 'training_status') {
          obj[field] = TRAINING_MAP[raw.toLowerCase()] || raw;
        } else if (DATE_FIELDS.has(field)) {
          const parsed = parseImportDate(raw);
          if (parsed) obj[field] = parsed;
        } else {
          obj[field] = raw;
        }
      });
      if (obj.name) rows.push(obj);
    } catch (e) {
      // Skip bad rows, never stop
    }
  }
  return rows;
}

export default function MasterImport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(0);

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setProgress(0);

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      setResult({ success: false, message: 'No valid records found. Make sure the file has a "Name" column.' });
      setLoading(false);
      return;
    }

    // Fetch all existing employees to match by QID No
    const existing = await base44.entities.Employee.list('-created_date', 5000);
    const byQid = {};
    existing.forEach(e => { if (e.qid_no) byQid[e.qid_no.trim()] = e; });

    let created = 0, updated = 0, failed = 0;
    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        const qid = row.qid_no ? row.qid_no.trim() : null;
        if (qid && byQid[qid]) {
          await base44.entities.Employee.update(byQid[qid].id, row);
          updated++;
        } else {
          await base44.entities.Employee.create(row);
          created++;
        }
      } catch (e) {
        failed++;
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }

    setResult({ success: true, message: `Import complete: ${created} created, ${updated} updated${failed > 0 ? `, ${failed} failed` : ''}.` });
    toast({ title: `Import complete: ${created} created, ${updated} updated${failed > 0 ? `, ${failed} failed` : ''}` });
    setLoading(false);
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/master-list')}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Import Master List</h2>
          <p className="text-sm text-muted-foreground">Upload a CSV file to import personnel records</p>
        </div>
      </div>

      <Card className="p-6 space-y-5">
        <div>
          <p className="text-sm font-medium mb-1">Expected format: <span className="text-muted-foreground">CSV with headers matching the Master List columns</span></p>
          <p className="text-xs text-muted-foreground">e.g. Name, Company, QID_No, RLIC_Status, PID_Status, Training_Status…</p>
        </div>

        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => document.getElementById('master-file-input').click()}
        >
          <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          {file ? (
            <p className="font-medium text-sm">{file.name}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Click to select a CSV file</p>
          )}
          <input
            id="master-file-input"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { setFile(e.target.files[0]); setResult(null); setProgress(0); }}
          />
        </div>

        {loading && (
          <div className="space-y-1">
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground text-center">Importing… {progress}%</p>
          </div>
        )}

        {result && (
          <div className={`flex items-center gap-3 p-4 rounded-lg ${result.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {result.success ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <p className="text-sm font-medium">{result.message}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={handleImport} disabled={!file || loading} className="flex-1">
            {loading ? `Importing… ${progress}%` : 'Import Records'}
          </Button>
          {result?.success && (
            <Button variant="outline" onClick={() => navigate('/master-list')}>Back to Master List</Button>
          )}
        </div>
      </Card>
    </div>
  );
}