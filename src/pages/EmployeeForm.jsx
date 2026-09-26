import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Upload, User, UserX, Shield, HardHat, UserPlus, LogOut } from 'lucide-react';
import SharepointFormButton from '@/components/common/SharepointFormButton';
import StatusChangeModal from '@/components/common/StatusChangeModal';
import StatusDetailsSection from '@/components/employee/StatusDetailsSection';
import SearchableSelect from '@/components/common/SearchableSelect';
import { ACTIVE_ON_SITE, ONBOARDING, INACTIVE, DEMOBILIZED, PERSONNEL_STATUSES, PERSONNEL_STATUS_CONFIG, isActiveRosterStatus, resolvePersonnelStatus, normalizeStatus } from '@/lib/personnelStatus';
import { useToast } from '@/components/ui/use-toast';
import { COMPANIES, RLIC_STATUSES, PID_STATUSES, MEDICAL_RESULTS, TRAINING_STATUSES, LOCATIONS, DEPARTMENTS, computePassStatus } from '@/utils/constants';
import { usePermissions } from '@/lib/usePermissions';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { calcDuration, formatDuration, getLatestSession, toDateStr, toTimeStr, buildDateTime } from '@/lib/attendanceUtils';
import { saveAttendanceSession } from '@/lib/attendanceSave';

const emptyForm = {
  sl_no: '', name: '', photo_url: '', sharepoint_url: '',
  position_application: '', designation_org_chart: '', department: '',
  company: '', company_type: '', nationality: '', religion: '', current_location: '', dir_indir: '',
  contact_details: '', sponsor: '', remarks: '',
  qid_no: '', qid_expiry: '', pp_no: '', pp_expiry: '',
  visa_date_applied: '', visa_date_received: '', visa_expiry: '',
  ftw_medical_date: '', ftw_received_date: '', ftw_approval_request_date: '', ftw_count_days: '',
  ftw_approved_date: '', ftw_result: '', ftw_doctor: '', ftw_mobile: '',
  ftw_reassess_date: '', ftw_remarks: '',
  gate_pass_issue_date: '', gate_pass_received_date: '', gate_pass_expiry: '',
  staff_no: '', rlic_status: '',
  pid_issue_date: '', pid_expiry: '', pid: '', pid_status: '', pid_projected_date: '',
  training_date: '', training_date_scheduled: '', training_date_start: '', training_date_end: '', training_status: '',
  is_manager: false,
  assigned_manager_id: '', assigned_manager_name: '',
  work_location: '', approval_date: '', approval_comments: '',
  personnel_status: ACTIVE_ON_SITE,
  status_effective_date: '', last_working_date: '', status_reason: '', status_remarks: '',
  inactive_date: '', demobilization_date: '', demobilization_reason: '',
  status_changed_by: '', status_changed_at: '',
};

// Icon used for each personnel status button.
const STATUS_ICONS = {
  [ACTIVE_ON_SITE]: HardHat,
  [ONBOARDING]: UserPlus,
  [INACTIVE]: UserX,
  [DEMOBILIZED]: LogOut,
};

const Field = ({ label, children }) => (
  <div className="space-y-1.5">{label && <Label className="text-xs">{label}</Label>}{children}</div>
);

function toDateValue(val) {
  if (!val) return '';
  const s = String(val).trim();
  // Already YYYY-MM-DD (or starts with it) — return the date portion directly
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD/MM/YYYY or DD-MM-YYYY → YYYY-MM-DD
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // Fallback: parse with Date (may include timezone shift — avoid when possible)
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().split('T')[0];
  return '';
}

const TextInput = ({ field, label, type = 'text', required, placeholder, form, onChange }) => (
  <Field label={label}>
    <Input
      type={type}
      required={required}
      placeholder={placeholder}
      value={type === 'date' ? toDateValue(form[field]) : (form[field] || '')}
      onChange={e => onChange(field, e.target.value)}
    />
  </Field>
);

