import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, AlertCircle, Upload, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

function parseTsv(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const rawHeaders = lines[0].split('\t').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split('\t');
    const obj = {};
    rawHeaders.forEach((h, i) => { obj[h.toUpperCase().trim()] = (cols[i] || '').trim(); });
    return {
      qid_no: obj['QID'] || '',
      ftw_medical_date: obj['MEDICAL DATE'] || obj['MEDICAL DATE '] || '',
      ftw_received_date: obj['DATE RECEIVED FROM ALSAFA'] || '',
      ftw_approval_request_date: obj['TR FTW APPROVAL DATE REQUEST'] || '',
      ftw_approved_date: obj['TR DATE APPROVED'] || '',
      ftw_result: obj['RESULT'] || '',
      ftw_doctor: obj['DOCTOR NAME'] || '',
      ftw_mobile: obj['MOBILE NUMBER'] || '',
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
  const [results, setResults] = useState({ updated: 0, notFound: [], dupsRemoved: 0 });
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

    const isTxtOrTsv = file.name.endsWith('.txt') || file.name.endsWith('.tsv');
    if (isTxtOrTsv) {
      const text = await file.text();
      const records = parseTsv(text);
      setParsedRecords(records);
      setFileReady(true);
      toast({ title: `Parsed ${records.length} records from file` });
    } else {
      // xlsx/csv — upload to server
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setParsedRecords([{ __file_url__: file_url }]); // sentinel
      setFileReady(true);
      toast({ title: 'File uploaded, ready to import' });
    }
    setUploading(false);
  };

  const runImport = async () => {
    if (!fileReady) return;
    setStatus('extracting');
    setProgress(10);

    let records = parsedRecords;

    // If xlsx/csv uploaded to server, extract via AI
    if (records.length === 1 && records[0].__file_url__) {
      const fileUrl = records[0].__file_url__;
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
                  qid_no: { type: 'string' },
                  ftw_medical_date: { type: 'string' },
                  ftw_received_date: { type: 'string' },
                  ftw_approval_request_date: { type: 'string' },
                  ftw_approved_date: { type: 'string' },
                  ftw_result: { type: 'string' },
                  ftw_doctor: { type: 'string' },
                  ftw_mobile: { type: 'string' },
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
      records = extracted.output?.records || [];
    }

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
    const notFound = [];
    const total = records.length;

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      const qid = String(rec.qid_no || '').trim();
      if (!qid) continue;

      const emp = qidMap.get(qid);
      if (!emp) { notFound.push(qid); continue; }

      const update = {};
      const md = parseDate(rec.ftw_medical_date);
      const rd = parseDate(rec.ftw_received_date);
      const ard = parseDate(rec.ftw_approval_request_date);
      const ad = parseDate(rec.ftw_approved_date);
      const result = normalizeResult(rec.ftw_result);

      if (md) update.ftw_medical_date = md;
      if (rd) update.ftw_received_date = rd;
      if (ard) update.ftw_approval_request_date = ard;
      if (ad) update.ftw_approved_date = ad;
      if (result) update.ftw_result = result;
      if (rec.ftw_doctor) update.ftw_doctor = rec.ftw_doctor;
      if (rec.ftw_mobile) update.ftw_mobile = String(rec.ftw_mobile);

      if (Object.keys(update).length > 0) {
        await base44.entities.Employee.update(emp.id, update);
        updated++;
      }
      setProgress(40 + Math.floor((i / total) * 50));
    }

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

      <Card className="p-6 space-y-5">
        <div>
          <p className="text-sm font-medium mb-2">Step 1: Upload Medical Data File</p>
          <p className="text-xs text-muted-foreground mb-3">Accepted: .txt (tab-separated), .csv, .xlsx</p>
          <label className="cursor-pointer">
            <input type="file" accept=".xlsx,.xls,.csv,.txt,.tsv" className="hidden" onChange={handleFileChange} disabled={status !== 'idle'} />
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