import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Stethoscope, ShieldCheck, GraduationCap, BadgeCheck, Users, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend } from 'recharts';
import { COMPANIES } from '@/utils/constants';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

export default function Dashboard() {
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 2000),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  const total = employees.length;
  const validRlic = employees.filter(e => e.rlic_status === 'VALID RLIC PASS').length;
  const expiredRlic = employees.filter(e => e.rlic_status === 'EXPIRED RLIC PASS').length;
  const validPid = employees.filter(e => e.pid_status === 'VALID PID PASS').length;
  const expiredPid = employees.filter(e => e.pid_status === 'EXPIRED PID PASS').length;
  const medicalAccepted = employees.filter(e => e.ftw_result === 'ACCEPTED').length;
  const trainingDone = employees.filter(e => e.training_status === 'DONE').length;

  const companyCounts = COMPANIES.map(c => ({
    name: c.label,
    count: employees.filter(e => e.company === c.value).length,
  })).filter(c => c.count > 0);

  const categoryCards = [
    {
      title: 'Medical Data',
      icon: Stethoscope,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      path: '/medical',
      stats: [
        { label: 'Accepted', value: medicalAccepted, color: 'text-green-600' },
        { label: 'Pending', value: employees.filter(e => e.ftw_result === 'PENDING').length, color: 'text-amber-600' },
        { label: 'Rejected', value: employees.filter(e => e.ftw_result === 'REJECTED').length, color: 'text-red-600' },
      ],
    },
    {
      title: 'Gate Pass (RLIC)',
      icon: ShieldCheck,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      path: '/gatepass',
      stats: [
        { label: 'Valid', value: validRlic, color: 'text-green-600' },
        { label: 'Expired', value: expiredRlic, color: 'text-red-600' },
        { label: 'Soon', value: employees.filter(e => e.rlic_status === 'SOON TO EXPIRE').length, color: 'text-amber-600' },
      ],
    },
    {
      title: 'Project ID',
      icon: BadgeCheck,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      path: '/project-id',
      stats: [
        { label: 'Valid', value: validPid, color: 'text-green-600' },
        { label: 'Expired', value: expiredPid, color: 'text-red-600' },
        { label: 'Soon', value: employees.filter(e => e.pid_status === 'SOON TO EXPIRE').length, color: 'text-amber-600' },
      ],
    },
    {
      title: 'Training',
      icon: GraduationCap,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      path: '/training',
      stats: [
        { label: 'Done', value: trainingDone, color: 'text-green-600' },
        { label: 'Pending', value: employees.filter(e => e.training_status === 'PENDING').length, color: 'text-amber-600' },
        { label: 'N/A', value: employees.filter(e => e.training_status === 'NOT REQUIRED').length, color: 'text-slate-500' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">GSO Qatar Workforce Overview — {total} Total Personnel</p>
        </div>
        <div className="flex items-center gap-2 bg-primary/10 text-primary rounded-lg px-4 py-2">
          <Users className="w-4 h-4" />
          <span className="font-bold text-lg">{total}</span>
          <span className="text-sm">Personnel</span>
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categoryCards.map(card => (
          <Link key={card.title} to={card.path}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-transparent hover:border-l-primary">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                  <CardTitle className="text-sm font-semibold">{card.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {card.stats.map(s => (
                    <div key={s.label} className="text-center">
                      <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-[10px] text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Personnel by Company</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={companyCounts} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, count }) => count > 0 ? `${name.substring(0, 10)}: ${count}` : ''} labelLine={false}>
                  {companyCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Pass Status Overview</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={[
                { category: 'RLIC Valid', count: validRlic, fill: '#10b981' },
                { category: 'RLIC Expired', count: expiredRlic, fill: '#ef4444' },
                { category: 'PID Valid', count: validPid, fill: '#3b82f6' },
                { category: 'PID Expired', count: expiredPid, fill: '#f97316' },
                { category: 'Medical OK', count: medicalAccepted, fill: '#8b5cf6' },
                { category: 'Training Done', count: trainingDone, fill: '#06b6d4' },
              ]} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="category" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {[validRlic, expiredRlic, validPid, expiredPid, medicalAccepted, trainingDone].map((_, i) => (
                    <Cell key={i} fill={['#10b981','#ef4444','#3b82f6','#f97316','#8b5cf6','#06b6d4'][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}