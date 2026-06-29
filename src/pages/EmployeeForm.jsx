import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Upload, User, UserCheck, UserX, Shield } from 'lucide-react';
import SharepointFormButton from '@/components/common/SharepointFormButton';
import SearchableSelect from '@/components/common/SearchableSelect';
import { useToast } from '@/components/ui/use-toast';
import { COMPANIES, RLIC_STATUSES, PID_STATUSES, MEDICAL_RESULTS, TRAINING_STATUSES, LOCATIONS, DEPARTMENTS, computePassStatus } from '@/utils/constants';
import { usePermissions } from '@/lib/usePermissions';
import { useCurrentUser } from '@/lib/useCurrentUser';

const emptyForm = {
  sl_no: '', name: '', photo_url: '', position_application: '', designation_org_chart: '', department: '',
  company: '', company_type: '', nationality: '', religion: '', current_location: '', dir_indir: '',
  contact_details: '', sponsor: '', remarks: '',
  qid_no: '', qid_expiry: '', pp_no: '', pp_expiry: '',
  visa_date_applied: '', visa_date_received: '', visa_expiry: '',
  ftw_medical_date: '', ftw_received_date: '', ftw_approval_request_date: '', ftw_count_days: '',
  ftw_approved_date: '', ftw_result: '', ftw_doctor: '', ftw_mobile: '',
  gate_pass_issue_date: '', gate_pass_received_date: '', gate_pass_expiry: '',
  staff_no: '', rlic_status: '',
  pid_issue_date: '', pid_expiry: '', pid: '', pid_status: '', pid_projected_date: '',
  training_date: '', training_date_scheduled: '', training_status: '',
  is_manager: false,
  assigned_manager_id: '', assigned_manager_name: '',
};

const Field = ({ label, children }) => (
  <div className="space-y-1.5">{label && <Label className="text-xs">{label}</Label>}{children}</div>
);

function toDateValue(val) {
  if (!val) return '';
  // If already YYYY-MM-DD, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  // Strip time portion from ISO datetime strings
  const d = new Date(val);
  if (isNaN(d)) return '';
  return d.toISOString().split('T')[0];
}

const TextInput = ({ field, label, type = 'text', required, form, onChange }) => (
  <Field label={label}>
    <Input
      type={type}
      required={required}
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

  useEffect(() => {
    if (existingEmp && existingEmp.length > 0) {
      const emp = existingEmp[0];
      const base = { ...emptyForm, ...Object.fromEntries(Object.entries(emp).filter(([_, v]) => v !== null && v !== undefined)) };
      // Auto-recalculate statuses on form open
      base.rlic_status = autoCalcRlic(base.gate_pass_expiry, base.rlic_status);
      base.pid_status = autoCalcPid(base.pid_expiry, base.pid_status);
      setForm(base);
    }
  }, [existingEmp]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const cleaned = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== '' && v !== null && v !== undefined));
      if (currentUser?.email) cleaned._last_updated_by = currentUser.email;
      if (currentUser?.full_name) cleaned._last_updated_by_name = currentUser.full_name;
      if (currentUser?.role) cleaned._last_updated_by_role = currentUser.role;
      if (isEdit && empId) return base44.entities.Employee.update(empId, cleaned);
      return base44.entities.Employee.create(cleaned);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({ title: isEdit ? 'Record updated' : 'Record created' });
      navigate(-1);
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
    saveMutation.mutate(form);
  };

  const tf = { form, onChange: handleChange };

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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{isEdit ? 'Edit Personnel' : 'Add Personnel'}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Fill in details below</p>
          </div>
        </div>
        {isEdit && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <button
              type="button"
              onClick={() => handleChange('is_active', form.is_active === false ? true : false)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                form.is_active === false
                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
              }`}
            >
              {form.is_active === false ? (
                <><UserX className="w-4 h-4" /> Inactive</>
              ) : (
                <><UserCheck className="w-4 h-4" /> Active</>
              )}
            </button>
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
            <SelectInput field="company" label="Company *" options={allCompanies} {...tf} />
            <SelectInput field="company_type" label="Company Type" options={['MAIN', 'SUB-CONTRACTOR', 'GSO SUPERVISION']} {...tf} />
            <SelectInput field="department" label="Department" options={allDepartments} {...tf} />
            <SelectInput field="current_location" label="Location / Mobilized" options={allLocations} {...tf} />
            <SelectInput field="dir_indir" label="DIR / INDIR" options={['DIR', 'INDIR']} {...tf} />
            <TextInput field="staff_no" label="Staff No / RLIC No" {...tf} />
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