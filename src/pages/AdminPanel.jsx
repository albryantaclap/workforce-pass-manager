import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Users, Trash2, UserPlus, AlertTriangle, List } from 'lucide-react';
import LookupsManager from '../components/admin/LookupsManager';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';

export default function AdminPanel() {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);
  const [deduping, setDeduping] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: employees = [], isLoading: loadingEmps } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 2000),
  });

  const duplicates = useMemo(() => {
    const seen = new Map();
    const dupes = [];
    employees.forEach(emp => {
      if (!emp.qid_no) return;
      if (seen.has(emp.qid_no)) {
        dupes.push({ ...emp, original: seen.get(emp.qid_no) });
      } else {
        seen.set(emp.qid_no, emp);
      }
    });
    return dupes;
  }, [employees]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    await base44.users.inviteUser(inviteEmail, inviteRole);
    toast({ title: `Invitation sent to ${inviteEmail}` });
    setInviteEmail('');
    setInviting(false);
    queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const handleDedup = async () => {
    setDeduping(true);
    for (const dupe of duplicates) {
      await base44.entities.Employee.delete(dupe.id);
    }
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    toast({ title: `Removed ${duplicates.length} duplicate records` });
    setDeduping(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
          <Shield className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Admin Panel</h2>
          <p className="text-sm text-muted-foreground">User management & data quality</p>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users"><Users className="w-4 h-4 mr-2" />Users</TabsTrigger>
          <TabsTrigger value="dedup"><AlertTriangle className="w-4 h-4 mr-2" />Duplicates {duplicates.length > 0 && <span className="ml-1 bg-red-100 text-red-700 text-xs px-1.5 rounded-full">{duplicates.length}</span>}</TabsTrigger>
          <TabsTrigger value="lookups"><List className="w-4 h-4 mr-2" />Lookups</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <Card className="p-6">
            <h3 className="text-sm font-semibold mb-4">Invite New User</h3>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label className="text-xs mb-1.5 block">Email Address</Label>
                <Input type="email" required placeholder="user@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User (Viewer)</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={inviting}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {inviting ? 'Sending...' : 'Send Invite'}
                </Button>
              </div>
            </form>
            <p className="text-xs text-muted-foreground mt-3">
              <strong>User</strong> — Can view all data and export reports. &nbsp;|&nbsp; <strong>Administrator</strong> — Full access including add/edit/delete and admin panel.
            </p>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-3"><CardTitle className="text-sm">All Users</CardTitle></CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">Role</TableHead>
                  <TableHead className="text-xs">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingUsers ? (
                  Array(3).fill(0).map((_, i) => <TableRow key={i}>{Array(4).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
                ) : users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="text-sm font-medium">{u.full_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {u.role === 'admin' ? 'Administrator' : 'User'}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(u.created_date).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Dedup Tab */}
        <TabsContent value="dedup" className="space-y-4 mt-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Duplicate QID Check</h3>
                <p className="text-xs text-muted-foreground mt-1">Personnel with the same QID number — keeping the first entry, removing duplicates.</p>
              </div>
              {duplicates.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={deduping}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      {deduping ? 'Removing...' : `Remove ${duplicates.length} Duplicates`}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Duplicate Records?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete {duplicates.length} duplicate records (keeping the first occurrence of each QID). This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDedup} className="bg-destructive text-destructive-foreground">Remove Duplicates</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            {loadingEmps ? <Skeleton className="h-20 w-full" /> : duplicates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-4xl mb-2">✓</div>
                <p className="font-medium text-green-600">No duplicate QID numbers found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Name (Duplicate)</TableHead>
                      <TableHead className="text-xs">QID No</TableHead>
                      <TableHead className="text-xs">Company</TableHead>
                      <TableHead className="text-xs">Original Record</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {duplicates.map(d => (
                      <TableRow key={d.id} className="bg-red-50/50">
                        <TableCell className="text-xs font-medium text-red-700">{d.name}</TableCell>
                        <TableCell className="text-xs font-mono">{d.qid_no}</TableCell>
                        <TableCell className="text-xs">{d.company}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{d.original?.name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="lookups" className="mt-4">
          <LookupsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}