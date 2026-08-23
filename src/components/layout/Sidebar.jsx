import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, List, Stethoscope, ShieldCheck, BadgeCheck, GraduationCap, HardHat, Plus, Shield, LogOut, UserX, TrendingUp, Trash2, Activity, HardDrive, MessageCircle, FileText, Tent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/lib/usePermissions';

const ROLE_LABELS = {
  owner: 'Super Administrator',
  admin: 'Admin',
  user: 'View Only',
};

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Master List', path: '/master-list', icon: List },
  { label: 'Add Personnel', path: '/employees/new', icon: Plus },
  { label: 'Medical', path: '/medical', icon: Stethoscope },
  { label: 'Gate Pass (RLIC)', path: '/gatepass', icon: ShieldCheck },
  { label: 'Project ID', path: '/project-id', icon: BadgeCheck },
  { label: 'Training', path: '/training', icon: GraduationCap },
  { label: 'COMO Camp', path: '/como-camp', icon: Tent },

  { label: 'Inactive / Demobilized', path: '/inactive', icon: UserX },
  { label: 'Reports', path: '/projection', icon: TrendingUp },
  { label: 'Deleted Personnel', path: '/deleted-personnel', icon: Trash2 },
  { label: 'Activity Log', path: '/activity-log', icon: Activity },
  { label: 'Team Chat', path: '/chat', icon: MessageCircle },
  { label: 'Forms', path: '/forms', icon: FileText },
  { label: 'DB Backup', path: '/database-backup', icon: HardDrive },
  { label: 'Admin Panel', path: '/admin', icon: Shield },
];

export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isAdmin, isOwner, canEdit, isSuperAdminOnly } = usePermissions();

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
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.filter(item => {
          if (isSuperAdminOnly) {
            return item.path === '/database-backup' || item.path === '/admin';
          }
          if (item.path === '/admin') return isOwner;
          if (item.path === '/database-backup') return isOwner;
          if (item.path === '/chat') return true;
          if (item.path === '/employees/new') return canEdit;
          return true;
        }).map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
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
              <p className="text-[10px] text-sidebar-foreground/40">{ROLE_LABELS[user.role] || user.role}</p>
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