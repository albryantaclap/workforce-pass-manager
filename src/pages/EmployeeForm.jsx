import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';

const emptyForm = {
  sl_no: '', name: '', position_application: '', designation_org_chart: '',
  company: '', nationality: '', current_location: '', dir_indir: '',
  qid_expiry: '', pp_no: '', ftw_qid_pp: '', ftw_date_applied: '', ftw_result: '',
  gate_pass_issue_date: '', gate_pass_received_date: '', gate_pass_expiry: '',
  staff_no: '', rlic_status: '', pid_issue_date: '', pid_expiry: '', pid: '', pid_status: '',
};

export default function EmployeeForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const pathParts = window.location.pathname.split('/');
  const isEdit = pathParts.includes('edit');
  const empId = isEdit ? pathParts[pathParts.indexOf('edit') - 1] : null;

  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);

  const { data: existingEmp } = useQuery({
    queryKey: ['employee', empId],
    queryFn: () => base44.entities.Employee.filter({ id: empId }),
    enabled: !!empId,
  });

  useEffect(() => {
    if (existingEmp && existingEmp.length > 0) {
      const emp = existingEmp[0];
      setForm({
        ...emptyForm,
        ...Object.fromEntries(Object.entries(emp).filter(([_, v]) => v !== null && v !== undefined)),
      });
    }
  }, [existingEmp]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      const cleaned = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
      );
      if (isEdit && empId) {
        return base44.entities.Employee.update(empId, cleaned);
      }
      return base44.entities.Employee.create(cleaned);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({ title: isEdit ? 'Employee updated' : 'Employee created' });
      navigate('/employees');
    },
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/employees">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{isEdit ? 'Edit Employee' : 'Add Employee'}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Fill in employee details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Info */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4 text-primary">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">SL No</Label>
              <Input type="number" value={form.sl_no} onChange={e => handleChange('sl_no', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Full Name *</Label>
              <Input required value={form.name} onChange={e => handleChange('name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Position (Application)</Label>
              <Input value={form.position_application} onChange={e => handleChange('position_application', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Designation (Org Chart)</Label>
              <Input value={form.designation_org_chart} onChange={e => handleChange('designation_org_chart', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nationality</Label>
              <Input value={form.nationality} onChange={e => handleChange('nationality', e.target.value)} />
            </div>
          </div>
        </Card>

        {/* Work Info */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4 text-primary">Work Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Company *</Label>
              <Select value={form.company} onValueChange={v => handleChange('company', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GSOQ">GSOQ</SelectItem>
                  <SelectItem value="LMV">LMV</SelectItem>
                  <SelectItem value="WENMA">WENMA</SelectItem>
                  <SelectItem value="ENERTEC">ENERTEC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Location</Label>
              <Select value={form.current_location} onValueChange={v => handleChange('current_location', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="QATAR">Qatar</SelectItem>
                  <SelectItem value="COMO CAMP">COMO Camp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">DIR / INDIR</Label>
              <Select value={form.dir_indir} onValueChange={v => handleChange('dir_indir', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIR">Direct</SelectItem>
                  <SelectItem value="INDIR">Indirect</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Staff No / RLIC No</Label>
              <Input value={form.staff_no} onChange={e => handleChange('staff_no', e.target.value)} />
            </div>
          </div>
        </Card>

        {/* QID & Passport */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4 text-primary">QID & Passport</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">QID Expiry</Label>
              <Input type="date" value={form.qid_expiry} onChange={e => handleChange('qid_expiry', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Passport No</Label>
              <Input value={form.pp_no} onChange={e => handleChange('pp_no', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">FTW QID/PP</Label>
              <Input value={form.ftw_qid_pp} onChange={e => handleChange('ftw_qid_pp', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">FTW Date Applied</Label>
              <Input type="date" value={form.ftw_date_applied} onChange={e => handleChange('ftw_date_applied', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">FTW Result</Label>
              <Select value={form.ftw_result} onValueChange={v => handleChange('ftw_result', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACCEPTED">Accepted</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Gate Pass & Project ID */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4 text-primary">Gate Pass & Project ID</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Gate Pass Issue Date</Label>
              <Input type="date" value={form.gate_pass_issue_date} onChange={e => handleChange('gate_pass_issue_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Gate Pass Received</Label>
              <Input type="date" value={form.gate_pass_received_date} onChange={e => handleChange('gate_pass_received_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Gate Pass Expiry</Label>
              <Input type="date" value={form.gate_pass_expiry} onChange={e => handleChange('gate_pass_expiry', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">RLIC Status</Label>
              <Select value={form.rlic_status} onValueChange={v => handleChange('rlic_status', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VALID RLIC PASS">Valid</SelectItem>
                  <SelectItem value="EXPIRED RLIC PASS">Expired</SelectItem>
                  <SelectItem value="SOON TO EXPIRE">Soon to Expire</SelectItem>
                  <SelectItem value="NO RLIC PASS">No Pass</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">PID</Label>
              <Input value={form.pid} onChange={e => handleChange('pid', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">PID Issue Date</Label>
              <Input type="date" value={form.pid_issue_date} onChange={e => handleChange('pid_issue_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">PID Expiry</Label>
              <Input type="date" value={form.pid_expiry} onChange={e => handleChange('pid_expiry', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">PID Status</Label>
              <Select value={form.pid_status} onValueChange={v => handleChange('pid_status', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VALID PID PASS">Valid</SelectItem>
                  <SelectItem value="EXPIRED PID PASS">Expired</SelectItem>
                  <SelectItem value="SOON TO EXPIRE">Soon to Expire</SelectItem>
                  <SelectItem value="NO PID PASS">No Pass</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Link to="/employees"><Button variant="outline">Cancel</Button></Link>
          <Button type="submit" disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Employee' : 'Create Employee'}
          </Button>
        </div>
      </form>
    </div>
  );
}