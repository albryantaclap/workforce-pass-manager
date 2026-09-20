import React from 'react';
import {
  Package, ArrowDownCircle, ArrowUpCircle, Boxes, Activity,
  FileBarChart, Users, LayoutDashboard, Settings,
} from 'lucide-react';
import SubmenuNav from '@/components/common/SubmenuNav';

const INVENTORY_SUBMENU = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/inventory', exact: true, gradient: 'from-blue-400 to-blue-600' },
  { label: 'Items', icon: Package, path: '/inventory/items', gradient: 'from-indigo-400 to-indigo-600' },
  { label: 'Stock In', icon: ArrowDownCircle, path: '/inventory/stock-in', gradient: 'from-green-400 to-green-600' },
  { label: 'Stock Out', icon: ArrowUpCircle, path: '/inventory/stock-out', gradient: 'from-orange-400 to-orange-500' },
  { label: 'Available Stock', icon: Boxes, path: '/inventory/available', gradient: 'from-emerald-400 to-teal-600' },
  { label: 'Transactions', icon: Activity, path: '/inventory/transactions', gradient: 'from-cyan-400 to-blue-600' },
  { label: 'Reports', icon: FileBarChart, path: '/inventory/reports', gradient: 'from-purple-400 to-purple-600' },
  { label: 'Employee Issuance', icon: Users, path: '/inventory/employee-issuance', gradient: 'from-violet-400 to-purple-600' },
  { label: 'Inventory Settings', icon: Settings, path: '/inventory/settings', gradient: 'from-slate-400 to-slate-600' },
];

export default function InventorySubmenuNav() {
  return <SubmenuNav items={INVENTORY_SUBMENU} />;
}