import React from 'react';
import { LayoutDashboard, Briefcase, Building2, GitBranch, Network } from 'lucide-react';
import SubmenuNav from '@/components/common/SubmenuNav';

const ORG_SUBMENU = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/organization', exact: true, gradient: 'from-blue-400 to-blue-600' },
  { label: 'Projects', icon: Briefcase, path: '/organization/projects', gradient: 'from-violet-400 to-purple-600' },
  { label: 'Departments', icon: Building2, path: '/organization/units', gradient: 'from-emerald-400 to-green-600' },
  { label: 'Positions', icon: GitBranch, path: '/organization/positions', gradient: 'from-orange-400 to-orange-500' },
  { label: 'Divisional Chart', icon: Network, path: '/organization/divisional-chart', gradient: 'from-blue-500 to-indigo-600' },
  { label: 'Visual Chart Builder', icon: Network, path: '/organization/charts', gradient: 'from-amber-400 to-orange-500' },
];

export default function OrganizationSubmenuNav() {
  return <SubmenuNav items={ORG_SUBMENU} />;
}