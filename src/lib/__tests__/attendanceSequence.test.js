// Temporary verification of the punch-sequence rules against the live Night
// Shift configuration (cases A–H of the fix request). Not part of the app.
import { describe, it, expect } from 'vitest';
import {
  resolvePunchWindow, determineSplitExpectedPunch, validatePunchSequence,
  getRecordSequenceIssue, calculateDailyStatus, isSplitEffective,
} from '../attendanceEngine';

const q = (d) => d ? d.toLocaleString('en-GB', { timeZone: 'Asia/Qatar', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
const iso = (dateStr, h, m) => { const [y, mo, d] = dateStr.split('-').map(Number); return new Date(Date.UTC(y, mo - 1, d, h, m) - 180 * 60000).toISOString(); };
const DATE = '2026-09-27';

const NIGHT = {
  id: 'night', shift_name: 'Night Shift', start_time: '18:00', end_time: '05:00', cross_midnight: true,
  split_shift_enabled: true, split_effective_from: '2026-09-01', split_effective_to: '2027-11-30',
  split_first_in_start: '18:00', split_first_in_enable_before_min: 15, split_first_in_cutoff: '18:30',
  split_first_out_required: true, split_first_out_target: '23:00', split_first_out_enable_before_min: 15, split_first_out_window_min: 35,
  split_second_in_required: true, split_second_in_target: '01:00', split_second_in_enable_before_min: 15, split_second_in_window_min: 40,
  split_final_out_earliest: '05:00', split_final_out_enable_before_min: 15, split_final_out_latest: '06:30',
};
const DEFAULT_SHIFT = { id: 'default', shift_name: 'Default Shift', start_time: '07:00', end_time: '17:00', cross_midnight: false };
const SETTINGS = { half_day_threshold_hours: 4, auto_close_buffer_minutes: 120 };

const FI = iso(DATE, 18, 5), FOUT = iso(DATE, 23, 0), SI = iso('2026-09-28', 0, 55), FOUTT = iso('2026-09-28', 4, 50);
const scan = (expected, ts) => { const w = resolvePunchWindow(expected, NIGHT, DATE); const t = new Date(ts).getTime(); return t < w.earliest.getTime() || t > w.latest.getTime() ? 'REJECT' : 'ACCEPT'; };

describe('split-shift punch windows (absolute datetimes)', () => {
  it('A/B first-in and first-out on the shift-start date', () => {
    expect(q(resolvePunchWindow('FIRST_IN', NIGHT, DATE).earliest)).toBe('27/09/2026, 17:45');
    expect(q(resolvePunchWindow('FIRST_IN', NIGHT, DATE).latest)).toBe('27/09/2026, 18:30');
    expect(q(resolvePunchWindow('FIRST_OUT', NIGHT, DATE).earliest)).toBe('27/09/2026, 22:45');
    expect(q(resolvePunchWindow('FIRST_OUT', NIGHT, DATE).latest)).toBe('27/09/2026, 23:35');
  });
  it('C/D second-in and final-out roll to the next calendar day', () => {
    expect(q(resolvePunchWindow('SECOND_IN', NIGHT, DATE).earliest)).toBe('28/09/2026, 00:45');
    expect(q(resolvePunchWindow('SECOND_IN', NIGHT, DATE).latest)).toBe('28/09/2026, 01:40');
    expect(q(resolvePunchWindow('FINAL_OUT', NIGHT, DATE).earliest)).toBe('28/09/2026, 04:45');
    expect(q(resolvePunchWindow('FINAL_OUT', NIGHT, DATE).latest)).toBe('28/09/2026, 06:30');
    expect(isSplitEffective(NIGHT, DATE)).toBe(true);
  });
});

describe('next expected punch comes from stored punches, never the clock', () => {
  it('advances only through the required sequence', () => {
    expect(determineSplitExpectedPunch({}, NIGHT)).toBe('FIRST_IN');
    expect(determineSplitExpectedPunch({ first_in_at: FI }, NIGHT)).toBe('FIRST_OUT');
    expect(determineSplitExpectedPunch({ first_in_at: FI, first_out_at: FOUT }, NIGHT)).toBe('SECOND_IN');
    expect(determineSplitExpectedPunch({ first_in_at: FI, first_out_at: FOUT, second_in_at: SI }, NIGHT)).toBe('FINAL_OUT');
    expect(determineSplitExpectedPunch({ first_in_at: FI, first_out_at: FOUT, second_in_at: SI, final_out_at: FOUTT }, NIGHT)).toBeNull();
  });
  it('E/F a scan never jumps a missing stage', () => {
    expect(scan('FIRST_OUT', iso('2026-09-28', 1, 0))).toBe('REJECT');
    expect(scan('SECOND_IN', iso('2026-09-28', 5, 0))).toBe('REJECT');
    expect(scan('FIRST_OUT', iso(DATE, 23, 0))).toBe('ACCEPT');
    expect(scan('SECOND_IN', iso('2026-09-28', 1, 0))).toBe('ACCEPT');
  });
});

describe('sequence validation', () => {
  it('rejects the reported corrupted record, naming the expected punch', () => {
    const corrupted = { attendance_date: DATE, first_in_at: FI, first_out_at: '', second_in_at: '', final_out_at: FOUTT };
    const { blocked } = validatePunchSequence(corrupted, NIGHT, SETTINGS);
    expect(blocked.some((m) => m.includes('Expected punch: FIRST OUT'))).toBe(true);
    expect(getRecordSequenceIssue(corrupted, NIGHT)).toBeTruthy();
  });
  it('accepts a valid cross-midnight sequence (full datetimes)', () => {
    const valid = { attendance_date: DATE, first_in_at: FI, first_out_at: FOUT, second_in_at: SI, final_out_at: FOUTT };
    const r = validatePunchSequence(valid, NIGHT, SETTINGS, { enforceWindows: true });
    expect(r.blocked).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
  it('rejects out-of-order and FIRST-IN-less punches', () => {
    const unordered = { attendance_date: DATE, first_in_at: FI, first_out_at: FOUT, second_in_at: iso(DATE, 12, 0), final_out_at: FOUTT };
    expect(validatePunchSequence(unordered, NIGHT, SETTINGS).blocked.some((m) => m.includes('cannot be earlier'))).toBe(true);
    expect(validatePunchSequence({ attendance_date: DATE, first_in_at: '', final_out_at: FOUTT }, NIGHT, SETTINGS).blocked.length).toBeGreaterThan(0);
  });
  it('H leaves normal 2-punch days untouched', () => {
    const normalDay = { attendance_date: DATE, first_in_at: iso(DATE, 7, 0), first_out_at: '', second_in_at: '', final_out_at: iso(DATE, 17, 0) };
    expect(validatePunchSequence(normalDay, DEFAULT_SHIFT, SETTINGS).blocked).toEqual([]);
    expect(getRecordSequenceIssue(normalDay, DEFAULT_SHIFT)).toBeNull();
  });
  it('warns (never silently moves) a punch outside its window', () => {
    const outside = { attendance_date: DATE, first_in_at: iso(DATE, 1, 12), first_out_at: '', second_in_at: '', final_out_at: '' };
    expect(validatePunchSequence(outside, NIGHT, SETTINGS, { enforceWindows: true }).warnings.length).toBeGreaterThan(0);
  });
  it('COMO Camp / Personnel Form sessions stay independent of the split sequence', () => {
    const camp = { attendance_date: DATE, source_page: 'COMO Camp', first_in_at: FI, first_out_at: '', second_in_at: '', final_out_at: FOUTT };
    expect(validatePunchSequence(camp, NIGHT, SETTINGS).blocked).toEqual([]);
    expect(getRecordSequenceIssue(camp, NIGHT)).toBeNull();
    expect(calculateDailyStatus(camp, NIGHT, SETTINGS, [], new Date(iso('2026-09-28', 10, 0)))).toBe('Present');
  });
});

describe('status follows the punch progression', () => {
  const running = new Date(iso('2026-09-28', 1, 30));
  const afterShift = new Date(iso('2026-09-28', 10, 0));
  it('reports the reached stage while the shift is running', () => {
    const base = { attendance_date: DATE, first_in_at: FI };
    expect(calculateDailyStatus({ ...base, first_out_at: '', second_in_at: '', final_out_at: '' }, NIGHT, SETTINGS, [], running)).toBe('First In Completed');
    expect(calculateDailyStatus({ ...base, first_out_at: FOUT, second_in_at: '', final_out_at: '' }, NIGHT, SETTINGS, [], running)).toBe('First Out Completed');
    expect(calculateDailyStatus({ ...base, first_out_at: FOUT, second_in_at: SI, final_out_at: '' }, NIGHT, SETTINGS, [], running)).toBe('Second In Completed');
  });
  it('completes as Present, and a corrupted record is never Present', () => {
    expect(calculateDailyStatus({ attendance_date: DATE, first_in_at: FI, first_out_at: FOUT, second_in_at: SI, final_out_at: FOUTT }, NIGHT, SETTINGS, [], afterShift)).toBe('Present');
    const corrupted = { attendance_date: DATE, first_in_at: FI, first_out_at: '', second_in_at: '', final_out_at: FOUTT };
    expect(['Incomplete', 'Missing Check-out']).toContain(calculateDailyStatus(corrupted, NIGHT, SETTINGS, [], afterShift));
  });
});