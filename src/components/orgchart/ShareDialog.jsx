import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';

const ROLES = [
  { key: 'administrator', label: 'Administrator — manage sharing and edit' },
  { key: 'editor', label: 'Editor — edit the chart' },
  { key: 'reviewer', label: 'Reviewer — read only, may review' },
  { key: 'viewer', label: 'Viewer — read only' },
];

export default function ShareDialog({ open, chart, onClose, onSave }) {
  const [users, setUsers] = useState([]);
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

  useEffect(() => {
    if (!open) return;
    setShares(chart?.shares || []);
    setLoading(true);
    base44.entities.User.list('-created_date', 300)
      .then(list => setUsers(Array.isArray(list) ? list : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [open, chart]);

  const addShare = (email) => {
    if (!email) return;
    const user = users.find(u => u.email === email);
    setShares(prev => [...prev.filter(s => s.user_email !== email), { user_email: email, user_name: user?.full_name || '', role: 'editor' }]);
    setPendingEmail('');
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSave(shares);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share “{chart?.name}”</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border p-2.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">{chart?.owner_name || chart?.owner_email || 'Owner'}</p>
              <p className="text-[10px] text-muted-foreground">{chart?.owner_email}</p>
            </div>
            <span className="text-[11px] font-semibold uppercase text-muted-foreground">Owner</span>
          </div>

          <div className="flex gap-2">
            <select
              value={pendingEmail}
              onChange={(e) => addShare(e.target.value)}
              className="flex-1 h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="">Add an app user…</option>
              {users
                .filter(u => u.email !== chart?.owner_email && !shares.some(s => s.user_email === u.email))
                .map(u => <option key={u.id} value={u.email}>{u.full_name || u.email} ({u.email})</option>)}
            </select>
            {loading && <Loader2 className="w-4 h-4 animate-spin self-center text-muted-foreground" />}
          </div>

          <div className="space-y-1.5">
            {shares.map(share => (
              <div key={share.user_email} className="flex items-center gap-2 rounded-md border p-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{share.user_name || share.user_email}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{share.user_email}</p>
                </div>
                <select
                  value={share.role}
                  onChange={(e) => setShares(prev => prev.map(s => (s.user_email === share.user_email ? { ...s, role: e.target.value } : s)))}
                  className="h-8 rounded-md border bg-background px-2 text-[11px]"
                >
                  {ROLES.map(role => <option key={role.key} value={role.key}>{role.label}</option>)}
                </select>
                <Button size="sm" variant="ghost" className="h-8 px-2 text-red-600" onClick={() => setShares(prev => prev.filter(s => s.user_email !== share.user_email))}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            {!shares.length && (
              <p className="text-[11px] text-muted-foreground">
                Not shared yet — everyone with access to Organization Management can edit this chart.
              </p>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground">
            Sharing uses the app's own sign-in. There are no public links, so personnel data is never exposed outside the app.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>Save sharing</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}