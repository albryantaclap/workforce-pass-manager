import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, List, Stethoscope, ShieldCheck, BadgeCheck, GraduationCap,
  HardHat, Plus, Shield, LogOut, UserX, TrendingUp, Trash2, Activity, HardDrive,
  MessageCircle, FileText, Tent, Clock, Briefcase, Settings, Users, Timer,
  FileBarChart, ScanLine, ChevronRight, Package, ArrowDownCircle, ArrowUpCircle,
  Boxes, UserCheck, History, FileBarChart2, SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useRbac } from '@/lib/useRbac';
import { getRoutePermissionKey } from '@/lib/permissionCatalog';

const ROLE_LABELS = {
  owner: 'Super Administrator',
  admin: 'Admin',
  user: 'View Only',
  Admin: 'Admin',
  Manager: 'Manager',
  Supervisor: 'Supervisor',
  User: 'User',
  Custom: 'Custom',
};

// Standalone items rendered at the top (no group).
const standaloneItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
];

// Collapsible main groups. Each group has its own icon, a default landing
// route, and a list of subpages that reuse existing routes/permissions.
const navGroups = [
  {
    key: 'workforce',
    label: 'Workforce Management',
    icon: Briefcase,
    defaultPath: '/master-list',
    items: [
      { label: 'Master List', path: '/master-list', icon: List },
      { label: 'Add Personnel', path: '/employees/new', icon: Plus, requiredPermission: 'workforce.master_list.add' },
      { label: 'Medical', path: '/medical', icon: Stethoscope },
      { label: 'Gate Pass (RLIC)', path: '/gatepass', icon: ShieldCheck },
      { label: 'Project ID', path: '/project-id', icon: BadgeCheck },
      { label: 'Training', path: '/training', icon: GraduationCap },
      { label: 'COMO Camp', path: '/como-camp', icon: Tent },
      { label: 'Inactive / Demobilized', path: '/inactive', icon: UserX },
      { label: 'Reports', path: '/projection', icon: TrendingUp },
    ],
  },
  {
    key: 'attendance',
    label: 'Daily Attendance',
    icon: Clock,
    defaultPath: '/daily-attendance?tab=dashboard',
    items: [
      { label: 'Dashboard', path: '/daily-attendance?tab=dashboard', icon: LayoutDashboard },
      { label: 'Employee Summary', path: '/daily-attendance?tab=summary', icon: Users },
      { label: 'Attendance Clock', path: '/daily-attendance?tab=scan', icon: ScanLine },
      { label: 'Time Entries', path: '/daily-attendance?tab=entries', icon: Timer },
      { label: 'Attendance Reports', path: '/daily-attendance?tab=reports', icon: FileBarChart },
      { label: 'Attendance Settings', path: '/daily-attendance?tab=settings', icon: Settings },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory Management',
    icon: Package,
    defaultPath: '/inventory',
    items: [
      { label: 'Dashboard', path: '/inventory', icon: LayoutDashboard },
      { label: 'Inventory Items', path: '/inventory/items', icon: Boxes },
      { label: 'Stock In', path: '/inventory/stock-in', icon: ArrowDownCircle },
      { label: 'Stock Out', path: '/inventory/stock-out', icon: ArrowUpCircle },
      { label: 'Available Stock', path: '/inventory/available', icon: Package },
      { label: 'Employee Issuance', path: '/inventory/employee-issuance', icon: UserCheck },
      { label: 'Transaction History', path: '/inventory/transactions', icon: History },
      { label: 'Reports', path: '/inventory/reports', icon: FileBarChart2 },
      { label: 'Inventory Settings', path: '/inventory/settings', icon: SlidersHorizontal },
    ],
  },
  {
    key: 'system',
    label: 'System',
    icon: Settings,
    defaultPath: '/activity-log',
    items: [
      { label: 'Deleted Personnel', path: '/deleted-personnel', icon: Trash2 },
      { label: 'Activity Log', path: '/activity-log', icon: Activity },
      { label: 'Team Chat', path: '/chat', icon: MessageCircle },
      { label: 'Forms', path: '/forms', icon: FileText },
      { label: 'DB Backup', path: '/database-backup', icon: HardDrive },
      { label: 'Admin Panel', path: '/admin', icon: Shield },
      { label: 'User Management', path: '/user-management', icon: Users },
    ],
  },
];

// Split a path into its base route and optional ?tab= value.
function parsePath(path) {
  const [base, query] = path.split('?');
  let tab = null;
  if (query) {
    const params = new URLSearchParams(query);
    tab = params.get('tab');
  }
  return { base, tab };
}

export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { can, canView, isOwner, isBuilder, isSuperAdminOnly } = useRbac();

  // Pending access-request count — shown as a badge on User Management.
  // Only fetched for admins/builders who can list users.
  const canListUsers = isOwner || isBuilder || user?.role === 'admin';
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['pending-approvals-count'],
    queryFn: async () => {
      const all = await base44.entities.User.list('-created_date', 10000);
      return all.filter(u => !u.approval_status || u.approval_status === 'pending').length;
    },
    enabled: canListUsers,
    staleTime: 30000,
  });

  // Whether a single nav item is the active route (honoring ?tab= for attendance).
  const isActiveItem = (item) => {
    const { base, tab } = parsePath(item.path);
    if (location.pathname !== base) return false;
    if (tab) {
      const currentTab = new URLSearchParams(location.search).get('tab') || 'dashboard';
      return currentTab === tab;
    }
    // For '/', only exact match; for others, prefix match (existing behavior).
    return base === '/' ? location.pathname === '/' : true;
  };

  // Which group contains the currently active route (undefined for Dashboard).
  const activeGroupKey = useMemo(
    () => navGroups.find(g => g.items.some(isActiveItem))?.key,
    [location.pathname, location.search]
  );

  // Accordion state: only one group open at a time. Auto-open the active group
  // on first render and whenever the active group changes (covers refresh + nav).
  const [openGroup, setOpenGroup] = useState(activeGroupKey);
  const prevActive = useRef(activeGroupKey);
  useEffect(() => {
    if (activeGroupKey && activeGroupKey !== prevActive.current) {
      setOpenGroup(activeGroupKey);
    }
    prevActive.current = activeGroupKey;
  }, [activeGroupKey]);

  // RBAC-based per-item permission filter.
  const canShowItem = (item) => {
    // Super admin only: only DB Backup and Admin Panel (legacy behavior)
    if (isSuperAdminOnly) {
      return item.path === '/database-backup' || item.path === '/admin';
    }
    // Builder/owner: show everything
    if (isOwner || isBuilder) return true;
    // Item-specific permission (e.g. Add Personnel requires the 'add' action)
    if (item.requiredPermission) return can(item.requiredPermission);
    // RBAC: check view permission for this route
    const [base, query] = item.path.split('?');
    const resourceKey = getRoutePermissionKey(base, query ? `?${query}` : '');
    if (!resourceKey) return true; // unmapped routes = visible
    return canView(resourceKey);
  };

  const toggleGroup = (key) => {
    setOpenGroup(prev => (prev === key ? null : key));
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col shadow-xl">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sidebar-primary to-blue-400 flex items-center justify-center shadow-md">
          <HardHat className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-extrabold text-sm tracking-wide text-sidebar-foreground">GSO QATAR</h1>
          <p className="text-[9px] text-sidebar-foreground/40 uppercase tracking-[0.12em] mt-0.5">Workforce Management</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* Standalone Dashboard — hidden when workforce.dashboard.view is not granted */}
        {standaloneItems.filter(canShowItem).map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-sidebar-primary text-white shadow-md shadow-sidebar-primary/30'
                  : 'text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <item.icon className={cn('w-4 h-4 shrink-0', isActive ? 'opacity-100' : 'opacity-70')} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        {/* Collapsible groups */}
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(canShowItem);
          if (visibleItems.length === 0) return null;
          const isOpen = openGroup === group.key;
          const isGroupActive = activeGroupKey === group.key;

          return (
            <div key={group.key} className="space-y-0.5">
              {/* Group header — click toggles expand */}
              <button
                onClick={() => toggleGroup(group.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150',
                  isGroupActive
                    ? 'text-sidebar-foreground bg-sidebar-accent'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60'
                )}
              >
                <group.icon className={cn('w-4 h-4 shrink-0', isGroupActive ? 'opacity-100' : 'opacity-80')} />
                <span className="truncate flex-1 text-left">{group.label}</span>
                <ChevronRight
                  className={cn(
                    'w-4 h-4 shrink-0 transition-transform duration-200',
                    isOpen && 'rotate-90'
                  )}
                />
              </button>

              {/* Submenu — smooth height animation via grid-rows trick */}
              <div
                className={cn(
                  'grid transition-all duration-200 ease-out',
                  isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                )}
              >
                <div className="overflow-hidden">
                  <div className="pl-4 pt-1 space-y-0.5">
                    {visibleItems.map((item) => {
                      const isActive = isActiveItem(item);
                      const showBadge = item.path === '/user-management' && pendingCount > 0;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150',
                            isActive
                              ? 'bg-sidebar-primary text-white shadow-sm shadow-sidebar-primary/30'
                              : 'text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                          )}
                        >
                          <item.icon className={cn('w-3.5 h-3.5 shrink-0', isActive ? 'opacity-100' : 'opacity-70')} />
                          <span className="truncate flex-1">{item.label}</span>
                          {showBadge && (
                            <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                              {pendingCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        {user && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-sidebar-foreground/80 uppercase">
                {(user.full_name || user.email || '?').charAt(0)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-sidebar-foreground/80 truncate">{user.full_name || user.email}</p>
              <p className="text-[10px] text-sidebar-foreground/40">{ROLE_LABELS[user.rbac_role] || ROLE_LABELS[user.role] || user.rbac_role || user.role}</p>
            </div>
            <button
              onClick={() => logout()}
              className="shrink-0 p-1.5 rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <p className="text-[9px] text-sidebar-foreground/30 text-center mt-3">© 2026 Workforce Manager</p>
      </div>
    </aside>
  );
}