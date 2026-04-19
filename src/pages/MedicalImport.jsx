import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, AlertCircle, Upload, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

function parseFile(text) {
  const clean = text.replace(/^\uFEFF/, '');
  const isTsv = clean.includes('\t');
  const sep = isTsv ? '\t' : ',';
  const lines = clean.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const rawHeaders = lines[0].split(sep).map(h => h.trim().toUpperCase().replace(/^\uFEFF/, ''));
  return lines.slice(1).map(line => {
    const cols = line.split(sep);
    const obj = {};
    rawHeaders.forEach((h, i) => { obj[h] = (cols[i] || '').trim(); });
    return {
      qid_no: obj['QID_NO'] || obj['QID NO'] || obj['QID'] || '',
      name: obj['NAME'] || '',
      company: obj['COMPANY'] || '',
      nationality: obj['NATIONALITY'] || '',
      pp_no: obj['PP_NO'] || obj['PP NO'] || '',
      ftw_medical_date: obj['MEDICAL_DATE'] || obj['MEDICAL DATE'] || obj['MEDICAL DATE '] || '',
      ftw_received_date: obj['RECEIVED_DATE'] || obj['DATE RECEIVED FROM ALSAFA'] || obj['RECEIVED DATE'] || '',
      ftw_approval_request_date: obj['APPROVAL_REQUEST'] || obj['TR FTW APPROVAL DATE REQUEST'] || obj['APPROVAL REQUEST'] || '',
      ftw_count_days: obj['COUNT_DAYS'] || obj['COUNT DAYS'] || '',
      ftw_approved_date: obj['APPROVED_DATE'] || obj['TR DATE APPROVED'] || obj['APPROVED DATE'] || '',
      ftw_result: obj['RESULT'] || '',
      ftw_doctor: obj['DOCTOR'] || obj['DOCTOR NAME'] || '',
      ftw_mobile: obj['MOBILE'] || obj['MOBILE NUMBER'] || '',
    };
  }).filter(r => r.qid_no && r.qid_no.trim());
}

function parseDate(val) {
  if (!val) return null;
  const skip = ['ALSAFA', 'HOLD', 'ON LEAVE', 'RECALLED', 'APPLIED', 'REJECTED', 'ON-HOLD', 'HOLD', 'LEAVE'];
  const up = val.toUpperCase();
  if (skip.some(s => up.includes(s)) || up.includes('ASSESS') || up.includes('MEDICAL') || up.includes('WAITING') || up.includes('DIDN')) return null;
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}
  return null;
}

function normalizeResult(val) {
  if (!val) return null;
  const v = val.toUpperCase();
  if (v === 'ACCEPTED' || v === 'FIT') return 'ACCEPTED';
  if (v === 'REJECTED') return 'REJECTED';
  if (v === 'PENDING') return 'PENDING';
  if (v === 'RE-ASSESS' || v.includes('RAHA') || v.includes('REPEAT') || v.includes('NEED') || v.includes('ASSESS')) return 'RE-ASSESS';
  return null;
}

