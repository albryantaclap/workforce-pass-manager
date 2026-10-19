import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { Loader2, Crosshair } from 'lucide-react';
import { SITE_TYPES, logLocationActivity } from '@/lib/workLocations';

const blank = {
  location_name: '',
  location_code: '',
  site_type: 'Project Site',
  project_id: '',
  company: '',
  address: '',
  latitude: '',
  longitude: '',
  radius_meters: 150,
  enforce_geofence: true,
  status: 'Active',
  remarks: '',
};

function Field({ label, children, hint }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Add / edit a branch or work location. Location codes are validated unique and
// coordinates are range-checked before saving, so a punch can never be judged
// against a broken geofence.
export default function WorkLocationFormDialog({ location, onClose, onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ['org-projects', 'active-for-work-location'],
    queryFn: async () =>
      (await base44.entities.OrganizationProject.filter({ is_active: { $ne: false } }, { sort: 'project_name', limit: 500 })).items,
    staleTime: 300000,
  });

  useEffect(() => {
    if (!location) return;
    setForm({
      location_name: location.location_name || '',
      location_code: location.location_code || '',
      site_type: location.site_type || 'Project Site',
      project_id: location.project_id || '',
      company: location.company || '',
      address: location.address || '',
      latitude: location.latitude ?? '',
      longitude: location.longitude ?? '',
      radius_meters: location.radius_meters ?? 150,
      enforce_geofence: location.enforce_geofence !== false,
      status: location.status || 'Active',
      remarks: location.remarks || '',
    });
  }, [location]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const captureHere = () => {
    if (!navigator.geolocation) {
      toast({ title: 'GPS unavailable', description: 'This device does not provide a location.', variant: 'destructive' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        }));
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        toast({ title: 'Could not read the current position', description: err.message, variant: 'destructive' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const validate = () => {
    if (!form.location_name.trim()) return 'Location name is required.';
    if (!form.location_code.trim()) return 'Location code is required.';
    const lat = form.latitude === '' ? null : Number(form.latitude);
    const lng = form.longitude === '' ? null : Number(form.longitude);
    if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) return 'Latitude must be between -90 and 90.';
    if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) return 'Longitude must be between -180 and 180.';
    if ((lat === null) !== (lng === null)) return 'Enter both latitude and longitude, or leave both empty.';
    if (form.enforce_geofence && lat === null) return 'Geofence enforcement needs the location coordinates.';
    const radius = Number(form.radius_meters);
    if (!Number.isFinite(radius) || radius < 10) return 'Allowed attendance radius must be at least 10 meters.';
    return '';
  };

  const save = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setSaving(true);
    try {
      const code = form.location_code.trim().toUpperCase();
      const name = form.location_name.trim();
      const clash = await base44.entities.WorkLocation.filter({ location_code: code }, { limit: 5 });
      if (clash.items.some((l) => l.id !== location?.id)) {
        setError(`Location code ${code} is already used by another location.`);
        setSaving(false);
        return;
      }

      const project = projects.find((p) => p.id === form.project_id);
      const payload = {
        location_name: name,
        location_code: code,
        site_type: form.site_type,
        project_id: form.project_id || '',
        project_name: project?.project_name || '',
        company: form.company.trim(),
        address: form.address.trim(),
        radius_meters: Number(form.radius_meters),
        enforce_geofence: !!form.enforce_geofence,
        status: form.status,
        remarks: form.remarks.trim(),
        updated_by: user?.email || '',
      };
      if (form.latitude !== '') payload.latitude = Number(form.latitude);
      if (form.longitude !== '') payload.longitude = Number(form.longitude);

      if (location?.id) {
        await base44.entities.WorkLocation.update(location.id, payload);
        await logLocationActivity(
          'update', 'WorkLocation', location.id, name,
          { ...payload, previous_status: location.status }, Object.keys(payload), user?.email
        );
        toast({ title: 'Work location updated.' });
      } else {
        const created = await base44.entities.WorkLocation.create(payload);
        await logLocationActivity('create', 'WorkLocation', created.id, name, payload, [], user?.email);
        toast({ title: 'Work location added.' });
      }
      onSaved();
    } catch (e) {
      setError(e.message || 'Could not save this location.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{location?.id ? 'Edit Work Location' : 'Add Work Location'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Location Name *">
              <Input value={form.location_name} onChange={(e) => set('location_name', e.target.value)} placeholder="e.g. COMO Camp Gate 2" />
            </Field>
            <Field label="Location Code *" hint="Unique code stored with every punch.">
              <Input value={form.location_code} onChange={(e) => set('location_code', e.target.value)} placeholder="e.g. BR-CC-02" />
            </Field>
            <Field label="Branch / Site Type">
              <Select value={form.site_type} onValueChange={(v) => set('site_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SITE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Project">
              <Select value={form.project_id || 'none'} onValueChange={(v) => set('project_id', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Not project specific" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not project specific</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Company" hint="Leave empty when shared across companies.">
              <Input value={form.company} onChange={(e) => set('company', e.target.value)} />
            </Field>
          </div>

          <Field label="Address / Description">
            <Textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
          </Field>

          <div className="rounded-xl border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Geofence</p>
                <p className="text-[11px] text-muted-foreground">
                  Applied when GPS verification is enabled in Attendance Settings.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={captureHere} disabled={locating}>
                {locating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5 mr-1.5" />}
                Use current position
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Latitude">
                <Input type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} />
              </Field>
              <Field label="Longitude">
                <Input type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} />
              </Field>
              <Field label="Allowed Radius (meters)">
                <Input type="number" value={form.radius_meters} onChange={(e) => set('radius_meters', e.target.value)} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.enforce_geofence} onCheckedChange={(v) => set('enforce_geofence', v)} />
              Enforce this geofence on punches recorded with GPS
            </label>
          </div>

          <Field label="Remarks">
            <Textarea rows={2} value={form.remarks} onChange={(e) => set('remarks', e.target.value)} />
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {location?.id ? 'Save Changes' : 'Add Location'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}