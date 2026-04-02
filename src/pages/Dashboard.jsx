import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, ShieldCheck, ShieldAlert, ShieldOff, Clock } from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import CompanyChart from '../components/dashboard/CompanyChart';
import PassStatusChart from '../components/dashboard/PassStatusChart';
import ExpiryTimeline from '../components/dashboard/ExpiryTimeline';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 200),
  });

  const totalEmployees = employees.length;
  const validRlic = employees.filter(e => e.rlic_status === 'VALID RLIC PASS').length;
  const expiredRlic = employees.filter(e => e.rlic_status === 'EXPIRED RLIC PASS').length;
  const noPass = employees.filter(e => e.rlic_status === 'NO RLIC PASS').length;
  const soonExpire = employees.filter(e => e.rlic_status === 'SOON TO EXPIRE').length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">Workforce & pass management overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Employees" value={totalEmployees} icon={Users} color="primary" />
        <StatCard title="Valid RLIC" value={validRlic} icon={ShieldCheck} color="green" />
        <StatCard title="Expired RLIC" value={expiredRlic} icon={ShieldAlert} color="red" />
        <StatCard title="Soon to Expire" value={soonExpire} icon={Clock} color="amber" />
        <StatCard title="No Pass" value={noPass} icon={ShieldOff} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CompanyChart employees={employees} />
        <PassStatusChart employees={employees} />
      </div>

      <ExpiryTimeline employees={employees} />
    </div>
  );
}