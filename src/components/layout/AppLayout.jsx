import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRbac } from '@/lib/useRbac';
import AccessDenied from '@/components/AccessDenied';

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { canAccessRoute, isOwner, isBuilder } = useRbac();

  // Route-level permission enforcement — not just hidden menus.
  // Direct URL entry to a protected page shows Access Denied if unauthorized.
  const hasAccess = isOwner || isBuilder || canAccessRoute(location.pathname, location.search);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b bg-card">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-bold text-sm">WORKFORCE</span>
          <div className="w-9" />
        </div>

        <main className="p-4 md:p-6 lg:p-8">
          {hasAccess ? <Outlet /> : <AccessDenied />}
        </main>
      </div>
    </div>
  );
}