import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Download, Upload, Trash2, Database, RefreshCw, CheckCircle2,
  AlertTriangle, Shield, FileJson, Clock, Users, Plus
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { usePermissions } from '@/lib/usePermissions';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function DatabaseBackup() {
  const { isOwner, isAdmin } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [notes, setNotes] = useState('');
  const [restoreTarget, setRestoreTarget] = useState(null);   // backup to restore
  const [deleteTarget, setDeleteTarget] = useState(null);     // backup to delete
  const [restoreProgress, setRestoreProgress] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: () => base44.entities.BackupRecord.list('-created_date', 100),
    refetchInterval: 10000,
  });

  // ─── Create Backup ─────────────────────────────────────────────────────
  const handleCreateBackup = async () => {
    setIsCreating(true);
    try {
      const res = await base44.functions.invoke('databaseBackup', {
        action: 'create_backup',
        filter_from: filterFrom || undefined,
        filter_to: filterTo || undefined,
        notes,
      });
      const data = res.data;
      if (data.success) {
        toast({ title: `Backup created — ${data.record_count} records`, description: data.backup.filename });
        queryClient.invalidateQueries({ queryKey: ['backups'] });
        setNotes('');
      } else {
        toast({ title: 'Backup failed', description: data.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  // ─── Download Backup ───────────────────────────────────────────────────
  const handleDownload = async (backup) => {
    try {
      const res = await fetch(backup.file_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  // ─── Restore Backup ────────────────────────────────────────────────────
  const handleRestore = async () => {
    if (!restoreTarget) return;
    setRestoreProgress('Restoring...');
    try {
      const res = await base44.functions.invoke('databaseBackup', {
        action: 'restore_backup',
        file_url: restoreTarget.file_url,
        backup_id: restoreTarget.id,
      });
      const data = res.data;
      if (data.success) {
        setRestoreProgress(null);
        setRestoreTarget(null);
        toast({
          title: 'Restore complete',
          description: `${data.inserted} inserted · ${data.updated} updated · ${data.total} total`,
        });
        queryClient.invalidateQueries({ queryKey: ['employees'] });
      } else {
        setRestoreProgress(null);
        toast({ title: 'Restore failed', description: data.error, variant: 'destructive' });
      }
    } catch (err) {
      setRestoreProgress(null);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // ─── Delete Backup ─────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await base44.functions.invoke('databaseBackup', {
        action: 'delete_backup',
        backup_id: deleteTarget.id,
      });
      if (res.data.success) {
        toast({ title: 'Backup deleted' });
        queryClient.invalidateQueries({ queryKey: ['backups'] });
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  };

  // ─── Import from file ──────────────────────────────────────────────────
  const handleFileImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setRestoreProgress('Uploading file...');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setRestoreProgress('Restoring from file...');
      const res = await base44.functions.invoke('databaseBackup', {
        action: 'restore_backup',
        file_url,
        backup_id: 'manual-import',
      });
      const data = res.data;
      if (data.success) {
        toast({
          title: 'Import complete',
          description: `${data.inserted} inserted · ${data.updated} updated · ${data.total} total`,
        });
        queryClient.invalidateQueries({ queryKey: ['employees'] });
      } else {
        toast({ title: 'Import failed', description: data.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setRestoreProgress(null);
      e.target.value = '';
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Shield className="w-14 h-14 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Admin Access Required</h2>
        <p className="text-muted-foreground mt-2">You do not have permission to access the backup module.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
          <Database className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Database Backup & Restore</h2>
          <p className="text-sm text-muted-foreground">Create, download, and restore employee data backups</p>
        </div>
      </div>

      {/* Create Backup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" /> Create New Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Filter: Created From (optional)</Label>
              <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Filter: Created To (optional)</Label>
              <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Input placeholder="e.g. Weekly backup, before bulk update..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleCreateBackup} disabled={isCreating} className="gap-2">
              {isCreating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating...</> : <><Database className="w-4 h-4" /> Create Backup</>}
            </Button>
            {isCreating && (
              <p className="text-sm text-muted-foreground animate-pulse">Fetching records in batches, please wait...</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import from File */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4 text-green-600" /> Import / Restore from File
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Upload a previously downloaded JSON backup file. Existing records with matching QID will be updated; new records will be inserted.</p>
          <div className="flex items-center gap-3">
            <label>
              <input type="file" accept=".json" className="hidden" onChange={handleFileImport} disabled={!!restoreProgress} />
              <Button variant="outline" asChild disabled={!!restoreProgress}>
                <span className="gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  {restoreProgress ? restoreProgress : 'Choose Backup File (.json)'}
                </span>
              </Button>
            </label>
            {restoreProgress && <p className="text-sm text-blue-600 animate-pulse">{restoreProgress}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Backup List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileJson className="w-4 h-4 text-slate-600" /> Backup History
            <span className="ml-auto text-xs font-normal text-muted-foreground">{backups.length} backups</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No backups yet. Create your first backup above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map(backup => (
                <div key={backup.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5">
                      {backup.status === 'completed'
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        : <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{backup.filename}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatDateTime(backup.created_date)}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" /> {backup.record_count ?? '—'} records
                        </span>
                        <span className="text-xs text-muted-foreground">{formatBytes(backup.file_size_bytes)}</span>
                        {backup.created_by_email && (
                          <span className="text-xs text-muted-foreground">by {backup.created_by_email}</span>
                        )}
                        {backup.notes && (
                          <span className="text-xs text-blue-600 italic">"{backup.notes}"</span>
                        )}
                        {(backup.filter_from || backup.filter_to) && (
                          <span className="text-xs text-amber-600">
                            {backup.filter_from && `From: ${backup.filter_from}`}
                            {backup.filter_from && backup.filter_to && ' · '}
                            {backup.filter_to && `To: ${backup.filter_to}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleDownload(backup)} className="gap-1.5 text-xs">
                      <Download className="w-3.5 h-3.5" /> Download
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setRestoreTarget(backup)} className="gap-1.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50">
                      <RefreshCw className="w-3.5 h-3.5" /> Restore
                    </Button>
                    {isOwner && (
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(backup)} className="gap-1.5 text-xs text-red-500 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!restoreTarget} onOpenChange={open => { if (!open) setRestoreTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Confirm Restore
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You are about to restore from:</p>
              <p className="font-mono text-xs bg-muted p-2 rounded">{restoreTarget?.filename}</p>
              <p>
                This will <strong>insert</strong> new records and <strong>update</strong> existing ones (matched by QID No).
                No existing data will be deleted.
              </p>
              {restoreProgress && <p className="text-blue-600 animate-pulse font-medium">{restoreProgress}</p>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!restoreProgress}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={!!restoreProgress} className="bg-blue-600 hover:bg-blue-700">
              {restoreProgress ? 'Restoring...' : 'Yes, Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" /> Delete Backup
            </AlertDialogTitle>
            <AlertDialogDescription>
              <p>Delete <strong>{deleteTarget?.filename}</strong>?</p>
              <p className="mt-1">This only removes the backup record. No employee data will be affected.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}