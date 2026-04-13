import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Stethoscope, ShieldCheck, GraduationCap, BadgeCheck, Users, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import MultiSelect from '@/components/common/MultiSelect';
import { COMPANIES, DEPARTMENTS } from '@/utils/constants';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

export default function Dashboard() {
  const [companyFilter, setCompanyFilter] = useState([]);
  const [positionFilter, setPositionFilter] = useState([]);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 2000),
  });

  const positions = useMemo(() => {
    return [...new Set(employees.map(e => e.designation_org_chart).filter(Boolean))].sort().map(p => ({ value: p, label: p }));
  }, [employees]);

  const filtered = useMemo(() => {
    return employees.filter(e => {
      const matchCo = companyFilter.length === 0 || companyFilter.includes(e.company);
      const matchPos = positionFilter.length === 0 || positionFilter.includes(e.designation_org_chart);
      return matchCo && matchPos;
    });
  }, [employees, companyFilter, positionFilter]);

  const hasFilter = companyFilter.length > 0 || positionFilter.length > 0;

  const companyCounts = useMemo(() => {
    const allCompanies = new Set(filtered.map(e => e.company).filter(Boolean));
    const staticValues = new Set(COMPANIES.map(c => c.value));
    const extra = [...allCompanies].filter(v => !staticValues.has(v)).map(v => ({ value: v, label: v }));
    return [...COMPANIES, ...extra]
      .map(c => ({ name: c.label, count: filtered.filter(e => e.company === c.value).length }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const total = filtered.length;
  const validRlic = filtered.filter(e => e.rlic_status === 'VALID RLIC PASS').length;
  const expiredRlic = filtered.filter(e => e.rlic_status === 'EXPIRED RLIC PASS').length;
  const validPid = filtered.filter(e => e.pid_status === 'VALID PID PASS').length;
  const expiredPid = filtered.filter(e => e.pid_status === 'EXPIRED PID PASS').length;
  const medicalAccepted = filtered.filter(e => e.ftw_result === 'ACCEPTED').length;
  const trainingDone = filtered.filter(e => e.training_status === 'DONE').length;

  const categoryCards = [
    {
      title: 'Medical Data', icon: Stethoscope, color: 'text-blue-600', bg: 'bg-blue-50', path: '/medical',
      stats: [
        { label: 'Accepted', value: medicalAccepted, color: 'text-green-600' },
        { label: 'Pending', value: filtered.filter(e => e.ftw_result === 'PENDING').length, color: 'text-amber-600' },
        { label: 'Rejected', value: filtered.filter(e => e.ftw_result === 'REJECTED').length, color: 'text-red-600' },
      ],
    },
    {
      title: 'Gate Pass (RLIC)', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', path: '/gatepass',
      stats: [
        { label: 'Valid', value: validRlic, color: 'text-green-600' },
        { label: 'Expired', value: expiredRlic, color: 'text-red-600' },
        { label: 'Soon', value: filtered.filter(e => e.rlic_status === 'SOON TO EXPIRE').length, color: 'text-amber-600' },
      ],
    },
    {
      title: 'Project ID', icon: BadgeCheck, color: 'text-purple-600', bg: 'bg-purple-50', path: '/project-id',
      stats: [
        { label: 'Valid', value: validPid, color: 'text-green-600' },
        { label: 'Expired', value: expiredPid, color: 'text-red-600' },
        { label: 'Soon', value: filtered.filter(e => e.pid_status === 'SOON TO EXPIRE').length, color: 'text-amber-600' },
      ],
    },
    {
      title: 'Training', icon: GraduationCap, color: 'text-orange-600', bg: 'bg-orange-50', path: '/training',
      stats: [
        { label: 'Done', value: trainingDone, color: 'text-green-600' },
        { label: 'Pending', value: filtered.filter(e => e.training_status === 'PENDING').length, color: 'text-amber-600' },
        { label: 'N/A', value: filtered.filter(e => e.training_status === 'NOT REQUIRED').length, color: 'text-slate-500' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            GSO Qatar Workforce Overview
            {hasFilter && <span className="ml-2 text-primary font-medium">— Filtered: {total} personnel</span>}
            {!hasFilter && <span className="ml-1">— {total} Total Personnel</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-primary/10 text-primary rounded-lg px-4 py-2">
          <Users className="w-4 h-4" />
          <span className="font-bold text-lg">{total}</span>
          <span className="text-sm">Personnel</span>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Filter by Company</p>
            <MultiSelect
              options={COMPANIES.map(c => ({ value: c.value, label: c.label }))}
              value={companyFilter}
              onChange={setCompanyFilter}
              placeholder="All companies..."
            />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Filter by Position / Designation</p>
            <MultiSelect
              options={positions}
              value={positionFilter}
              onChange={setPositionFilter}
              placeholder="All positions..."
            />
          </div>
          {hasFilter && (
            <Button variant="outline" size="sm" onClick={() => { setCompanyFilter([]); setPositionFilter([]); }}>
              <X className="w-4 h-4 mr-1" /> Clear Filters
            </Button>
          )}
        </div>
        {hasFilter && (
          <p className="text-xs text-muted-foreground mt-2">
            Showing stats for <strong>{total}</strong> of <strong>{employees.length}</strong> personnel
          </p>
        )}
      </Card>

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
            {companyCounts.length === 0 ? (
              <p className="text-center text-muted-foreground py-10 text-sm">No data for selected filters</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(260, companyCounts.length * 28)}>
                <BarChart data={companyCounts} layout="vertical" margin={{ top: 4, right: 30, left: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {companyCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Pass &amp; Status Overview</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={[
                { category: 'RLIC Valid', count: validRlic },
                { category: 'RLIC Expired', count: expiredRlic },
                { category: 'PID Valid', count: validPid },
                { category: 'PID Expired', count: expiredPid },
                { category: 'Medical OK', count: medicalAccepted },
                { category: 'Training Done', count: trainingDone },
              ]} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="category" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {['#10b981','#ef4444','#3b82f6','#f97316','#8b5cf6','#06b6d4'].map((c, i) => (
                    <Cell key={i} fill={c} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Personnel by Department</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={DEPARTMENTS.map(d => ({ name: d, count: filtered.filter(e => e.department === d).length })).filter(d => d.count > 0)} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {['#3b82f6','#10b981','#f59e0b','#8b5cf6'].map((c, i) => <Cell key={i} fill={c} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Top Positions / Designations</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={Object.entries(
                  filtered.reduce((acc, e) => { if (e.designation_org_chart) acc[e.designation_org_chart] = (acc[e.designation_org_chart] || 0) + 1; return acc; }, {})
                ).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name: name.substring(0, 16), count }))}
                margin={{ top: 5, right: 10, left: -20, bottom: 40 }}
                layout="vertical"
              >
                <XAxis type="number" tick={{ fontSize: 9 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 8 }} width={110} />
                <Tooltip />
                <Bar dataKey="count" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}