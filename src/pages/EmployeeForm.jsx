import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Upload, User } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { COMPANIES, RLIC_STATUSES, PID_STATUSES, FTW_RESULTS, TRAINING_STATUSES, LOCATIONS } from '@/utils/constants';

const emptyForm = {
  sl_no: '', name: '', photo_url: '', position_application: '', designation_org_chart: '',
  company: '', company_type: '', nationality: '', religion: '', current_location: '', dir_indir: '',
  contact_details: '', sponsor: '', remarks: '',
  qid_no: '', qid_expiry: '', pp_no: '', pp_expiry: '',
  visa_date_applied: '', visa_date_received: '', visa_expiry: '',
  ftw_medical_date: '', ftw_received_date: '', ftw_approval_request_date: '', ftw_count_days: '',
  ftw_approved_date: '', ftw_result: '', ftw_doctor: '', ftw_mobile: '',
  gate_pass_issue_date: '', gate_pass_received_date: '', gate_pass_expiry: '',
  staff_no: '', rlic_status: '',
  pid_issue_date: '', pid_expiry: '', pid: '', pid_status: '', pid_projected_date: '',
  training_date: '', training_status: '',
};

export default function EmployeeForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathParts = window.location.pathname.split('/');
  const isEdit = pathParts.includes('edit');
  const empId = isEdit ? pathParts[pathParts.indexOf('edit') - 1] : null;
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { data: existingEmp } = useQuery({
    queryKey: ['employee', empId],
    queryFn: () => base44.entities.Employee.filter({ id: empId }),
    enabled: !!empId,
  });

  useEffect(() => {
    if (existingEmp && existingEmp.length > 0) {
      const emp = existingEmp[0];
      setForm({ ...emptyForm, ...Object.fromEntries(Object.entries(emp).filter(([_, v]) => v !== null && v !== undefined)) });
    }
  }, [existingEmp]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const cleaned = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== '' && v !== null && v !== undefined));
      if (isEdit && empId) return base44.entities.Employee.update(empId, cleaned);
      return base44.entities.Employee.create(cleaned);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({ title: isEdit ? 'Record updated' : 'Record created' });
      navigate('/master-list');
    },
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const handleSubmit = (e) => { e.preventDefault(); saveMutation.mutate(form); };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    handleChange('photo_url', file_url);
    setUploadingPhoto(false);
    toast({ title: 'Photo uploaded' });
  };

  const Field = ({ label, children }) => (
    <div className="space-y-1.5">{label && <Label className="text-xs">{label}</Label>}{children}</div>
  );
  const TextInput = ({ field, label, type = 'text', required }) => (
    <Field label={label}>
      <Input type={type} required={required} value={form[field] || ''} onChange={e => handleChange(field, e.target.value)} />
    </Field>
  );
  const SelectInput = ({ field, label, options, placeholder = 'Select' }) => (
    <Field label={label}>
      <Select value={form[field] || ''} onValueChange={v => handleChange(field, v)}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            typeof opt === 'string'
              ? <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              : <SelectItem key={opt.value} value={opt.value}>{opt.label || opt.value}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/master-list">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{isEdit ? 'Edit Personnel' : 'Add Personnel'}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Fill in details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4 text-primary">Personal Information</h3>
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
            <TextInput field="sl_no" label="SL No" type="number" />
            <div className="md:col-span-2"><TextInput field="name" label="Full Name *" required /></div>
            <TextInput field="position_application" label="Position (Application)" />
            <TextInput field="designation_org_chart" label="Designation (Org Chart)" />
            <TextInput field="nationality" label="Nationality" />
            <TextInput field="religion" label="Religion" />
            <TextInput field="contact_details" label="Contact Details" />
            <TextInput field="sponsor" label="Sponsor" />
            <TextInput field="remarks" label="Remarks" />
          </div>
        </Card>

        {/* Work Info */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4 text-primary">Work Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SelectInput field="company" label="Company *" options={COMPANIES} />
            <SelectInput field="company_type" label="Company Type" options={['Main', 'Sub-contractor', 'GSO Supervision']} />
            <SelectInput field="current_location" label="Location" options={LOCATIONS} />
            <SelectInput field="dir_indir" label="DIR / INDIR" options={['DIR', 'INDIR']} />
            <TextInput field="staff_no" label="Staff No / RLIC No" />
          </div>
        </Card>

        {/* Visa & QID */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4 text-primary">QID, Visa & Passport</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <TextInput field="qid_no" label="QID No" />
            <TextInput field="qid_expiry" label="QID Expiry" type="date" />
            <TextInput field="pp_no" label="Passport No" />
            <TextInput field="pp_expiry" label="Passport Expiry" type="date" />
            <TextInput field="visa_date_applied" label="Visa Date Applied" type="date" />
            <TextInput field="visa_date_received" label="Visa Date Received" type="date" />
            <TextInput field="visa_expiry" label="Visa Expiry" type="date" />
          </div>
        </Card>

        {/* Medical / FTW */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4 text-primary">Medical / FTW</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <TextInput field="ftw_medical_date" label="Medical Date" type="date" />
            <TextInput field="ftw_received_date" label="Date Received from Al-Safa" type="date" />
            <TextInput field="ftw_approval_request_date" label="TR FTW Approval Date Request" type="date" />
            <TextInput field="ftw_count_days" label="Count Days" type="number" />
            <TextInput field="ftw_approved_date" label="TR Date Approved" type="date" />
            <SelectInput field="ftw_result" label="Result" options={FTW_RESULTS} />
            <TextInput field="ftw_doctor" label="Doctor Name" />
            <TextInput field="ftw_mobile" label="Mobile Number" />
          </div>
        </Card>

        {/* Gate Pass */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4 text-primary">Gate Pass (RLIC)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <TextInput field="gate_pass_issue_date" label="Issue Date" type="date" />
            <TextInput field="gate_pass_received_date" label="Received Date" type="date" />
            <TextInput field="gate_pass_expiry" label="Expiry Date" type="date" />
            <SelectInput field="rlic_status" label="RLIC Status" options={RLIC_STATUSES} />
          </div>
        </Card>

        {/* Project ID */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4 text-primary">Project ID</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <TextInput field="pid" label="PID No" />
            <TextInput field="pid_issue_date" label="Issue Date" type="date" />
            <TextInput field="pid_expiry" label="Expiry Date" type="date" />
            <TextInput field="pid_projected_date" label="Projected PID Date" type="date" />
            <SelectInput field="pid_status" label="PID Status" options={PID_STATUSES} />
          </div>
        </Card>

        {/* Training */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4 text-primary">Training</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <TextInput field="training_date" label="Training Date" type="date" />
            <SelectInput field="training_status" label="Training Status" options={TRAINING_STATUSES} />
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Link to="/master-list"><Button variant="outline">Cancel</Button></Link>
          <Button type="submit" disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </div>
  );
}