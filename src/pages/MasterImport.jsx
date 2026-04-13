import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function MasterImport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const FIELD_MAP = {
    'SL': 'sl_no', 'SL No': 'sl_no', 'Serial': 'sl_no',
    'Name': 'name', 'Full Name': 'name',
    'Position (Application)': 'position_application', 'Position_Application': 'position_application', 'Position Application': 'position_application',
    'Designation (Org Chart)': 'designation_org_chart', 'Designation_Org_Chart': 'designation_org_chart', 'Designation Org Chart': 'designation_org_chart',
    'Department': 'department',
    'Company': 'company',
    'Company Type': 'company_type', 'Company_Type': 'company_type',
    'Nationality': 'nationality',
    'Religion': 'religion',
    'Location': 'current_location', 'Current Location': 'current_location',
    'DIR/INDIR': 'dir_indir', 'DIR_INDIR': 'dir_indir',
    'Contact': 'contact_details', 'Contact Details': 'contact_details',
    'Sponsor': 'sponsor',
    'Remarks': 'remarks',
    'QID No': 'qid_no', 'QID_No': 'qid_no', 'QID': 'qid_no',
    'QID Expiry': 'qid_expiry', 'QID_Expiry': 'qid_expiry',
    'Passport No': 'pp_no', 'Passport_No': 'pp_no', 'PP No': 'pp_no',
    'PP Expiry': 'pp_expiry', 'PP_Expiry': 'pp_expiry',
    'Visa Applied': 'visa_date_applied', 'Visa_Date_Applied': 'visa_date_applied',
    'Visa Received': 'visa_date_received', 'Visa_Date_Received': 'visa_date_received',
    'Visa Expiry': 'visa_expiry', 'Visa_Expiry': 'visa_expiry',
    'Medical Date': 'ftw_medical_date', 'FTW Medical Date': 'ftw_medical_date',
    'FTW Received': 'ftw_received_date', 'FTW_Received_Date': 'ftw_received_date',
    'FTW Approval Req': 'ftw_approval_request_date', 'FTW_Approval_Request': 'ftw_approval_request_date',
    'FTW Count Days': 'ftw_count_days', 'FTW_Count_Days': 'ftw_count_days',
    'FTW Approved': 'ftw_approved_date', 'FTW_Approved_Date': 'ftw_approved_date',
    'Medical Result': 'ftw_result', 'FTW Result': 'ftw_result',
    'Doctor': 'ftw_doctor',
    'Gate Pass Issue': 'gate_pass_issue_date', 'Gate_Pass_Issue': 'gate_pass_issue_date',
    'Gate Pass Received': 'gate_pass_received_date', 'Gate_Pass_Received': 'gate_pass_received_date',
    'Gate Pass Expiry': 'gate_pass_expiry', 'Gate_Pass_Expiry': 'gate_pass_expiry',
    'Staff No / RLIC': 'staff_no', 'Staff_No': 'staff_no', 'Staff No': 'staff_no',
    'RLIC Status': 'rlic_status', 'RLIC_Status': 'rlic_status',
    'PID No': 'pid', 'PID_No': 'pid',
    'PID Issue': 'pid_issue_date', 'PID_Issue_Date': 'pid_issue_date',
    'PID Expiry': 'pid_expiry', 'PID_Expiry': 'pid_expiry',
    'PID Projected': 'pid_projected_date', 'PID_Projected_Date': 'pid_projected_date',
    'PID Status': 'pid_status', 'PID_Status': 'pid_status',
    'Training Date': 'training_date', 'Training_Date': 'training_date',
    'Training Status': 'training_status', 'Training_Status': 'training_status',
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);

    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const schema = {
      type: 'object',
      properties: {
        rows: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sl_no: { type: 'number' }, name: { type: 'string' },
              position_application: { type: 'string' }, designation_org_chart: { type: 'string' },
              department: { type: 'string' }, company: { type: 'string' },
              company_type: { type: 'string' }, nationality: { type: 'string' },
              religion: { type: 'string' }, current_location: { type: 'string' },
              dir_indir: { type: 'string' }, contact_details: { type: 'string' },
              sponsor: { type: 'string' }, remarks: { type: 'string' },
              qid_no: { type: 'string' }, qid_expiry: { type: 'string' },
              pp_no: { type: 'string' }, pp_expiry: { type: 'string' },
              visa_date_applied: { type: 'string' }, visa_date_received: { type: 'string' },
              visa_expiry: { type: 'string' }, ftw_medical_date: { type: 'string' },
              ftw_received_date: { type: 'string' }, ftw_approval_request_date: { type: 'string' },
              ftw_count_days: { type: 'number' }, ftw_approved_date: { type: 'string' },
              ftw_result: { type: 'string' }, ftw_doctor: { type: 'string' },
              gate_pass_issue_date: { type: 'string' }, gate_pass_received_date: { type: 'string' },
              gate_pass_expiry: { type: 'string' }, staff_no: { type: 'string' },
              rlic_status: { type: 'string' }, pid: { type: 'string' },
              pid_issue_date: { type: 'string' }, pid_expiry: { type: 'string' },
              pid_projected_date: { type: 'string' }, pid_status: { type: 'string' },
              training_date: { type: 'string' }, training_status: { type: 'string' },
            }
          }
        }
      }
    };

    const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({ file_url, json_schema: schema });

    if (extracted.status !== 'success') {
      setResult({ success: false, message: extracted.details || 'Failed to extract data from file.' });
      setLoading(false);
      return;
    }

    const rows = extracted.output?.rows || (Array.isArray(extracted.output) ? extracted.output : []);
    const valid = rows.filter(r => r.name);

    const CHUNK = 50;
    let created = 0;
    for (let i = 0; i < valid.length; i += CHUNK) {
      await base44.entities.Employee.bulkCreate(valid.slice(i, i + CHUNK));
      created += Math.min(CHUNK, valid.length - i);
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
          <p className="text-sm text-muted-foreground">Upload a CSV or Excel file to import personnel records</p>
        </div>
      </div>

      <Card className="p-6 space-y-5">
        <div>
          <p className="text-sm font-medium mb-2">Supported formats: <span className="text-muted-foreground">.csv, .xlsx, .xls</span></p>
          <p className="text-sm text-muted-foreground">Column headers should match the Master List fields (e.g. Name, Company, QID No, etc.). New records will be added to the existing list.</p>
        </div>

        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => document.getElementById('master-file-input').click()}
        >
          <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          {file ? (
            <p className="font-medium text-sm">{file.name}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Click to select a file</p>
          )}
          <input
            id="master-file-input"
            type="file"
            accept=".csv,.xlsx,.xls"
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