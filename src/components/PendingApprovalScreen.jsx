import React from 'react';
import { Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function PendingApprovalScreen({ status = 'pending' }) {
  const handleLogout = () => base44.auth.logout('/');

  const config = {
    pending: {
      icon: '⏳',
      title: 'Account Pending Approval',
      message: 'Your account is pending approval. Please wait for the administrator to approve your access.',
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-200',
    },
    rejected: {
      icon: '🚫',
      title: 'Account Access Denied',
      message: 'Your account request has been rejected. Please contact your administrator for assistance.',
      color: 'text-red-600',
      bg: 'bg-red-50 border-red-200',
    },
  };

  const cfg = config[status] || config.pending;

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="text-6xl">{cfg.icon}</div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{cfg.title}</h1>
          <p className={`mt-3 text-sm leading-relaxed ${cfg.color} font-medium`}>{cfg.message}</p>
        </div>
        <div className={`border rounded-xl p-4 ${cfg.bg}`}>
          <p className="text-xs text-muted-foreground">
            {status === 'pending'
              ? 'An administrator will review your account shortly. You will be able to log in once approved.'
              : 'If you believe this is an error, please reach out to your system administrator.'}
          </p>
        </div>
        <Button variant="outline" onClick={handleLogout} className="gap-2">
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}