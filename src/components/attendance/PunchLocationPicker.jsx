import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import WorkLocationCombobox from '@/components/attendance/WorkLocationCombobox';
import { useToast } from '@/components/ui/use-toast';
import { MapPin, Crosshair, Loader2, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { GEOFENCE, geofencePreview, hasCoordinates } from '@/lib/workLocations';

/**
 * Branch selector + GPS capture for the attendance clock. Purely presentational:
 * the clock owns the selection and the punch itself is validated against the
 * location's geofence in recordPunch() — this only previews the result so the
 * person punching sees where they stand before scanning.
 *
 * Renders nothing when no work locations are configured, so the clock looks
 * exactly as before until branches are added.
 */
export default function PunchLocationPicker({ locations = [], settings, value, onChange, coords, onCoordsChange }) {
  const { toast } = useToast();
  const [locating, setLocating] = useState(false);
  const gpsEnabled = settings?.gps_verification_enabled === true;
  const required = settings?.require_location_on_punch === true;
  const selected = locations.find((l) => l.id === value) || null;
  const preview = geofencePreview(selected, coords, gpsEnabled);

  const capture = () => {
    if (!navigator.geolocation) {
      toast({ title: 'GPS unavailable', description: 'This device does not provide a location.', variant: 'destructive' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onCoordsChange({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        toast({ title: 'Could not read the current position', description: err.message, variant: 'destructive' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (locations.length === 0 && !gpsEnabled) return null;

  const showGps = gpsEnabled || coords;

  return (
    <Card className="p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <MapPin className="w-4 h-4" />
          Work Location
        </div>

        {showGps && (
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="sm" onClick={capture} disabled={locating}>
              {locating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5 mr-1.5" />}
              {coords ? 'Refresh GPS' : 'Capture GPS'}
            </Button>
            {coords && (
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onCoordsChange(null)} title="Clear GPS">
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      <WorkLocationCombobox
        locations={locations}
        value={value}
        onChange={onChange}
        allowNone={!required}
      />

      {required && !value && (
        <p className="text-xs text-amber-700 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Select the work location before punching attendance.
        </p>
      )}

      {selected && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>{hasCoordinates(selected) ? `${selected.latitude}, ${selected.longitude} · radius ${Math.round(Number(selected.radius_meters || 0))} m` : 'No coordinates configured'}</span>
          {coords && <span>GPS ±{Math.round(coords.accuracy || 0)} m</span>}
          {preview.status === GEOFENCE.within && (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Inside geofence{preview.distanceM != null ? ` (${preview.distanceM} m)` : ''}
            </span>
          )}
          {preview.status === GEOFENCE.outside && (
            <span className="inline-flex items-center gap-1 text-red-600 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" /> Outside geofence ({preview.distanceM} m)
            </span>
          )}
          {preview.status === GEOFENCE.noGps && (
            <span className="inline-flex items-center gap-1 text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" /> GPS not captured
            </span>
          )}
        </div>
      )}
    </Card>
  );
}