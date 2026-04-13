import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Maps CSV column headers → entity field names
const COL_MAP = {
  'sl': 'sl_no', 'sl no': 'sl_no',
  'name': 'name',
  'position_application': 'position_application', 'position application': 'position_application', 'position (application)': 'position_application',
  'designation_org_chart': 'designation_org_chart', 'designation org chart': 'designation_org_chart', 'designation (org chart)': 'designation_org_chart',
  'department': 'department',
  'company': 'company',
  'company_type': 'company_type', 'company type': 'company_type',
  'nationality': 'nationality',
  'religion': 'religion',
  'location': 'current_location', 'current_location': 'current_location', 'current location': 'current_location',
  'dir_indir': 'dir_indir', 'dir/indir': 'dir_indir',
  'contact': 'contact_details', 'contact_details': 'contact_details', 'contact details': 'contact_details',
  'sponsor': 'sponsor',
  'remarks': 'remarks',
  'qid_no': 'qid_no', 'qid no': 'qid_no', 'qid': 'qid_no',
  'qid_expiry': 'qid_expiry', 'qid expiry': 'qid_expiry',
  'passport_no': 'pp_no', 'passport no': 'pp_no', 'pp no': 'pp_no', 'pp_no': 'pp_no',
  'pp_expiry': 'pp_expiry', 'pp expiry': 'pp_expiry', 'passport expiry': 'pp_expiry',
  'visa_date_applied': 'visa_date_applied', 'visa date applied': 'visa_date_applied', 'visa applied': 'visa_date_applied',
  'visa_date_received': 'visa_date_received', 'visa date received': 'visa_date_received', 'visa received': 'visa_date_received',
  'visa_expiry': 'visa_expiry', 'visa expiry': 'visa_expiry',
  'medical_date': 'ftw_medical_date', 'ftw medical date': 'ftw_medical_date', 'ftw_medical_date': 'ftw_medical_date',
  'ftw_received_date': 'ftw_received_date', 'ftw received date': 'ftw_received_date',
  'ftw_approval_request': 'ftw_approval_request_date', 'ftw approval request': 'ftw_approval_request_date', 'ftw_approval_request_date': 'ftw_approval_request_date',
  'ftw_count_days': 'ftw_count_days', 'ftw count days': 'ftw_count_days',
  'ftw_approved_date': 'ftw_approved_date', 'ftw approved date': 'ftw_approved_date',
  'medical_result': 'ftw_result', 'ftw result': 'ftw_result', 'ftw_result': 'ftw_result',
  'doctor': 'ftw_doctor',
  'doctor_mobile': 'ftw_mobile', 'doctor mobile': 'ftw_mobile',
  'gate_pass_issue': 'gate_pass_issue_date', 'gate pass issue': 'gate_pass_issue_date', 'gate_pass_issue_date': 'gate_pass_issue_date',
  'gate_pass_received': 'gate_pass_received_date', 'gate pass received': 'gate_pass_received_date', 'gate_pass_received_date': 'gate_pass_received_date',
  'gate_pass_expiry': 'gate_pass_expiry', 'gate pass expiry': 'gate_pass_expiry',
  'staff_no': 'staff_no', 'staff no': 'staff_no', 'staff no / rlic': 'staff_no',
  'rlic_status': 'rlic_status', 'rlic status': 'rlic_status',
  'pid_no': 'pid', 'pid no': 'pid',
  'pid_issue_date': 'pid_issue_date', 'pid issue date': 'pid_issue_date', 'pid issue': 'pid_issue_date',
  'pid_expiry': 'pid_expiry', 'pid expiry': 'pid_expiry',
  'pid_projected_date': 'pid_projected_date', 'pid projected date': 'pid_projected_date', 'pid projected': 'pid_projected_date',
  'pid_status': 'pid_status', 'pid status': 'pid_status',
  'training_date': 'training_date', 'training date': 'training_date',
  'training_status': 'training_status', 'training status': 'training_status',
};

function parseCSV(text) {
  // Remove BOM if present
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const mappedHeaders = headers.map(h => COL_MAP[h.toLowerCase()] || null);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    mappedHeaders.forEach((field, idx) => {
      if (field && vals[idx] !== undefined && vals[idx] !== '') {
        row[field] = vals[idx];
      }
    });
    if (row.name) rows.push(row);
  }
  return rows;
}

export default function MasterImport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      setResult({ success: false, message: 'No valid rows found. Make sure the file has a "Name" column.' });
      setLoading(false);
      return;
    }

    const CHUNK = 50;
    let created = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      await base44.entities.Employee.bulkCreate(rows.slice(i, i + CHUNK));
      created += Math.min(CHUNK, rows.length - i);
    }

    setResult({ success: true, message: `Successfully imported ${created} records.` });
    toast({ title: `Imported ${created} records` });
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
          <p className="text-sm font-medium mb-1">Accepted format: <span className="text-muted-foreground">.csv</span></p>
          <p className="text-sm text-muted-foreground">Column headers should match the Master List fields (e.g. Name, Company, QID_No, etc.). New records will be appended to the existing list.</p>
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
            onChange={(e) => { setFile(e.target.files[0]); setResult(null); }}
          />
        </div>

        {result && (
          <div className={`flex items-center gap-3 p-4 rounded-lg ${result.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {result.success ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <p className="text-sm font-medium">{result.message}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={handleImport} disabled={!file || loading} className="flex-1">
            {loading ? 'Importing...' : 'Import Records'}
          </Button>
          {result?.success && (
            <Button variant="outline" onClick={() => navigate('/master-list')}>Back to Master List</Button>
          )}
        </div>
      </Card>
    </div>
  );
}