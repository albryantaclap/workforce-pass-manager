import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Briefcase, Building2, GitBranch, Users, UserCheck, UserX, AlertCircle,
  TrendingUp, Layers,
} from 'lucide-react';
import OrganizationSubmenuNav from '@/components/common/OrganizationSubmenuNav';
import OrgChartTree from '@/components/organization/OrgChartTree';

const STATUSES = ['Planning', 'Active', 'On Hold', 'Completed', 'Closed', 'Archived'];

function KpiCard({ icon: Icon, label, value, sub, gradient }) {
  return (
    <Card className="p-4 flex items-start gap-3">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
        <p className="text-2xl font-bold leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

export default function OrganizationDashboard() {
  const { data: projects = [], isLoading: lp } = useQuery({
    queryKey: ['org-projects'],
    queryFn: async () => (await base44.entities.OrganizationProject.filter({}, { sort: '-created_date', limit: 1000 })).items,
  });
  const { data: units = [], isLoading: lu } = useQuery({
    queryKey: ['org-units'],
    queryFn: async () => (await base44.entities.OrgUnit.filter({ is_active: { $ne: false } }, { sort: '-created_date', limit: 5000 })).items,
  });
  const { data: positions = [], isLoading: lpo } = useQuery({
    queryKey: ['org-positions'],
    queryFn: async () => (await base44.entities.OrgPosition.filter({ is_active: { $ne: false } }, { sort: '-created_date', limit: 5000 })).items,
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-active'],
    queryFn: async () => (await base44.entities.Employee.filter({ is_active: true }, { sort: '-created_date', limit: 100000 })).items,
  });

  const loading = lp || lu || lpo;

  const stats = useMemo(() => {
    const activeProjects = projects.filter(p => p.status === 'Active').length;
    const departments = units.filter(u => u.unit_type === 'Department').length;
    const divisions = units.filter(u => u.unit_type === 'Division').length;
    const totalApproved = positions.reduce((s, p) => s + (p.approved_headcount || 0), 0);
    const totalFilled = positions.reduce((s, p) => s + (p.filled_headcount || 0), 0);
    const vacant = Math.max(0, totalApproved - totalFilled);
    const vacancyPct = totalApproved > 0 ? Math.round((vacant / totalApproved) * 100) : 0;
    return {
      totalProjects: projects.length,
      activeProjects,
      departments,
      divisions,
      totalPositions: positions.length,
      totalApproved,
      totalFilled,
      vacant,
      vacancyPct,
      totalPersonnel: employees.length,
    };
  }, [projects, units, positions, employees]);

  const byStatus = useMemo(() => {
    const counts = {};
    for (const s of STATUSES) counts[s] = 0;
    for (const p of projects) counts[p.status] = (counts[p.status] || 0) + 1;
    return STATUSES.map(s => ({ status: s, count: counts[s] || 0 }));
  }, [projects]);

  const headcountByUnitType = useMemo(() => {
    const m = {};
    for (const u of units) {
      const k = u.unit_type || 'Unassigned';
      m[k] = (m[k] || 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [units]);

  const maxUnitCount = Math.max(1, ...headcountByUnitType.map(([, n]) => n));

  return (
    <div className="space-y-5">
      <OrganizationSubmenuNav />

      <div>
        <h2 className="text-2xl font-bold tracking-tight">Organization Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Multi-project organizational structure, positions, and headcount overview.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading ? (
          Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)
        ) : (
          <>
            <KpiCard icon={Briefcase} label="Total Projects" value={stats.totalProjects} sub={`${stats.activeProjects} active`} gradient="from-violet-400 to-purple-600" />
            <KpiCard icon={Layers} label="Organizational Units" value={stats.departments + stats.divisions} sub={`${stats.departments} depts · ${stats.divisions} divs`} gradient="from-emerald-400 to-green-600" />
            <KpiCard icon={GitBranch} label="Total Positions" value={stats.totalPositions} sub={`${stats.totalApproved} approved headcount`} gradient="from-orange-400 to-orange-500" />
            <KpiCard icon={UserCheck} label="Filled Positions" value={stats.totalFilled} sub={`${stats.totalApproved - stats.totalFilled} vacant`} gradient="from-blue-400 to-blue-600" />
            <KpiCard icon={UserX} label="Vacant Positions" value={stats.vacant} sub={`${stats.vacancyPct}% vacancy`} gradient="from-rose-400 to-pink-600" />
            <KpiCard icon={Users} label="Total Personnel" value={stats.totalPersonnel} sub="from Master List" gradient="from-cyan-400 to-teal-600" />
            <KpiCard icon={AlertCircle} label="Pending Changes" value={0} sub="change requests pending" gradient="from-amber-400 to-yellow-500" />
            <KpiCard icon={TrendingUp} label="Active Projects" value={stats.activeProjects} sub="in progress" gradient="from-indigo-400 to-indigo-600" />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Projects by Status</h3>
          <div className="space-y-2.5">
            {byStatus.map(({ status, count }) => {
              const max = Math.max(1, ...byStatus.map(s => s.count));
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-24 text-muted-foreground">{status}</span>
                  <div className="flex-1 h-6 bg-muted/40 rounded-lg overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg flex items-center justify-end pr-2" style={{ width: `${(count / max) * 100}%` }}>
                      {count > 0 && <span className="text-[10px] font-bold text-white">{count}</span>}
                    </div>
                  </div>
                  <span className="text-xs font-semibold w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4">Units by Type</h3>
          <div className="space-y-2.5">
            {headcountByUnitType.length === 0 ? (
              <p className="text-sm text-muted-foreground">No units created yet.</p>
            ) : headcountByUnitType.map(([type, n]) => (
              <div key={type} className="flex items-center gap-3">
                <span className="text-xs font-medium w-32 text-muted-foreground">{type}</span>
                <div className="flex-1 h-6 bg-muted/40 rounded-lg overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-green-600 rounded-lg flex items-center justify-end pr-2" style={{ width: `${(n / maxUnitCount) * 100}%` }}>
                    {n > 0 && <span className="text-[10px] font-bold text-white">{n}</span>}
                  </div>
                </div>
                <span className="text-xs font-semibold w-6 text-right">{n}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Interactive Org Chart */}
      <Card className="p-5">
        <h3 className="font-semibold mb-1">Organization Chart</h3>
        <p className="text-xs text-muted-foreground mb-3">Hierarchical tree of projects, departments, and positions. Click a node to expand or collapse.</p>
        <OrgChartTree projects={projects} units={units} positions={positions} loading={loading} />
      </Card>

      {/* Quick links */}
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Manage Organization</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link to="/organization/projects" className="flex items-center gap-3 p-3 rounded-xl ring-1 ring-border hover:bg-muted/40 transition-colors">
            <Briefcase className="w-5 h-5 text-violet-600" />
            <div>
              <p className="text-sm font-semibold">Projects & Organizations</p>
              <p className="text-[11px] text-muted-foreground">Create and manage projects</p>
            </div>
          </Link>
          <Link to="/organization/units" className="flex items-center gap-3 p-3 rounded-xl ring-1 ring-border hover:bg-muted/40 transition-colors">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold">Departments & Divisions</p>
              <p className="text-[11px] text-muted-foreground">Build the unit hierarchy</p>
            </div>
          </Link>
          <Link to="/organization/positions" className="flex items-center gap-3 p-3 rounded-xl ring-1 ring-border hover:bg-muted/40 transition-colors">
            <GitBranch className="w-5 h-5 text-orange-600" />
            <div>
              <p className="text-sm font-semibold">Position Management</p>
              <p className="text-[11px] text-muted-foreground">Position registry & headcount</p>
            </div>
          </Link>
        </div>
      </Card>
    </div>
  );
}