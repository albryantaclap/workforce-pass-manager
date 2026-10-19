import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { ShieldCheck } from 'lucide-react';

// Punch-location rules for the Branch / Work Locations tab. Kept here (rather
// than inside an existing tab) so the other Attendance Settings tabs stay
// exactly as they are.
export default function WorkLocationRulesCard({ canEdit }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [locationRequired, setLocationRequired] = useState(false);
  const [saving, setSaving] = useState('');

  const { data: settings } = useQuery({
    queryKey: ['attendance-settings'],
    queryFn: async () => (await base44.entities.AttendanceSetting.filter({ setting_key: 'global' }, undefined, 10))[0] || null,
    staleTime: 60000,
  });

  useEffect(() => {
    if (!settings) return;
    setGpsEnabled(settings.gps_verification_enabled === true);
    setLocationRequired(settings.require_location_on_punch === true);
  }, [settings]);

  const save = async (patch, message) => {
    if (!settings?.id) return;
    setSaving(Object.keys(patch)[0]);
    try {
      await base44.entities.AttendanceSetting.update(settings.id, { ...patch, updated_by: user?.email || '' });
      qc.invalidateQueries({ queryKey: ['attendance-settings'] });
      toast({ title: message });
    } catch (e) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving('');
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <p className="text-sm font-semibold text-foreground">Punch Location Rules</p>
      </div>
      <label className="flex items-start gap-3">
        <Switch
          checked={gpsEnabled}
          disabled={!canEdit || !settings || saving === 'gps_verification_enabled'}
          onCheckedChange={(v) => {
            setGpsEnabled(v);
            save({ gps_verification_enabled: v }, v ? 'GPS verification enabled.' : 'GPS verification disabled.');
          }}
        />
        <span>
          <span className="block text-sm font-medium text-foreground">Verify punches against the location geofence</span>
          <span className="block text-xs text-muted-foreground">
            When on, a punch recorded with GPS coordinates is accepted only inside the allowed radius of the selected
            location. Split-shift and cross-midnight punch rules are unaffected.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3">
        <Switch
          checked={locationRequired}
          disabled={!canEdit || !settings || saving === 'require_location_on_punch'}
          onCheckedChange={(v) => {
            setLocationRequired(v);
            save({ require_location_on_punch: v }, v ? 'Work location is now required on the first punch.' : 'Work location is optional again.');
          }}
        />
        <span>
          <span className="block text-sm font-medium text-foreground">Require a work location on the first punch of the day</span>
          <span className="block text-xs text-muted-foreground">
            When on, a branch must be selected before an employee can clock in (first punch). First Out, Second In and
            Final Out never require it, so a card can always be scanned to punch out.
          </span>
        </span>
      </label>
      {!canEdit && <p className="text-[11px] text-muted-foreground">You do not have permission to change these rules.</p>}
    </Card>
  );
}