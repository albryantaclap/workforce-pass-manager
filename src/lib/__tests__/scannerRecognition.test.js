// Scanner recognition verification — the exact employee from the fix request
// (PID 1021122) plus the regression cases. Pure logic only, no network.
import { describe, it, expect } from 'vitest';
import {
  normalizeScanId, extractScanCandidates, matchLoadedEmployees, uniqueRecords,
} from '../scannerRecognition';

// Fixture mirroring the real Master List records.
const TOLUWALOPE = { id: '69e4ab0768e40fa2a12530fe', name: 'TOLUWALOPE OLUWATOMI RAJI', pid: '1021122', qid_no: '28556601185', staff_no: '', pp_no: 'B01902971', company: 'PETROZIN (GSO)', personnel_status: '', is_active: true };
const OTHER = { id: 'other-1', name: 'SOMEONE ELSE', pid: '0099001', qid_no: '29900000001', staff_no: '88421', pp_no: 'X0000001' };
const NO_PID = { id: 'nopid-1', name: 'NO PID PERSON', pid: '', qid_no: '30000000002', staff_no: '', pp_no: 'Y0000002' };
const EMPLOYEES = [OTHER, NO_PID, TOLUWALOPE];

const scan = (text) => extractScanCandidates(text);
const match = (text, list = EMPLOYEES) => matchLoadedEmployees(scan(text), list);

describe('normalizeScanId', () => {
  it('strips whitespace, newlines, hidden characters and separators', () => {
    ['1021122', ' 1021122 ', '1021122\n', '1021122\r\n', '\t1021122\t', '102-1122', '102 1122', '\u200b1021122'].forEach((raw) => {
      expect(normalizeScanId(raw)).toBe('1021122');
    });
  });

  it('preserves leading zeros (never numeric conversion)', () => {
    expect(normalizeScanId('0099001')).toBe('0099001');
    expect(normalizeScanId(Number('0099001'))).toBe('99001'); // numeric input keeps its own digits
    expect(normalizeScanId(' 007 ')).toBe('007');
  });

  it('is case-insensitive and safe on odd values', () => {
    expect(normalizeScanId('b01902971')).toBe(normalizeScanId('B01902971'));
    expect(normalizeScanId(undefined)).toBe('');
    expect(normalizeScanId(null)).toBe('');
  });
});

describe('extractScanCandidates', () => {
  it('reads a plain PID', () => {
    expect(scan('1021122')).toContain('1021122');
  });

  it('reads a PID glued to its label, split by OCR or followed by a newline', () => {
    expect(scan('PID1021122')).toContain('1021122');
    expect(scan('102 1122')).toContain('1021122');
    expect(scan('1021122\n')).toContain('1021122');
    expect(scan('P.I.D: 1021122')).toContain('1021122');
  });

  it('reads both the QID and the PID printed on a card', () => {
    const ids = scan('QID 28556601185 PID 1021122');
    expect(ids).toContain('28556601185');
    expect(ids).toContain('1021122');
  });
});

describe('matchLoadedEmployees — PID is the primary identifier', () => {
  it('recognizes PID 1021122 (regression case 1)', () => {
    const r = match('1021122');
    expect(r.matches.map((e) => e.name)).toEqual(['TOLUWALOPE OLUWATOMI RAJI']);
    expect(r.field).toBe('pid');
  });

  it('recognizes the exact employee from the request even when the list is long', () => {
    const padded = [...Array(3000)].map((_, i) => ({ id: `pad-${i}`, name: `PAD ${i}`, pid: `7${String(i).padStart(6, '0')}` }));
    const r = match('1021122', [...padded, TOLUWALOPE]); // page 40 equivalent
    expect(r.matches[0]?.id).toBe(TOLUWALOPE.id);
  });

  it('recognizes a PID that arrives with scanner noise (regression case 3)', () => {
    [' 1021122 ', '1021122\r\n', 'PID1021122', '102 1122'].forEach((raw) => {
      expect(match(raw).matches[0]?.id).toBe(TOLUWALOPE.id);
    });
  });

  it('prefers PID over a QID that also matches someone else', () => {
    // OTHER owns pid 0099001; TOLUWALOPE owns the scanned QID — PID wins because
    // the PID field is searched first across all candidates.
    const r = match('0099001 28556601185');
    expect(r.field).toBe('pid');
    expect(r.matches[0]?.id).toBe(OTHER.id);
  });

  it('falls back to QID when no record owns the value as PID', () => {
    const r = match('30000000002');
    expect(r.field).toBe('qid_no');
    expect(r.matches[0]?.id).toBe(NO_PID.id);
  });

  it('falls back to passport / staff number when needed', () => {
    expect(match('88421').matches[0]?.id).toBe(OTHER.id);
    expect(match('B01902971').matches[0]?.id).toBe(TOLUWALOPE.id);
  });

  it('never treats an empty stored value as a match', () => {
    expect(match('', EMPLOYEES).matches).toEqual([]);
    expect(match('   ', EMPLOYEES).matches).toEqual([]);
  });

  it('returns a clean miss for an unknown card (case 7)', () => {
    const r = match('99999999');
    expect(r.matches).toEqual([]);
    expect(r.field).toBeNull();
  });

  it('reports duplicates instead of picking one (case 8)', () => {
    const duplicate = { ...TOLUWALOPE, id: 'dup-2' };
    const r = match('1021122', [TOLUWALOPE, duplicate]);
    expect(r.matches).toHaveLength(2);
    expect(uniqueRecords(r.matches).map((m) => m.id).sort()).toEqual([TOLUWALOPE.id, 'dup-2']);
  });

  it('does not double-count the same record reached twice', () => {
    const r = matchLoadedEmployees(scan('PID1021122 1021122\n'), [TOLUWALOPE]);
    expect(r.matches).toHaveLength(1);
  });

  it('accepts a valid PID regardless of which Master List page it sits on (case 5)', () => {
    const roster = [...Array(500)].map((_, i) => ({ id: `r-${i}`, name: `R ${i}`, pid: `8${String(i).padStart(6, '0')}` })).concat([TOLUWALOPE]);
    expect(match('1021122', roster).matches[0]?.id).toBe(TOLUWALOPE.id);
  });
});