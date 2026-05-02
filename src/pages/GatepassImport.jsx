import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, AlertCircle, Upload, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

function parseDate(val) {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}
  return null;
}

function normalizeRlic(val) {
  if (!val) return null;
  const v = val.toUpperCase().trim();
  if (v.includes('VALID') && !v.includes('EXPIRED') && !v.includes('SOON')) return 'VALID RLIC PASS';
  if (v.includes('EXPIRED')) return 'EXPIRED RLIC PASS';
  if (v.includes('SOON')) return 'SOON TO EXPIRE';
  if (v.includes('NO') || v.includes('NONE') || v === '') return 'NO RLIC PASS';
  return null;
}

function parseCsvOrTsv(text) {
  const clean = text.replace(/^\uFEFF/, '');
  const sep = clean.includes('\t') ? '\t' : ',';
  const lines = clean.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(sep).map(h => h.trim().toUpperCase());
  return lines.slice(1).map(line => {
    const cols = line.split(sep);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cols[i] || '').trim(); });
    return {
      qid_no: obj['QID_NO'] || obj['QID NO'] || obj['QID'] || '',
      name: obj['NAME'] || '',
      company: obj['COMPANY'] || '',
      nationality: obj['NATIONALITY'] || '',
      staff_no: obj['STAFF_NO'] || obj['STAFF NO'] || obj['RLIC'] || obj['STAFF NO / RLIC'] || '',
      gate_pass_issue_date: obj['GATE_PASS_ISSUE'] || obj['GATE PASS ISSUE'] || obj['ISSUE DATE'] || '',
      gate_pass_received_date: obj['GATE_PASS_RECEIVED'] || obj['GATE PASS RECEIVED'] || obj['RECEIVED'] || '',
      gate_pass_expiry: obj['GATE_PASS_EXPIRY'] || obj['GATE PASS EXPIRY'] || obj['EXPIRY'] || '',
      rlic_status: obj['RLIC_STATUS'] || obj['RLIC STATUS'] || obj['STATUS'] || '',
    };
  }).filter(r => r.qid_no);
}

export default function GatepassImport() {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({ updated: 0, created: 0, notFound: [] });
  const [fileReady, setFileReady] = useState(false);
  const [parsedRecords, setParsedRecords] = useState([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // No pre-fetch — per-record QID lookup used during import to avoid list limit issues

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const text = await file.text();
    const records = parseCsvOrTsv(text);
    setParsedRecords(records);
    setFileReady(true);
    toast({ title: `Parsed ${records.length} records from file` });
    setUploading(false);
  };

  const runImport = async () => {
    if (!fileReady) return;
    setStatus('updating');
    setProgress(10);

    // Deduplicate CSV rows by QID (last row wins)
    const rowsByQid = new Map();
    parsedRecords.forEach(rec => {
      const qid = String(rec.qid_no || '').trim();
      if (qid) rowsByQid.set(qid, rec);
    });

    const allEntries = [...rowsByQid.entries()];
    const total = allEntries.length;
    const sleep = (ms) => new Promise(res => setTimeout(res, ms));
    const BATCH = 10;

    let updated = 0, created = 0;
    const notFound = [];

    for (let i = 0; i < total; i += BATCH) {
      const chunk = allEntries.slice(i, i + BATCH);
      await Promise.all(chunk.map(async ([qid, rec]) => {
        const issueDate = parseDate(rec.gate_pass_issue_date);
        const receivedDate = parseDate(rec.gate_pass_received_date);
        const expiryDate = parseDate(rec.gate_pass_expiry);
        const rlicStatus = normalizeRlic(rec.rlic_status);

        // Per-record lookup — no list limit issues
        const matches = await base44.entities.Employee.filter({ qid_no: qid }, '-created_date', 1);

        if (matches.length === 0) {
          const newEmp = { qid_no: qid };
          if (rec.name) newEmp.name = rec.name;
          if (rec.company) newEmp.company = rec.company;
          if (rec.nationality) newEmp.nationality = rec.nationality;
          if (rec.staff_no) newEmp.staff_no = rec.staff_no;
          if (issueDate) newEmp.gate_pass_issue_date = issueDate;
          if (receivedDate) newEmp.gate_pass_received_date = receivedDate;
          if (expiryDate) newEmp.gate_pass_expiry = expiryDate;
          if (rlicStatus) newEmp.rlic_status = rlicStatus;
          await base44.entities.Employee.create(newEmp);
          created++;
        } else {
          const update = {};
          if (rec.staff_no) update.staff_no = rec.staff_no;
          if (issueDate) update.gate_pass_issue_date = issueDate;
          if (receivedDate) update.gate_pass_received_date = receivedDate;
          if (expiryDate) update.gate_pass_expiry = expiryDate;
          if (rlicStatus) update.rlic_status = rlicStatus;
          if (Object.keys(update).length > 0) {
            await base44.entities.Employee.update(matches[0].id, update);
            updated++;
          }
        }
      }));
      setProgress(10 + Math.round(((i + BATCH) / total) * 88));
      if (i + BATCH < total) await sleep(150);
    }

    setProgress(100);
    setStatus('done');
    setResults({ updated, created, notFound });
    queryClient.invalidateQueries({ queryKey: ['employees'] });
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/gatepass"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gate Pass Data Import</h2>
          <p className="text-sm text-muted-foreground">Match by QID and update gate pass / RLIC fields</p>
        </div>
      </div>

      <Card className="p-6 space-y-5">
        <div>
          <p className="text-sm font-medium mb-2">Step 1: Upload Gate Pass Data File</p>
          <p className="text-xs text-muted-foreground mb-3">Accepted: .csv or .txt (tab-separated). Columns: QID_No, Staff_No, Gate_Pass_Issue, Gate_Pass_Received, Gate_Pass_Expiry, RLIC_Status</p>
          <label className="cursor-pointer">
            <input type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleFileChange} disabled={status !== 'idle'} />
            <Button type="button" variant="outline" disabled={uploading || status !== 'idle'} asChild>
              <span>
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Reading...' : fileReady ? `✓ File Ready (${parsedRecords.length} records)` : 'Choose File'}
              </span>
            </Button>
          </label>
        </div>

        <div>
          <p className="text-sm font-medium mb-1">Step 2: Run Import</p>
          <p className="text-xs text-muted-foreground mb-3">Matches records by QID and updates gate pass / RLIC fields.</p>
          <Button onClick={runImport} disabled={!fileReady || status !== 'idle'}>
            {status === 'idle' ? 'Run Import' : <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>}
          </Button>
        </div>

        {status !== 'idle' && status !== 'done' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{status === 'matching' ? 'Matching QIDs...' : 'Updating records...'}</span>
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
              <div className="text-center p-3 bg-indigo-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-indigo-700">{results.created}</div>
                <div className="text-xs text-muted-foreground">Records Created</div>
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
            <Link to="/gatepass">
              <Button variant="outline" className="w-full">Go to Gate Pass Tracker</Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}