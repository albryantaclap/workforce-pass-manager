import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, List, Stethoscope, ShieldCheck, BadgeCheck, GraduationCap, HardHat, Plus, Shield, LogOut, UserX, TrendingUp } from 'lucide-react';
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
  { label: 'Inactive Personnel', path: '/inactive', icon: UserX },
  { label: 'Projection Report', path: '/projection', icon: TrendingUp },
  { label: 'Admin Panel', path: '/admin', icon: Shield },
];

export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isAdmin, canEdit } = usePermissions();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
          <HardHat className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-wide">GSO QATAR</h1>
          <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Workforce Management</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.filter(item => {
          if (item.path === '/admin') return isAdmin;
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
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25'
                  : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-sidebar-border space-y-3">
        {user && (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground/80 truncate">{user.full_name || user.email}</p>
              <p className="text-[10px] text-sidebar-foreground/40">{ROLE_LABELS[user.role] || user.role}</p>
            </div>
            <button
              onClick={() => logout()}
              className="ml-2 flex-shrink-0 p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
        <p className="text-[10px] text-sidebar-foreground/40 text-center">© 2026 Workforce Manager</p>
      </div>
    </aside>
  );
}