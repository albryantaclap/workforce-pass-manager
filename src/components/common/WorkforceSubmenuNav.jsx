import React from 'react';
import { LayoutDashboard, Users, Stethoscope, ShieldCheck, BadgeCheck, GraduationCap, Building2 } from 'lucide-react';
import SubmenuNav from '@/components/common/SubmenuNav';

const WORKFORCE_SUBMENU = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', exact: true, gradient: 'from-blue-400 to-blue-600' },
  { label: 'Master List', icon: Users, path: '/master-list', gradient: 'from-violet-400 to-purple-600' },
  { label: 'Medical', icon: Stethoscope, path: '/medical', gradient: 'from-rose-400 to-pink-600' },
  { label: 'Gate Pass', icon: ShieldCheck, path: '/gatepass', gradient: 'from-emerald-400 to-green-600' },
  { label: 'Project ID', icon: BadgeCheck, path: '/project-id', gradient: 'from-indigo-400 to-indigo-600' },
  { label: 'Training', icon: GraduationCap, path: '/training', gradient: 'from-orange-400 to-orange-500' },
  { label: 'COMO Camp', icon: Building2, path: '/como-camp', gradient: 'from-teal-400 to-cyan-600' },
];

export default function WorkforceSubmenuNav() {
  return <SubmenuNav items={WORKFORCE_SUBMENU} />;
}