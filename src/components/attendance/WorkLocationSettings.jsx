import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { MapPin, Plus, Pencil, Users, Search, Power, Crosshair } from 'lucide-react';
import WorkLocationFormDialog from './WorkLocationFormDialog';
import WorkLocationAssignDialog from './WorkLocationAssignDialog';
import WorkLocationEmployeesDialog from './WorkLocationEmployeesDialog';
import WorkLocationRulesCard from './WorkLocationRulesCard';
import { SITE_TYPES, hasCoordinates, logLocationActivity } from '@/lib/workLocations';

// Attendance Settings → Branch / Work Locations.
// Manages the WorkLocation register (the single source of truth for branches and
// their geofences) and the employee assignments behind it.
export default function WorkLocationSettings({ canEdit }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [assignTo, setAssignTo] = useState(null);
  const [employeesOf, setEmployeesOf] = useState(null);
  const [confirmToggle, setConfirmToggle] = useState(null);

  const locationsQuery = useQuery({
    queryKey: ['work-locations', search, statusFilter, typeFilter],
    queryFn: async () => {
      const q = {};
      if (search.trim()) {
        const rx = { $regex: search.trim(), $options: 'i' };
        q.$or = [
          { location_name: rx }, { location_code: rx },
          { project_name: rx }, { company: rx }, { address: rx },
        ];
      }
      if (statusFilter !== 'all') q.status = statusFilter;
      if (typeFilter !== 'all') q.site_type = typeFilter;
      const page = await base44.entities.WorkLocation.filter(q, { sort: 'location_name', limit: 300 });
      return page.items;
    },
    staleTime: 60000,
  });

  const countsQuery = useQuery({
    queryKey: ['work-location-assignment-counts'],
    queryFn: async () => {
      const { rows } = await base44.entities.WorkLocationAssignment.aggregate({
        query: { status: 'Active' }, groupBy: 'location_id', limit: 1000,
      });
      const map = {};
      for (const r of rows) map[r.location_id] = r.count;
      return map;
    },
    staleTime: 60000,
  });

  const statusQuery = useQuery({
    queryKey: ['work-location-status-counts'],
    queryFn: async () => {
      const { rows } = await base44.entities.WorkLocation.aggregate({ groupBy: 'status', limit: 50 });
      const map = { total: 0, Active: 0, Inactive: 0 };
      for (const r of rows) {
        map[r.status] = r.count;
        map.total += r.count;
      }
      return map;
    },
    staleTime: 60000,
  });

  const locations = locationsQuery.data || [];
  const counts = countsQuery.data || {};
  const statusCounts = statusQuery.data || { total: 0, Active: 0, Inactive: 0 };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['work-locations'] });
    qc.invalidateQueries({ queryKey: ['work-location-status-counts'] });
    qc.invalidateQueries({ queryKey: ['work-location-assignment-counts'] });
  };

  const toggleStatus = async (loc) => {
    const next = loc.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await base44.entities.WorkLocation.update(loc.id, { status: next, updated_by: user?.email || '' });
      await logLocationActivity(
        'update', 'WorkLocation', loc.id, loc.location_name,
        { location_name: loc.location_name, status: next }, ['status'], user?.email
      );
      refresh();
      toast({
        title: next === 'Active' ? `${loc.location_name} activated.` : `${loc.location_name} deactivated.`,
        description: next === 'Active' ? undefined : 'New punches are refused here. Existing attendance records are unchanged.',
      });
    } catch (e) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    } finally {
      setConfirmToggle(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-foreground">Branch / Work Locations</h3>
            <p className="text-sm text-muted-foreground">
              Branches employees may punch attendance at, with their allowed radius. Inactive locations are refused
              for new punches; existing attendance records are never changed.
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => setEditing({})} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-1.5" /> Add Location
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, code, project, company or address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {SITE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            {statusCounts.total} location{statusCounts.total === 1 ? '' : 's'}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
            {statusCounts.Active} active
          </span>
          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            {statusCounts.Inactive} inactive
          </span>
        </div>
      </Card>

      <WorkLocationRulesCard canEdit={canEdit} />

      {locationsQuery.isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : locations.length === 0 ? (
        <Card className="p-10 text-center space-y-2">
          <MapPin className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="font-medium text-foreground">No work locations found</p>
          <p className="text-sm text-muted-foreground">
            {search || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'No location matches the current search or filters.'
              : 'Add the branches and sites your personnel punch attendance at.'}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {locations.map((loc) => (
            <Card key={loc.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                    loc.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-muted text-muted-foreground')}>
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground truncate">{loc.location_name}</p>
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {loc.location_code}
                      </span>
                      <Badge variant={loc.status === 'Active' ? 'default' : 'secondary'}
                        className={loc.status === 'Active' ? 'bg-emerald-600 hover:bg-emerald-600' : ''}>
                        {loc.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[loc.site_type, loc.project_name, loc.company].filter(Boolean).join(' • ') || '—'}
                    </p>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Assign employees" onClick={() => setAssignTo(loc)}>
                      <Users className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit location" onClick={() => setEditing(loc)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      title={loc.status === 'Active' ? 'Deactivate location' : 'Activate location'}
                      onClick={() => (loc.status === 'Active' ? setConfirmToggle(loc) : toggleStatus(loc))}>
                      <Power className={cn('w-4 h-4', loc.status === 'Active' ? 'text-emerald-600' : 'text-muted-foreground')} />
                    </Button>
                  </div>
                )}
              </div>

              {loc.address && <p className="text-xs text-slate-600">{loc.address}</p>}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Crosshair className="w-3.5 h-3.5" />
                  {hasCoordinates(loc) ? `${loc.latitude}, ${loc.longitude}` : 'No coordinates'}
                </span>
                <span>Radius: {Math.round(Number(loc.radius_meters || 0))} m</span>
                <span>{loc.enforce_geofence === false ? 'Geofence off' : 'Geofence on'}</span>
                <button type="button" onClick={() => setEmployeesOf(loc)} className="text-primary hover:underline">
                  {counts[loc.id] || 0} employee{counts[loc.id] === 1 ? '' : 's'} assigned
                </button>
              </div>

              {loc.remarks && <p className="text-xs text-muted-foreground italic">{loc.remarks}</p>}
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <WorkLocationFormDialog
          location={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
      {assignTo && (
        <WorkLocationAssignDialog
          location={assignTo}
          onClose={() => setAssignTo(null)}
          onSaved={() => { setAssignTo(null); refresh(); }}
        />
      )}
      {employeesOf && (
        <WorkLocationEmployeesDialog location={employeesOf} onClose={() => setEmployeesOf(null)} />
      )}

      <AlertDialog open={!!confirmToggle} onOpenChange={(open) => { if (!open) setConfirmToggle(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {confirmToggle?.location_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Employees will no longer be able to punch attendance at this location. Attendance already recorded here
              is not changed, and you can activate the location again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toggleStatus(confirmToggle)}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}