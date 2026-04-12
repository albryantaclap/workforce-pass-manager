import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle2, AlertCircle, Upload, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { formatDate } from '@/utils/constants';

function toDateStr(val) {
  if (!val) return null;
  if (typeof val === 'string' && val.includes('-') && !val.includes('ASSESS') && !val.includes('ACCEPT')) {
    return val.split('T')[0].split(' ')[0];
  }
  return null;
}

export default function MedicalImport() {
  const [status, setStatus] = useState('idle'); // idle | extracting | matching | updating | done
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({ updated: 0, notFound: [], dupsRemoved: 0 });
  const [fileUrl, setFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 2000),
  });

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFileUrl(file_url);
    setUploading(false);
    toast({ title: 'File uploaded, ready to import' });
  };

  const runImport = async () => {
    if (!fileUrl) return;
    setStatus('extracting');
    setProgress(10);

    const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url: fileUrl,
      json_schema: {
        type: 'object',
        properties: {
          records: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                qid_no: { type: 'string', description: 'QID / VISA number' },
                pp_no: { type: 'string', description: 'Passport number' },
                pp_expiry: { type: 'string', description: 'Passport expiry date' },
                qid_expiry: { type: 'string', description: 'QID / DATE EXPIRATION' },
                nationality: { type: 'string' },
                religion: { type: 'string' },
                current_location: { type: 'string' },
                dir_indir: { type: 'string' },
                ftw_medical_date: { type: 'string', description: 'MEDICAL DATE' },
                ftw_received_date: { type: 'string', description: 'DATE RECEIVED FROM ALSAFA' },
                ftw_approval_request_date: { type: 'string', description: 'TR FTW APPROVAL DATE REQUEST' },
                ftw_count_days: { type: 'number', description: 'COUNT DAYS' },
                ftw_approved_date: { type: 'string', description: 'TR DATE APPROVED' },
                ftw_result: { type: 'string', description: 'RESULT' },
                ftw_doctor: { type: 'string', description: 'DOCTOR NAME' },
                ftw_mobile: { type: 'string', description: 'MOBILE NUMBER' },
              }
            }
          }
        }
      }
    });

    if (extracted.status !== 'success') {
      toast({ title: 'Extraction failed', variant: 'destructive' });
      setStatus('idle');
      return;
    }

    const records = extracted.output?.records || [];
    setStatus('matching');
    setProgress(40);

    // Build QID map from existing employees
    const qidMap = new Map();
    employees.forEach(emp => {
      if (emp.qid_no) qidMap.set(String(emp.qid_no).trim(), emp);
    });

    // Dedup employees by QID (keep first, collect dupes)
    const seen = new Set();
    const dupesToDelete = [];
    employees.forEach(emp => {
      if (!emp.qid_no) return;
      const key = String(emp.qid_no).trim();
      if (seen.has(key)) dupesToDelete.push(emp.id);
      else seen.add(key);
    });

    setStatus('updating');
    setProgress(50);

    let updated = 0;
    const notFound = [];
    const total = records.length;

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      const qid = rec.qid_no ? String(rec.qid_no).trim() : null;
      if (!qid) { notFound.push(rec.name); continue; }

      const emp = qidMap.get(qid);
      if (!emp) { notFound.push(`${rec.name} (QID: ${qid})`); continue; }

      const update = {};
      if (rec.ftw_medical_date) update.ftw_medical_date = toDateStr(rec.ftw_medical_date) || rec.ftw_medical_date;
      if (rec.ftw_received_date) update.ftw_received_date = toDateStr(rec.ftw_received_date) || rec.ftw_received_date;
      if (rec.ftw_approval_request_date) update.ftw_approval_request_date = toDateStr(rec.ftw_approval_request_date) || rec.ftw_approval_request_date;
      if (rec.ftw_count_days) update.ftw_count_days = rec.ftw_count_days;
      if (rec.ftw_approved_date && toDateStr(rec.ftw_approved_date)) update.ftw_approved_date = toDateStr(rec.ftw_approved_date);
      if (rec.ftw_result && ['ACCEPTED','REJECTED','PENDING','RE-ASSESS'].includes(rec.ftw_result)) update.ftw_result = rec.ftw_result;
      if (rec.ftw_doctor) update.ftw_doctor = rec.ftw_doctor;
      if (rec.ftw_mobile) update.ftw_mobile = String(rec.ftw_mobile);
      if (rec.nationality) update.nationality = rec.nationality;
      if (rec.religion) update.religion = rec.religion;
      if (rec.pp_no) update.pp_no = rec.pp_no;
      if (toDateStr(rec.pp_expiry)) update.pp_expiry = toDateStr(rec.pp_expiry);
      if (toDateStr(rec.qid_expiry)) update.qid_expiry = toDateStr(rec.qid_expiry);

      if (Object.keys(update).length > 0) {
        await base44.entities.Employee.update(emp.id, update);
        updated++;
      }
      setProgress(50 + Math.floor((i / total) * 40));
    }

    // Remove duplicates
    for (const id of dupesToDelete) {
      await base44.entities.Employee.delete(id);
    }

    setProgress(100);
    setStatus('done');
    setResults({ updated, notFound, dupsRemoved: dupesToDelete.length });
    queryClient.invalidateQueries({ queryKey: ['employees'] });
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/medical"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Medical Data Import</h2>
          <p className="text-sm text-muted-foreground">Match by QID and update medical fields</p>
        </div>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Step 1: Upload Medical Data File (xlsx)</p>
          <label className="cursor-pointer">
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} disabled={status !== 'idle'} />
            <Button type="button" variant="outline" disabled={uploading || status !== 'idle'} asChild>
              <span><Upload className="w-4 h-4 mr-2" />{uploading ? 'Uploading...' : fileUrl ? '✓ File Ready' : 'Choose File'}</span>
            </Button>
          </label>
          {fileUrl && <p className="text-xs text-green-600 mt-1">File ready for import</p>}
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Step 2: Run Import</p>
          <p className="text-xs text-muted-foreground mb-3">
            This will: (1) match records by QID number, (2) update medical fields, (3) remove duplicate QID records.
          </p>
          <Button onClick={runImport} disabled={!fileUrl || status !== 'idle'}>
            {status === 'idle' ? 'Run Import' : <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>}
          </Button>
        </div>

        {status !== 'idle' && status !== 'done' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{status === 'extracting' ? 'Extracting data...' : status === 'matching' ? 'Matching QIDs...' : 'Updating records...'}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {status === 'done' && (
          <div className="space-y-4 pt-2 border-t">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-green-700">{results.updated}</div>
                <div className="text-xs text-muted-foreground">Records Updated</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-blue-700">{results.dupsRemoved}</div>
                <div className="text-xs text-muted-foreground">Duplicates Removed</div>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-amber-700">{results.notFound.length}</div>
                <div className="text-xs text-muted-foreground">QID Not Matched</div>
              </div>
            </div>

            {results.notFound.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-2">Records not matched (QID not found in database):</p>
                <div className="max-h-40 overflow-auto bg-amber-50 rounded p-2 space-y-1">
                  {results.notFound.map((n, i) => <p key={i} className="text-xs text-amber-800">{n}</p>)}
                </div>
              </div>
            )}

            <Link to="/medical">
              <Button variant="outline" className="w-full">Go to Medical Tracker</Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}