export default function MedicalImport() {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({ updated: 0, created: 0, notFound: [], dupsRemoved: 0 });
  const [fileReady, setFileReady] = useState(false);
  const [parsedRecords, setParsedRecords] = useState([]);
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
    const text = await file.text();
    const records = parseFile(text);
    setParsedRecords(records);
    setFileReady(true);
    toast({ title: `Parsed ${records.length} records from file` });
    setUploading(false);
  };

  const runImport = async () => {
    if (!fileReady) return;
    setStatus('extracting');
    setProgress(10);

    let records = parsedRecords;

    setStatus('matching');
    setProgress(30);

    // Build QID map
    const qidMap = new Map();
    const seen = new Set();
    const dupesToDelete = [];
    employees.forEach(emp => {
      if (!emp.qid_no) return;
      const key = String(emp.qid_no).trim();
      if (seen.has(key)) dupesToDelete.push(emp.id);
      else { seen.add(key); qidMap.set(key, emp); }
    });

    setStatus('updating');
    setProgress(40);

    let updated = 0;
    let created = 0;
    const notFound = [];
    const total = records.length;
    const sleep = (ms) => new Promise(res => setTimeout(res, ms));
    const BATCH_SIZE = 3;
    const DELAY_MS = 800;

    const apiCall = async (fn, retries = 3) => {
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          return await fn();
        } catch (err) {
          if (err?.message?.includes('Rate limit') && attempt < retries - 1) {
            await sleep(2000 * (attempt + 1));
          } else {
            throw err;
          }
        }
      }
    };

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      const qid = String(rec.qid_no || '').trim();
      if (!qid) continue;

      const emp = qidMap.get(qid);

      const md = parseDate(rec.ftw_medical_date);
      const rd = parseDate(rec.ftw_received_date);
      const ard = parseDate(rec.ftw_approval_request_date);
      const ad = parseDate(rec.ftw_approved_date);
      const result = normalizeResult(rec.ftw_result);

      if (!emp) {
        const newEmp = { qid_no: qid };
        if (rec.name) newEmp.name = rec.name;
        if (rec.company) newEmp.company = rec.company;
        if (rec.nationality) newEmp.nationality = rec.nationality;
        if (rec.pp_no) newEmp.pp_no = rec.pp_no;
        if (md) newEmp.ftw_medical_date = md;
        if (rd) newEmp.ftw_received_date = rd;
        if (ard) newEmp.ftw_approval_request_date = ard;
        if (ad) newEmp.ftw_approved_date = ad;
        if (result) newEmp.ftw_result = result;
        if (rec.ftw_doctor) newEmp.ftw_doctor = rec.ftw_doctor;
        if (rec.ftw_mobile) newEmp.ftw_mobile = String(rec.ftw_mobile);
        await apiCall(() => base44.entities.Employee.create(newEmp));
        created++;
      } else {
        const update = {};
        if (md) update.ftw_medical_date = md;
        if (rd) update.ftw_received_date = rd;
        if (ard) update.ftw_approval_request_date = ard;
        if (ad) update.ftw_approved_date = ad;
        if (result) update.ftw_result = result;
        if (rec.ftw_doctor) update.ftw_doctor = rec.ftw_doctor;
        if (rec.ftw_mobile) update.ftw_mobile = String(rec.ftw_mobile);
        if (Object.keys(update).length > 0) {
          await apiCall(() => base44.entities.Employee.update(emp.id, update));
          updated++;
        }
      }

      if ((i + 1) % BATCH_SIZE === 0) await sleep(DELAY_MS);
      setProgress(40 + Math.floor((i / total) * 48));
    }

    for (let i = 0; i < dupesToDelete.length; i++) {
      await apiCall(() => base44.entities.Employee.delete(dupesToDelete[i]));
      if ((i + 1) % BATCH_SIZE === 0) await sleep(DELAY_MS);
    }

    setProgress(100);
    setStatus('done');
    setResults({ updated, created, notFound, dupsRemoved: dupesToDelete.length });
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

      <Card className="p-6 space-y-5">
        <div>
          <p className="text-sm font-medium mb-2">Step 1: Upload Medical Data File</p>
          <p className="text-xs text-muted-foreground mb-3">Accepted: .csv or .txt (tab-separated). Columns: QID_No, Medical_Date, Received_Date, Approval_Request, Approved_Date, Result, Doctor, Mobile</p>
          <label className="cursor-pointer">
            <input type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleFileChange} disabled={status !== 'idle'} />
            <Button type="button" variant="outline" disabled={uploading || status !== 'idle'} asChild>
              <span>
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Reading...' : fileReady ? `✓ File Ready (${parsedRecords.length} records parsed)` : 'Choose File'}
              </span>
            </Button>
          </label>
        </div>

        <div>
          <p className="text-sm font-medium mb-1">Step 2: Run Import</p>
          <p className="text-xs text-muted-foreground mb-3">
            Matches records by QID, updates medical fields, removes duplicate QID records.
          </p>
          <Button onClick={runImport} disabled={!fileReady || status !== 'idle'}>
            {status === 'idle' ? 'Run Import' : <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>}
          </Button>
        </div>

        {status !== 'idle' && status !== 'done' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {status === 'extracting' ? 'Extracting data...' : status === 'matching' ? 'Matching QIDs...' : 'Updating records...'}
              </span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {status === 'done' && (
          <div className="space-y-4 pt-2 border-t">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-green-700">{results.updated}</div>
                <div className="text-xs text-muted-foreground">Records Updated</div>
              </div>
              <div className="text-center p-3 bg-indigo-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-indigo-700">{results.created}</div>
                <div className="text-xs text-muted-foreground">Records Created</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-blue-700">{results.dupsRemoved}</div>
                <div className="text-xs text-muted-foreground">Duplicates Removed</div>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-amber-700">{results.notFound.length}</div>
                <div className="text-xs text-muted-foreground">Skipped (No QID)</div>
              </div>
            </div>

            {results.notFound.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-2">QIDs not found in database:</p>
                <div className="max-h-40 overflow-auto bg-amber-50 rounded p-2 space-y-1">
                  {results.notFound.map((n, i) => <p key={i} className="text-xs text-amber-800 font-mono">{n}</p>)}
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