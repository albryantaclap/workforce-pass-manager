import React from 'react';
import { Clock, LogOut, UserCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    title: 'Access Request Pending',
    message: 'Your account has been created successfully. Your request to access the GSO Qatar Workforce Management System is awaiting administrator approval.',
    subtext: 'You will be able to access the system once your request has been reviewed and approved.',
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
    iconColor: 'text-amber-500',
  },
  rejected: {
    icon: ShieldCheck,
    title: 'Account Access Denied',
    message: 'Your access request has been rejected. Please contact your system administrator for assistance.',
    subtext: 'If you believe this is an error, please reach out to your system administrator.',
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    iconColor: 'text-red-500',
  },
  inactive: {
    icon: ShieldCheck,
    title: 'Account Inactive',
    message: 'Your account has been deactivated. Please contact your system administrator to restore access.',
    subtext: 'Your account data is preserved. An administrator can reactivate your account at any time.',
    color: 'text-slate-600',
    bg: 'bg-slate-50 border-slate-200',
    iconColor: 'text-slate-500',
  },
  locked: {
    icon: ShieldCheck,
    title: 'Account Locked',
    message: 'Your account has been locked. Please contact your system administrator.',
    subtext: 'An administrator can unlock your account after verification.',
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    iconColor: 'text-red-500',
  },
};

export default function PendingApprovalScreen({ status = 'pending' }) {
  const handleLogout = () => base44.auth.logout('/');

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className={`mx-auto w-16 h-16 rounded-full ${cfg.bg} flex items-center justify-center`}>
          <Icon className={`w-8 h-8 ${cfg.iconColor}`} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{cfg.title}</h1>
          <p className={`mt-3 text-sm leading-relaxed ${cfg.color} font-medium`}>{cfg.message}</p>
        </div>
        <div className={`border rounded-xl p-4 ${cfg.bg}`}>
          <p className="text-xs text-muted-foreground">{cfg.subtext}</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <UserCircle className="w-3.5 h-3.5" />
          <span>Request Status: <strong className="capitalize">{status}</strong></span>
        </div>
        <Button variant="outline" onClick={handleLogout} className="gap-2">
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}