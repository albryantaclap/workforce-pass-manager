import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil, User, Briefcase, FileText, Shield } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value || '—'}</p>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return format(parseISO(dateStr), 'dd MMM yyyy');
}

export default function EmployeeDetail() {
  const navigate = useNavigate();
  const pathParts = window.location.pathname.split('/');
  const empId = pathParts[pathParts.length - 1];

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employee', empId],
    queryFn: () => base44.entities.Employee.filter({ id: empId }),
  });

  const emp = employees?.[0];

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!emp) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Employee not found</p>
        <Link to="/employees"><Button variant="outline" className="mt-4">Back to List</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{emp.name}</h2>
            <p className="text-sm text-muted-foreground">{emp.designation_org_chart} · {emp.company}</p>
          </div>
        </div>
        <Link to={`/employees/${empId}/edit`}>
          <Button variant="outline"><Pencil className="w-4 h-4 mr-2" /> Edit</Button>
        </Link>
      </div>

      {/* Personal */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Personal Information</h3>
        </div>
        <div className="flex gap-6">
          {emp.photo_url && (
            <div className="flex-shrink-0">
              <img src={emp.photo_url} alt={emp.name} className="w-24 h-24 rounded-xl object-cover border border-border" />
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
            <InfoRow label="SL No" value={emp.sl_no} />
            <InfoRow label="Full Name" value={emp.name} />
            <InfoRow label="Nationality" value={emp.nationality} />
            <InfoRow label="Passport No" value={emp.pp_no} />
          </div>
        </div>
      </Card>

      {/* Work */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Work Information</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoRow label="Position (Application)" value={emp.position_application} />
          <InfoRow label="Designation" value={emp.designation_org_chart} />
          <InfoRow label="Company" value={emp.company} />
          <InfoRow label="Location" value={emp.current_location} />
          <InfoRow label="DIR / INDIR" value={emp.dir_indir} />
          <InfoRow label="Staff No" value={emp.staff_no} />
        </div>
      </Card>

      {/* QID & FTW */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">QID & FTW Details</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoRow label="QID Expiry" value={formatDate(emp.qid_expiry)} />
          <InfoRow label="FTW QID/PP" value={emp.ftw_qid_pp} />
          <InfoRow label="FTW Date Applied" value={formatDate(emp.ftw_date_applied)} />
          <InfoRow label="FTW Result" value={emp.ftw_result} />
        </div>
      </Card>

      {/* Pass Status */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Pass Status</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gate Pass / RLIC</h4>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Issue Date" value={formatDate(emp.gate_pass_issue_date)} />
              <InfoRow label="Received" value={formatDate(emp.gate_pass_received_date)} />
              <InfoRow label="Expiry" value={formatDate(emp.gate_pass_expiry)} />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</p>
                <div className="mt-1"><StatusBadge status={emp.rlic_status} /></div>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project ID</h4>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="PID" value={emp.pid} />
              <InfoRow label="Issue Date" value={formatDate(emp.pid_issue_date)} />
              <InfoRow label="Expiry" value={formatDate(emp.pid_expiry)} />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</p>
                <div className="mt-1"><StatusBadge status={emp.pid_status} /></div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}