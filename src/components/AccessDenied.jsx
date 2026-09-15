import React from 'react';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function AccessDenied({ message }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
        <ShieldX className="w-8 h-8 text-red-500" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          {message || 'You do not have permission to access this page. Please contact your administrator if you believe this is an error.'}
        </p>
      </div>
      <Button variant="outline" onClick={() => navigate('/')}>
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Button>
    </div>
  );
}