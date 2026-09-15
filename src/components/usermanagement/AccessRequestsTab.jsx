import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Check, X, Clock, ShieldCheck, ShieldX } from 'lucide-react';
import { rejectUserAccess } from '@/lib/rbacService';
import { useToast } from '@/components/ui/use-toast';
import ApproveRequestModal from './ApproveRequestModal';

const STATUS_STYLES = {
  pending: { cls: 'bg-amber-100 text-amber-700', icon: Clock, label: 'Pending' },
  approved: { cls: 'bg-emerald-100 text-emerald-700', icon: ShieldCheck, label: 'Approved' },
  rejected: { cls: 'bg-red-100 text-red-700', icon: ShieldX, label: 'Rejected' },
};

function getEffectiveStatus(u) {
  if (!u.approval_status) {
    const created = u.created_date ? new Date(u.created_date).toISOString().split('T')[0] : '';
    return created >= '2026-09-15' ? 'pending' : 'approved';
  }
  return u.approval_status;
}

export default function AccessRequestsTab({ users, employees, currentUser, locations, onRefresh }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [approveUser, setApproveUser] = useState(null);
  const [rejectUser, setRejectUser] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const employeeMap = useMemo(() => {
    const m = {};
    for (const e of employees) m[e.id] = e;
    return m;
  }, [employees]);

  const filtered = useMemo(() => {
    return users
      .map(u => {
        const emp = employeeMap[u.personnel_id];
        const status = getEffectiveStatus(u);
        return { ...u, _employee: emp, _effectiveStatus: status };
      })
      .filter(u => {
        if (statusFilter === 'all') return true;
        return u._effectiveStatus === statusFilter;
      })
      .sort((a, b) => {
        // Pending first, then by created_date descending
        const order = { pending: 0, approved: 1, rejected: 2 };
        const diff = (order[a._effectiveStatus] ?? 3) - (order[b._effectiveStatus] ?? 3);
        if (diff !== 0) return diff;
        return new Date(b.created_date) - new Date(a.created_date);
      });
  }, [users, employeeMap, statusFilter]);

  const pendingCount = useMemo(
    () => users.filter(u => getEffectiveStatus(u) === 'pending').length,
    [users]
  );

  const handleReject = async () => {
    setRejecting(true);
    try {
      await rejectUserAccess(rejectUser.id, rejectUser, rejectReason, currentUser);
      toast({ title: 'Request rejected', description: `${rejectUser.email} has been denied access.` });
      setRejectUser(null);
      setRejectReason('');
      onRefresh();
    } catch (e) {
      toast({ title: 'Error', description: e.message || 'Failed to reject', variant: 'destructive' });
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Filter:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending ({pendingCount})</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All Requests</SelectItem>
          </SelectContent>
        </Select>
        {pendingCount > 0 && (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
            {pendingCount} pending review
          </Badge>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg table-scroll-x">
        <Table className="table-list-view">
          <TableHeader>
            <TableRow>
              <TableHead className="bg-muted/50">Request Date</TableHead>
              <TableHead className="bg-muted/50">Full Name</TableHead>
              <TableHead className="bg-muted/50">Email</TableHead>
              <TableHead className="bg-muted/50">Employee ID</TableHead>
              <TableHead className="bg-muted/50">Company</TableHead>
              <TableHead className="bg-muted/50">Dept</TableHead>
              <TableHead className="bg-muted/50">Position</TableHead>
              <TableHead className="bg-muted/50">Status</TableHead>
              <TableHead className="bg-muted/50 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No access requests found
                </TableCell>
              </TableRow>
            ) : filtered.map(u => {
              const emp = u._employee;
              const st = STATUS_STYLES[u._effectiveStatus] || STATUS_STYLES.pending;
              const isSelf = u.id === currentUser?.id;
              const isPending = u._effectiveStatus === 'pending';

              return (
                <TableRow key={u.id} className="hover:bg-muted/30">
                  <TableCell className="text-xs whitespace-nowrap">
                    {u.created_date ? new Date(u.created_date).toLocaleDateString('en-GB') : '—'}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {u.full_name || emp?.name || '—'}
                    {isSelf && <span className="text-muted-foreground ml-1">(You)</span>}
                  </TableCell>
                  <TableCell className="text-xs">{u.email || '—'}</TableCell>
                  <TableCell className="text-xs">{emp?.staff_no || emp?.qid_no || '—'}</TableCell>
                  <TableCell className="text-xs">{emp?.company || '—'}</TableCell>
                  <TableCell className="text-xs">{emp?.department || '—'}</TableCell>
                  <TableCell className="text-xs">{emp?.designation_org_chart || emp?.position_application || '—'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${st.cls}`}>
                      <st.icon className="w-3 h-3" /> {st.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {isPending && !isSelf && (
                        <>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                            onClick={() => setApproveUser(u)}
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700"
                            onClick={() => { setRejectUser(u); setRejectReason(''); }}
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {isPending && isSelf && (
                        <span className="text-xs text-muted-foreground">Cannot self-approve</span>
                      )}
                      {!isPending && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Approve Modal */}
      {approveUser && (
        <ApproveRequestModal
          user={approveUser}
          currentUser={currentUser}
          locations={locations}
          onClose={() => setApproveUser(null)}
          onSaved={onRefresh}
        />
      )}

      {/* Reject Modal */}
      {rejectUser && (
        <Dialog open onOpenChange={() => setRejectUser(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldX className="w-5 h-5 text-red-600" /> Reject Access Request
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="p-2.5 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">{rejectUser.full_name || rejectUser.email}</p>
                <p className="text-xs text-muted-foreground">{rejectUser.email}</p>
              </div>
              <div>
                <Label className="text-xs">Reason (optional but recommended)</Label>
                <Textarea
                  className="mt-1"
                  placeholder="e.g. Please contact HR to verify employment before requesting access..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The user's account will remain but they will not have system access. They can re-request access later.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectUser(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject} disabled={rejecting}>
                {rejecting ? 'Rejecting...' : 'Reject Request'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}