const SelectInput = ({ field, label, options, placeholder = 'Select', form, onChange }) => (
  <Field label={label}>
    <Select value={form[field] || ''} onValueChange={v => onChange(field, v)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map(opt => (
          typeof opt === 'string'
            ? <SelectItem key={opt} value={opt}>{opt.toUpperCase()}</SelectItem>
            : <SelectItem key={opt.value} value={opt.value}>{(opt.label || opt.value).toUpperCase()}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </Field>
);

export default function EmployeeForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();
  const currentUser = useCurrentUser();
  const pathParts = window.location.pathname.split('/');
  const isEdit = pathParts.includes('edit');
  const empId = isEdit ? pathParts[pathParts.indexOf('edit') - 1] : null;
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [statusWarning, setStatusWarning] = useState('');
  const [statusModal, setStatusModal] = useState({ open: false, newStatus: null });
  const statusCardRef = useRef(null);
  // Attendance (COMO Camp check-in / check-out) — linked via personnel_id to
  // the shared AttendanceRecord entity. Shown when Location = COMO CAMP.
  const [attCheckInDate, setAttCheckInDate] = useState('');
  const [attCheckInTime, setAttCheckInTime] = useState('');
  const [attCheckOutDate, setAttCheckOutDate] = useState('');
  const [attCheckOutTime, setAttCheckOutTime] = useState('');
  const [attReason, setAttReason] = useState('');
  const [attError, setAttError] = useState('');
  const sectionParam = new URLSearchParams(window.location.search).get('section');

  // Auto-scroll to the relevant Inactive/Demobilized details card when opened with ?section=...
  useEffect(() => {
    if (!sectionParam) return;
    const expectedId = form.personnel_status === 'Demobilized' ? 'demobilization-details' : 'inactive-details';
    if (expectedId !== sectionParam) return; // card not present for the current status
    const t = setTimeout(() => {
      statusCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
    return () => clearTimeout(t);
  }, [sectionParam, form.personnel_status]);

  // Special (non-date-derivable) statuses — never auto-overwrite these
  const RLIC_SPECIAL = new Set([
    'HOLDING ACTIVE GP', 'WAITING MOI APPROVAL', 'DVC / SS - TR',
    'VALID / RENEWAL UNDER PROCESS', 'REJECTED', 'RECALLED W/ VALID',
    'DVC SENT', 'UNDER PROCESS',
  ]);
  const PID_SPECIAL = new Set([
    'RENEWAL UNDER PROCESS', 'RECALLED', 'NO PID PASS',
  ]);

  const autoCalcRlic = (expiryDate, storedStatus) => {
    if (storedStatus && RLIC_SPECIAL.has(storedStatus.toUpperCase())) return storedStatus;
    return computePassStatus(expiryDate, 'rlic', null);
  };
  const autoCalcPid = (expiryDate, storedStatus) => {
    if (storedStatus && PID_SPECIAL.has(storedStatus.toUpperCase())) return storedStatus;
    return computePassStatus(expiryDate, 'pid', null);
  };

  const { data: existingEmp } = useQuery({
    queryKey: ['employee', empId],
    queryFn: () => base44.entities.Employee.filter({ id: empId }),
    enabled: !!empId,
  });

  // Latest attendance session for this employee (single query, not N+1).
  const { data: empAttendance = [] } = useQuery({
    queryKey: ['attendance', 'employee', empId],
    queryFn: () => base44.entities.AttendanceRecord.filter({ personnel_id: empId }, '-check_in_at', 1000),
    enabled: !!empId,
  });
  const latestAttSession = useMemo(() => getLatestSession(empAttendance), [empAttendance]);

  const { data: lookupCompanies = [] } = useQuery({
    queryKey: ['lookups', 'company'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'company' }),
  });
  const { data: lookupDepartments = [] } = useQuery({
    queryKey: ['lookups', 'department'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'department' }),
  });
  const { data: lookupLocations = [] } = useQuery({
    queryKey: ['lookups', 'location'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'location' }),
  });
  const { data: lookupRlicStatuses = [] } = useQuery({
    queryKey: ['lookups', 'rlic_status'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'rlic_status' }),
  });
  const { data: lookupMedicalResults = [] } = useQuery({
    queryKey: ['lookups', 'ftw_result'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'ftw_result' }),
  });
  const { data: lookupPidStatuses = [] } = useQuery({
    queryKey: ['lookups', 'pid_status'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'pid_status' }),
  });
  const { data: lookupTrainingStatuses = [] } = useQuery({
    queryKey: ['lookups', 'training_status'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'training_status' }),
  });
  const { data: lookupPositions = [] } = useQuery({
    queryKey: ['lookupPositions'],
    queryFn: () => base44.entities.LookupPosition.list(),
  });
  const { data: lookupNationalities = [] } = useQuery({
    queryKey: ['lookups', 'nationality'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'nationality' }),
  });
  const { data: lookupWorkLocations = [] } = useQuery({
    queryKey: ['lookups', 'work_location'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'work_location' }),
  });

  // Managers: active employees with is_manager = true
  const { data: allActiveEmps = [] } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, 'name', 10000),
  });
  const managerOptions = useMemo(() =>
    allActiveEmps.filter(e => e.is_manager && e.id !== empId).map(e => ({ value: e.id, label: e.name })),
    [allActiveEmps, empId]
  );

  const allCompanies = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const c of [...COMPANIES.map(c => ({ value: c.value, label: c.label })), ...lookupCompanies.map(c => ({ value: c.value, label: c.label }))]) {
      const key = c.value.trim().toUpperCase();
      if (!seen.has(key)) { seen.add(key); result.push(c); }
    }
    return result;
  }, [lookupCompanies]);
  const allDepartments = useMemo(() => {
    const allDepts = [];
    const seen = new Set();

    // Add built-in departments (already in ALL CAPS)
    DEPARTMENTS.forEach(d => {
      const key = d.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        allDepts.push({ value: d, label: d });
      }
    });

    // Add custom lookup departments
    lookupDepartments.forEach(d => {
      const key = d.value.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        allDepts.push({ value: d.value, label: d.label.toUpperCase() });
      }
    });

    return allDepts;
  }, [lookupDepartments]);
  const allLocations = [
    ...LOCATIONS,
    ...lookupLocations.map(l => l.value).filter(v => !LOCATIONS.includes(v)),
  ];
  const allRlicStatuses = useMemo(() => {
    const base = RLIC_STATUSES.map(s => typeof s === 'string' ? { value: s, label: s } : s);
    const customVals = new Set(base.map(s => s.value));
    const custom = lookupRlicStatuses.filter(s => !customVals.has(s.value)).map(s => ({ value: s.value, label: s.label }));
    return [...base, ...custom];
  }, [lookupRlicStatuses]);

  const allMedicalResults = useMemo(() => {
    const base = MEDICAL_RESULTS;
    const customVals = new Set(base.map(s => s.value));
    const custom = lookupMedicalResults.filter(s => !customVals.has(s.value)).map(s => ({ value: s.value, label: s.label }));
    return [...base, ...custom];
  }, [lookupMedicalResults]);

  const allPidStatuses = useMemo(() => {
    const base = PID_STATUSES.map(s => typeof s === 'string' ? { value: s, label: s } : s);
    const customVals = new Set(base.map(s => s.value));
    const custom = lookupPidStatuses.filter(s => !customVals.has(s.value)).map(s => ({ value: s.value, label: s.label }));
    return [...base, ...custom];
  }, [lookupPidStatuses]);

  const allTrainingStatuses = useMemo(() => {
    const base = TRAINING_STATUSES;
    const customVals = new Set(base.map(s => s.value));
    const custom = lookupTrainingStatuses.filter(s => !customVals.has(s.value)).map(s => ({ value: s.value, label: s.label }));
    return [...base, ...custom];
  }, [lookupTrainingStatuses]);

  // Position/Designation lookup options (active only, sorted by rank)
  const positionAppOptions = useMemo(() => {
    return lookupPositions
      .filter(p => p.is_active && (p.type === 'position_application' || p.type === 'both'))
      .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || (a.name || '').localeCompare(b.name || ''))
      .map(p => ({ value: p.name, label: p.name }));
  }, [lookupPositions]);

  const designationOptions = useMemo(() => {
    return lookupPositions
      .filter(p => p.is_active && (p.type === 'designation_org_chart' || p.type === 'both'))
      .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || (a.name || '').localeCompare(b.name || ''))
      .map(p => ({ value: p.name, label: p.name }));
  }, [lookupPositions]);

  const nationalityOptions = useMemo(() => {
    return lookupNationalities
      .filter(n => !n.is_deleted)
      .map(n => ({ value: n.value, label: n.label.toUpperCase() }));
  }, [lookupNationalities]);

  // Work Location options — sourced from Admin Panel → Lookups → Work Locations.
  // Legacy values not in the lookup are still displayed (SearchableSelect falls
  // back to the raw value) but only registered entries can be newly selected.
  const workLocationOptions = useMemo(() => {
    return lookupWorkLocations
      .filter(w => !w.is_deleted)
      .map(w => ({ value: w.value, label: w.label.toUpperCase() }));
  }, [lookupWorkLocations]);

  useEffect(() => {
    if (existingEmp && existingEmp.length > 0) {
      const emp = existingEmp[0];
      const base = { ...emptyForm, ...Object.fromEntries(Object.entries(emp).filter(([_, v]) => v !== null && v !== undefined)) };
      // Normalise legacy status values to the current four-status vocabulary:
      // 'Active' / blank → 'Active on Site' on the active roster, or 'Inactive'
      // when the record is already flagged is_active = false.
      base.personnel_status = normalizeStatus(base.personnel_status, emp.is_active);
      // Auto-recalculate statuses on form open
      base.rlic_status = autoCalcRlic(base.gate_pass_expiry, base.rlic_status);
      base.pid_status = autoCalcPid(base.pid_expiry, base.pid_status);
      setForm(base);
    }
  }, [existingEmp]);

  // Populate attendance fields from the latest session whenever it changes.
  // Data is preserved even when Location ≠ COMO CAMP (fields hidden, not cleared).
  useEffect(() => {
    if (latestAttSession) {
      setAttCheckInDate(latestAttSession.check_in_at ? toDateStr(latestAttSession.check_in_at) : '');
      setAttCheckInTime(latestAttSession.check_in_at ? toTimeStr(latestAttSession.check_in_at) : '');
      setAttCheckOutDate(latestAttSession.check_out_at ? toDateStr(latestAttSession.check_out_at) : '');
      setAttCheckOutTime(latestAttSession.check_out_at ? toTimeStr(latestAttSession.check_out_at) : '');
    } else {
      setAttCheckInDate(''); setAttCheckInTime(''); setAttCheckOutDate(''); setAttCheckOutTime('');
    }
    setAttReason(''); setAttError('');
  }, [latestAttSession]);

  // Attendance derived values — shown only when Location = COMO CAMP.
  const isComoCampLocation = (form.current_location || '').trim().toUpperCase() === 'COMO CAMP';
  const attCheckInAt = useMemo(() => buildDateTime(attCheckInDate, attCheckInTime), [attCheckInDate, attCheckInTime]);
  const attCheckOutAt = useMemo(() => buildDateTime(attCheckOutDate, attCheckOutTime), [attCheckOutDate, attCheckOutTime]);
  const attDuration = attCheckInAt && attCheckOutAt ? calcDuration(attCheckInAt.toISOString(), attCheckOutAt.toISOString()) : 0;
  const attExistingCompleted = !!(latestAttSession?.check_in_at && latestAttSession?.check_out_at);
  const attInChanged = latestAttSession?.check_in_at && attCheckInAt && attCheckInAt.toISOString() !== latestAttSession.check_in_at;
  const attOutChanged = latestAttSession?.check_out_at ? (!!attCheckOutAt && attCheckOutAt.toISOString() !== latestAttSession.check_out_at) : !!attCheckOutAt;
  const attOutCleared = latestAttSession?.check_out_at && !attCheckOutAt;
  const attAnyChange = attInChanged || attOutChanged || attOutCleared;
  // When the existing session is completed and check-in changed, a NEW session
  // is created (no correction reason needed). Otherwise changes are corrections.
  const attIsNewSession = attExistingCompleted && attInChanged;
  const attNeedsReason = !!latestAttSession && attAnyChange && !attIsNewSession;

  // Field sets used by the save logic
  const NUMBER_FIELDS = new Set(['sl_no', 'ftw_count_days']);
  const BUILTIN_FIELDS = new Set(['id', 'created_date', 'updated_date', 'created_by_id']);
  const META_FIELDS = new Set(['_last_updated_by', '_last_updated_by_name', '_last_updated_by_role', '_last_updated_at']);

  // ── Approved List synchronization ────────────────────────────────────────────
  // Creates or updates the Approved List record linked to this personnel. The
  // assigned manager (assigned_manager_id) + approval date are the single source
  // of truth; when either is missing the record is kept but marked Pending and a
  // new record is never auto-created.
  const syncApprovedRecord = async (emp) => {
    if (!emp || !emp.id) return;
    const eligible = !!(emp.assigned_manager_id && emp.approval_date);
    let managerName = emp.assigned_manager_name || '';
    if (!managerName && emp.assigned_manager_id) {
      const mgr = allActiveEmps.find(e => e.id === emp.assigned_manager_id);
      if (mgr?.name) managerName = mgr.name;
    }
    const fields = {
      full_name: emp.name || '',
      qid_number: emp.qid_no || '',
      pid_no: emp.pid || '',
      mobile_number: emp.contact_details || '',
      company: emp.company || '',
      designation_position: emp.designation_org_chart || emp.position_application || '',
      manager_assigned: managerName,
      work_location: emp.work_location || '',
      approval_date: emp.approval_date || '',
      approval_comments: emp.approval_comments || '',
      medical: emp.ftw_result || '',
      gate_pass_status: emp.rlic_status || '',
      training_status: emp.training_status || '',
      project_id_status: emp.pid_status || '',
      personnel_match_status: 'Matched',
      approval_status: eligible ? 'Approved' : 'Pending',
    };

    const existing = await base44.entities.ApprovedRecord.filter({ personnel_id: emp.id });
    const linked = existing.find(r => r.personnel_id === emp.id);

    if (!linked) {
      if (!eligible) return; // not qualified yet — do not create a record
      const created = await base44.entities.ApprovedRecord.create({ ...fields, personnel_id: emp.id });
      await base44.entities.ActivityLog.create({
        action: 'create', entity_name: 'ApprovedRecord', entity_id: created.id,
        performed_by: currentUser?.email || '', record_name: emp.name || '',
        changed_fields: [], record_snapshot: { ...fields, personnel_id: emp.id },
      }).catch(() => {});
    } else {
      const changes = {};
      for (const k of Object.keys(fields)) {
        if (linked[k] !== fields[k]) changes[k] = fields[k];
      }
      if (Object.keys(changes).length) {
        await base44.entities.ApprovedRecord.update(linked.id, changes);
        await base44.entities.ActivityLog.create({
          action: 'update', entity_name: 'ApprovedRecord', entity_id: linked.id,
          performed_by: currentUser?.email || '', record_name: emp.name || '',
          changed_fields: Object.keys(changes), record_snapshot: changes,
        }).catch(() => {});
      }
    }
    queryClient.invalidateQueries({ queryKey: ['approvedRecords'] });
  };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      // Build payload — preserve EVERY field the form holds (including intentionally
      // cleared empty strings for dates/text/dropdowns so they persist as cleared).
      // Number fields are converted to null when empty to avoid schema validation errors.
      const payload = {};
      for (const [key, value] of Object.entries(data)) {
        if (BUILTIN_FIELDS.has(key)) continue;
        if (NUMBER_FIELDS.has(key) && (value === '' || value === undefined)) {
          payload[key] = null;
        } else {
          payload[key] = value;
        }
      }

      // Recalculate statuses from expiry dates (safety net — guarantees consistency even
      // if the handler didn't recompute after a date change).
      payload.rlic_status = autoCalcRlic(payload.gate_pass_expiry, payload.rlic_status);
      payload.pid_status = autoCalcPid(payload.pid_expiry, payload.pid_status);

      // Trim free-text work location so leading/trailing spaces don't accumulate.
      if (typeof payload.work_location === 'string') {
        payload.work_location = payload.work_location.trim();
      }

      // Keep is_active in sync with personnel_status
      payload.is_active = isActiveRosterStatus(payload.personnel_status);

      // Capture who changed the status (stored on the record for quick audit reference).
      // The full field-level audit trail is generated by the entity automation + logEmployeeActivity.
      if (isEdit && existingEmp?.[0]) {
        const prevStatus = normalizeStatus(existingEmp[0].personnel_status, existingEmp[0].is_active);
        const newStatus = payload.personnel_status || ACTIVE_ON_SITE;
        if (prevStatus !== newStatus) {
          payload.status_changed_by = currentUser?.email || '';
          payload.status_changed_at = new Date().toISOString();
        }
      }

      // Audit meta used by the automation to attribute the change to the real user
      if (currentUser?.email) payload._last_updated_by = currentUser.email;
      if (currentUser?.full_name) payload._last_updated_by_name = currentUser.full_name;
      if (currentUser?.role) payload._last_updated_by_role = currentUser.role;
      payload._last_updated_at = new Date().toISOString();

      let result;
      if (isEdit && empId) {
        // Updates: send ALL fields. Unchanged fields keep their existing values;
        // edited fields update; intentionally cleared fields save as empty.
        result = await base44.entities.Employee.update(empId, payload);
      } else {
        // Creates: filter out empty/null values so optional fields aren't stored as blanks.
        const cleaned = Object.fromEntries(
          Object.entries(payload).filter(([k, v]) => META_FIELDS.has(k) || (v !== '' && v !== null && v !== undefined))
        );
        result = await base44.entities.Employee.create(cleaned);
      }
      return result;
    },
    onSuccess: async (savedEmp) => {
      // Invalidate every employee-related query so all pages and reports refresh immediately:
      // Master List, Dashboard, Medical, Gate Pass, Project ID, Training, Projection,
      // Onboarding Monitoring, Inactive/Demobilized, Workforce Report, Activity Log.
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees-active'] });
      queryClient.invalidateQueries({ queryKey: ['employees-inactive'] });
      queryClient.invalidateQueries({ queryKey: ['employee'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      queryClient.invalidateQueries({ queryKey: ['projection'] });

      // Sync the Approved List along with this personnel record. Failures must not
      // block the save — surface them as a toast so the user can retry from the grid.
      try {
        await syncApprovedRecord(savedEmp);
      } catch (e) {
        toast({
          title: 'Approved List sync issue',
          description: e?.message || 'Could not sync the Approved List record. You can edit it manually in Reports → Approved List.',
          variant: 'destructive',
        });
      }

      // Save attendance session (only when Location = COMO CAMP). Uses the shared
      // saveAttendanceSession helper — same logic as COMO Camp. Existing records
      // are never deleted when Location changes away from COMO CAMP.
      try {
        if ((savedEmp.current_location || '').trim().toUpperCase() === 'COMO CAMP') {
          const result = await saveAttendanceSession({
            personnelId: savedEmp.id,
            employeeName: savedEmp.name,
            company: savedEmp.company,
            workLocation: savedEmp.current_location,
            existingRecord: latestAttSession,
            checkInAt: attCheckInAt,
            checkOutAt: attCheckOutAt,
            reason: attReason,
            currentUser,
            sourcePage: 'Personnel Form',
          });
          if (result.action !== 'none') {
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
          }
        }
      } catch (e) {
        toast({
          title: 'Attendance Save Issue',
          description: e?.message || 'Could not save attendance. The personnel record was saved successfully.',
          variant: 'destructive',
        });
      }

      toast({
        title: isEdit ? 'Personnel information updated successfully.' : 'Personnel record created successfully.',
      });
      navigate(-1);
    },
    onError: (error) => {
      toast({
        title: isEdit ? 'Update Failed' : 'Create Failed',
        description: error?.message || 'An error occurred while saving. Your unsaved changes are preserved on the form.',
        variant: 'destructive',
      });
    },
  });

  const TEXT_FIELDS = ['name','position_application','designation_org_chart','religion','contact_details','sponsor','remarks','qid_no','pp_no','ftw_doctor','ftw_mobile','ftw_remarks','staff_no','pid'];
  const UPPERCASE_FIELDS = ['department'];

  const validateStatusAgainstExpiry = (statusField, statusValue, expiryDate, type) => {
    const BUILT_IN_RLIC = new Set(['VALID RLIC PASS', 'EXPIRED RLIC PASS', 'SOON TO EXPIRE', 'NO RLIC PASS']);
    const BUILT_IN_PID = new Set(['VALID PID PASS', 'EXPIRED PID PASS', 'SOON TO EXPIRE', 'NO PID PASS']);
    const builtIn = type === 'rlic' ? BUILT_IN_RLIC : BUILT_IN_PID;
    // Only validate built-in statuses
    if (!builtIn.has(statusValue)) return '';
    const validStatus = type === 'rlic' ? 'VALID RLIC PASS' : 'VALID PID PASS';
    const expiredStatus = type === 'rlic' ? 'EXPIRED RLIC PASS' : 'EXPIRED PID PASS';
    const noPassStatus = type === 'rlic' ? 'NO RLIC PASS' : 'NO PID PASS';
    if (!expiryDate && statusValue !== noPassStatus) {
      return 'Please set the expiry date before selecting this status.';
    }
    if (expiryDate) {
      const calculated = computePassStatus(expiryDate, type, null);
      if (calculated !== statusValue) {
        return `The selected status does not match the expiry date. Please correct the expiry date or status. (Expected: ${calculated})`;
      }
    }
    return '';
  };

  const handleChange = (field, value) => {
    let processed = value;
    if (TEXT_FIELDS.includes(field) && typeof value === 'string') {
      processed = value.toUpperCase();
    } else if (UPPERCASE_FIELDS.includes(field) && typeof value === 'string') {
      processed = value.toUpperCase();
    }

    setStatusWarning('');

    setForm(prev => {
      const next = { ...prev, [field]: processed };

      // Auto-recalculate RLIC status when gate pass expiry changes
      if (field === 'gate_pass_expiry') {
        next.rlic_status = autoCalcRlic(processed, prev.rlic_status);
      }
      // Auto-recalculate PID status when PID expiry changes
      if (field === 'pid_expiry') {
        next.pid_status = autoCalcPid(processed, prev.pid_status);
      }
      // Validate when user manually changes RLIC status
      if (field === 'rlic_status') {
        const warning = validateStatusAgainstExpiry(field, processed, prev.gate_pass_expiry, 'rlic');
        if (warning) setStatusWarning(warning);
      }
      // Validate when user manually changes PID status
      if (field === 'pid_status') {
        const warning = validateStatusAgainstExpiry(field, processed, prev.pid_expiry, 'pid');
        if (warning) setStatusWarning(warning);
      }

      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Require an authenticated session so the audit trail attributes to a real user.
    if (!currentUser?.email) {
      toast({
        title: 'Cannot Save',
        description: 'Your session is still loading. Please wait a moment and try again.',
        variant: 'destructive',
      });
      return;
    }

    // Validate required fields before saving (prevents partial updates).
    if (!form.name || !form.name.trim()) {
      toast({ title: 'Validation Error', description: 'Full Name is required.', variant: 'destructive' });
      return;
    }
    if (!form.company || !form.company.trim()) {
      toast({ title: 'Validation Error', description: 'Company is required.', variant: 'destructive' });
      return;
    }

    // Block save if there's an active status warning
    if (statusWarning) {
      toast({ title: 'Status Mismatch', description: statusWarning, variant: 'destructive' });
      return;
    }

    // Validate nationality against approved list
    if (form.nationality && nationalityOptions.length > 0) {
      const isApproved = nationalityOptions.some(o => o.value === form.nationality);
      if (!isApproved) {
        toast({ title: 'Invalid Nationality', description: 'Please select a valid nationality from the approved list.', variant: 'destructive' });
        return;
      }
    }

    // Attendance validation (only when Location = COMO CAMP)
    if (isComoCampLocation) {
      if (latestAttSession && !attCheckInAt) {
        toast({ title: 'Validation Error', description: 'Check-in date and time are required when an attendance session exists.', variant: 'destructive' });
        return;
      }
      if (attCheckInAt && attCheckOutAt && attCheckOutAt <= attCheckInAt) {
        toast({ title: 'Validation Error', description: 'Check-out date and time must be later than the Check-in date and time.', variant: 'destructive' });
        return;
      }
      if (attNeedsReason && !attReason.trim()) {
        toast({ title: 'Validation Error', description: 'A correction reason is required when modifying existing attendance.', variant: 'destructive' });
        return;
      }
    }

    // Approved List eligibility check: assignment criteria require BOTH an assigned
    // manager and an approval date. Warn before saving when the date is set but no
    // manager is assigned — the linked Approved List record (if any) will go Pending.
    if (form.approval_date && !form.assigned_manager_id) {
      const ok = window.confirm(
        'This personnel will not fully meet the Approved List requirements because no manager is assigned. The linked Approved List record (if any) will be marked Pending. Continue?'
      );
      if (!ok) return;
    }

    saveMutation.mutate(form);
  };

  const tf = { form, onChange: handleChange };

  const handleStatusModalConfirm = ({ newStatus, effectiveDate, lastWorkingDate, reason }) => {
    handleChange('personnel_status', newStatus);
    // Active on Site / Onboarding stay on the working roster (is_active = true);
    // Inactive / Demobilized move to the Inactive / Demobilized page.
    handleChange('is_active', isActiveRosterStatus(newStatus));
    if (lastWorkingDate) handleChange('last_working_date', lastWorkingDate);
    if (reason) {
      handleChange('status_reason', reason);
      if (newStatus === DEMOBILIZED) handleChange('demobilization_reason', reason);
    }
    if (newStatus === INACTIVE) {
      handleChange('status_effective_date', effectiveDate);
      handleChange('inactive_date', effectiveDate);
    }
    if (newStatus === DEMOBILIZED) {
      handleChange('status_effective_date', effectiveDate);
      handleChange('demobilization_date', effectiveDate);
    }
    setStatusModal({ open: false, newStatus: null });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    handleChange('photo_url', file_url);
    setUploadingPhoto(false);
    toast({ title: 'Photo uploaded' });
  };

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Shield className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">View Only Access</h2>
        <p className="text-muted-foreground mt-2">You do not have permission to edit records.</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <StatusChangeModal
        open={statusModal.open}
        onClose={() => setStatusModal({ open: false, newStatus: null })}
        emp={form.name ? { name: form.name, personnel_status: form.personnel_status, is_active: form.is_active } : null}
        newStatus={statusModal.newStatus}
        onConfirm={handleStatusModalConfirm}
      />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{isEdit ? 'Edit Personnel' : 'Add Personnel'}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Fill in details below</p>
          </div>
        </div>
        {isEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Status:</span>
            {PERSONNEL_STATUSES.map(s => {
              const cfg = PERSONNEL_STATUS_CONFIG[s];
              const StatusIcon = STATUS_ICONS[s];
              const isSelected = resolvePersonnelStatus(form) === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusModal({ open: true, newStatus: s })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${isSelected ? cfg.selected : cfg.idle}`}
                >
                  <StatusIcon className="w-4 h-4" />
                  {s}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-primary">Personal Information</h3>
            {isEdit && <SharepointFormButton value={form.sharepoint_url || ''} onChange={v => handleChange('sharepoint_url', v)} />}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Photo Upload */}
            <div className="md:col-span-3 flex items-center gap-4">
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-border overflow-hidden flex items-center justify-center bg-muted flex-shrink-0">
                {form.photo_url ? (
                  <img src={form.photo_url} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <Label className="text-xs block mb-1.5">Profile Photo (2×2)</Label>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  <Button type="button" variant="outline" size="sm" disabled={uploadingPhoto} asChild>
                    <span><Upload className="w-3.5 h-3.5 mr-2" />{uploadingPhoto ? 'Uploading...' : 'Upload Photo'}</span>
                  </Button>
                </label>
                <p className="text-[11px] text-muted-foreground mt-1">Recommended: 2×2 passport-size photo</p>
              </div>
            </div>
            <TextInput field="sl_no" label="SL No" type="number" {...tf} />
            <div className="md:col-span-2"><TextInput field="name" label="Full Name *" required {...tf} /></div>
            <Field label="Position (Application)">
              <SearchableSelect
                value={form.position_application || ''}
                onChange={v => handleChange('position_application', v)}
                options={positionAppOptions}
                placeholder="Search position..."
                emptyMessage="No matching positions found"
              />
            </Field>
            <Field label="Designation (Org Chart)">
              <SearchableSelect
                value={form.designation_org_chart || ''}
                onChange={v => handleChange('designation_org_chart', v)}
                options={designationOptions}
                placeholder="Search designation..."
                emptyMessage="No matching designations found"
              />
            </Field>
            <Field label="Nationality">
              <SearchableSelect
                value={form.nationality || ''}
                onChange={v => handleChange('nationality', v)}
                options={nationalityOptions}
                placeholder="Search nationality..."
                emptyMessage="No matching nationalities found"
              />
            </Field>
            <TextInput field="religion" label="Religion" {...tf} />
            <TextInput field="contact_details" label="Contact Details" {...tf} />
            <TextInput field="sponsor" label="Sponsor" {...tf} />
            <TextInput field="remarks" label="Remarks" {...tf} />
          </div>
        </Card>

        {/* Work Info */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4 text-primary">Work Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Company *">
              <SearchableSelect
                value={form.company || ''}
                onChange={v => handleChange('company', v)}
                options={allCompanies}
                placeholder="Search company..."
                emptyMessage="No matching companies found"
              />
            </Field>
            <SelectInput field="company_type" label="Company Type" options={['MAIN', 'SUB-CONTRACTOR', 'GSO SUPERVISION']} {...tf} />
            <Field label="Department">
              <SearchableSelect
                value={form.department || ''}
                onChange={v => handleChange('department', v)}
                options={allDepartments}
                placeholder="Search department..."
                emptyMessage="No matching departments found"
              />
            </Field>
            <SelectInput field="current_location" label="Location / Mobilized" options={allLocations} {...tf} />
            <SelectInput field="dir_indir" label="DIR / INDIR" options={['DIR', 'INDIR']} {...tf} />
            <Field label="Assigned Manager">
              <SearchableSelect
                value={form.assigned_manager_id || ''}
                onChange={v => {
                  const mgr = managerOptions.find(m => m.value === v);
                  handleChange('assigned_manager_id', v || '');
                  handleChange('assigned_manager_name', mgr ? mgr.label : '');
                }}
                options={managerOptions}
                placeholder="Search manager..."
                emptyMessage="No managers found. Mark a person as Is Manager in Admin Panel."
              />
            </Field>
            <Field label="Is Manager">
              <button
                type="button"
                onClick={() => handleChange('is_manager', !form.is_manager)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  form.is_manager
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {form.is_manager ? '✓ Yes — Can be assigned as manager' : 'No — Regular employee'}
              </button>
            </Field>
            <Field label="Work Location">
              <SearchableSelect
                value={form.work_location || ''}
                onChange={v => handleChange('work_location', v)}
                options={workLocationOptions}
                placeholder="Search / Select Work Location"
                emptyMessage="No matching work locations. Add entries in Admin Panel → Lookups → Work Locations."
              />
            </Field>
            {isComoCampLocation && (
              <>
                <Field label="Check-in Date">
                  <Input type="date" value={attCheckInDate} onChange={e => { setAttCheckInDate(e.target.value); setAttError(''); }} />
                </Field>
                <Field label="Check-in Time">
                  <Input type="time" value={attCheckInTime} onChange={e => { setAttCheckInTime(e.target.value); setAttError(''); }} />
                </Field>
                <Field label="Check-out Date">
                  <Input type="date" value={attCheckOutDate} onChange={e => { setAttCheckOutDate(e.target.value); setAttError(''); }} />
                </Field>
                <Field label="Check-out Time">
                  <Input type="time" value={attCheckOutTime} onChange={e => { setAttCheckOutTime(e.target.value); setAttError(''); }} />
                </Field>
                <div className="md:col-span-2 lg:col-span-4 space-y-1">
                  <div className="flex justify-between gap-4 text-xs">
                    <span className="text-muted-foreground">
                      Duration: <span className="font-medium text-foreground">{attCheckOutAt ? formatDuration(attDuration) : attCheckInAt ? 'Currently Checked In' : '—'}</span>
                    </span>
                    {latestAttSession && <span className="text-muted-foreground">Latest session loaded · {attIsNewSession ? 'New session will be created (previous completed)' : 'Changes require a correction reason'}</span>}
                  </div>
                  {attNeedsReason && (
                    <div>
                      <Label className="text-xs">Correction Reason <span className="text-destructive">*</span></Label>
                      <Textarea
                        value={attReason}
                        onChange={e => { setAttReason(e.target.value); setAttError(''); }}
                        rows={2}
                        placeholder="Reason for correcting existing attendance"
                        className="text-sm mt-1"
                      />
                    </div>
                  )}
                  {attError && <p className="text-xs text-destructive">{attError}</p>}
                </div>
              </>
            )}
            <Field label="Approval Comments">
              <Textarea
                value={form.approval_comments || ''}
                onChange={e => handleChange('approval_comments', e.target.value)}
                rows={2}
                className="text-sm"
              />
            </Field>
          </div>
        </Card>

        {/* Visa & QID */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4 text-primary">QID, Visa & Passport</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <TextInput field="qid_no" label="QID No" {...tf} />
            <TextInput field="qid_expiry" label="QID Expiry" type="date" {...tf} />
            <TextInput field="pp_no" label="Passport No" {...tf} />
            <TextInput field="pp_expiry" label="Passport Expiry" type="date" {...tf} />
            <TextInput field="visa_date_applied" label="Visa Date Applied" type="date" {...tf} />
            <TextInput field="visa_date_received" label="Visa Date Received" type="date" {...tf} />
            <TextInput field="visa_expiry" label="Visa Expiry" type="date" {...tf} />
          </div>
        </Card>

        {/* Medical / FTW */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4 text-primary">Medical / FTW</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <TextInput field="ftw_medical_date" label="Medical Date" type="date" {...tf} />
            <TextInput field="ftw_received_date" label="Date Received from Al-Safa" type="date" {...tf} />
            <TextInput field="ftw_approval_request_date" label="TR FTW Approval Date Request" type="date" {...tf} />
            <TextInput field="ftw_count_days" label="Count Days" type="number" {...tf} />
            <TextInput field="ftw_approved_date" label="TR Date Approved" type="date" {...tf} />
            <SelectInput field="ftw_result" label="Result" options={allMedicalResults} {...tf} />
            <TextInput field="ftw_doctor" label="Doctor Name" {...tf} />
            <TextInput field="ftw_mobile" label="Mobile Number" {...tf} />
            <TextInput field="ftw_reassess_date" label="Re-Assess Date" type="date" {...tf} />
            <TextInput field="ftw_remarks" label="Medical Remarks" {...tf} />
          </div>
        </Card>

        {/* Gate Pass */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4 text-primary">Gate Pass (RLIC)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <TextInput field="gate_pass_issue_date" label="Submitted Date" type="date" {...tf} />
            <TextInput field="gate_pass_received_date" label="Received Date" type="date" {...tf} />
            <TextInput field="gate_pass_expiry" label="Expiry Date" type="date" {...tf} />
            <SelectInput field="rlic_status" label="RLIC Status" options={allRlicStatuses} {...tf} />
          </div>
          {statusWarning && (form.rlic_status) && (
            <div className="mt-3 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              ⚠️ {statusWarning}
            </div>
          )}
        </Card>

        {/* Training */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4 text-primary">Training</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <TextInput field="training_date_scheduled" label="Training Date Scheduled" type="date" {...tf} />
            <TextInput field="training_date_start" label="Training Date Started" type="date" {...tf} />
            <TextInput field="training_date_end" label="Training Date End" type="date" {...tf} />
            <SelectInput field="training_status" label="Training Status" options={allTrainingStatuses} {...tf} />
          </div>
        </Card>

        {/* Project ID */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4 text-primary">Project ID</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <TextInput field="pid" label="PID No" {...tf} />
            <TextInput field="pid_issue_date" label="Issue Date" type="date" {...tf} />
            <TextInput field="pid_expiry" label="Expiry Date" type="date" {...tf} />
            <TextInput field="pid_projected_date" label="Projected PID Date" type="date" {...tf} />
            <SelectInput field="pid_status" label="PID Status" options={allPidStatuses} {...tf} />
          </div>
          {statusWarning && (form.pid_status) && (
            <div className="mt-3 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              ⚠️ {statusWarning}
            </div>
          )}
        </Card>

        {/* Inactive / Demobilized status details — shown only when the record has a non-active status */}
        <div ref={statusCardRef} id={form.personnel_status === 'Demobilized' ? 'demobilization-details' : 'inactive-details'} className="scroll-mt-24">
          <StatusDetailsSection form={form} onChange={handleChange} />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </div>
  );
}