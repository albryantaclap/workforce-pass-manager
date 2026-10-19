import { base44 } from '@/api/base44Client';

/**
 * Branch / Work Location helpers.
 *
 * WorkLocation is the single source of truth for branches and their geofences
 * (the legacy `work_location` Lookup only holds a plain list of names and is
 * left untouched). WorkLocationAssignment is the employee ↔ location link that
 * supports multiple authorized locations, one primary location per employee and
 * assignment effective dates.
 *
 * Shared by the Attendance Settings tab and the attendance punch flow so the
 * geofence/assignment rules are applied in exactly one place.
 */

export const SITE_TYPES = [
  'Head Office',
  'Project Site',
  'Camp',
  'Warehouse',
  'Yard',
  'Workshop',
  'Other',
];

export const GEOFENCE = {
  within: 'Within Geofence',
  outside: 'Outside Geofence',
  noGps: 'No GPS',
  notEnforced: 'Not Enforced',
};

export const todayStr = () => new Date().toLocaleDateString('en-CA');

export const hasCoordinates = (loc) =>
  !!loc && loc.latitude !== '' && loc.longitude !== '' && loc.latitude != null && loc.longitude != null;

export const locationLabel = (loc) =>
  loc ? (loc.location_code ? `${loc.location_code} — ${loc.location_name}` : loc.location_name || '') : '';

/** Great-circle distance in meters. */
export function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (Number(v) * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/** Client-side preview of the geofence result (the punch itself is validated in validatePunchLocation). */
export function geofencePreview(loc, coords, gpsEnabled) {
  if (!loc) return { status: GEOFENCE.notEnforced, distanceM: null };
  if (!gpsEnabled || loc.enforce_geofence === false || !hasCoordinates(loc)) {
    return { status: GEOFENCE.notEnforced, distanceM: null };
  }
  if (!coords || coords.latitude == null || coords.longitude == null) {
    return { status: GEOFENCE.noGps, distanceM: null };
  }
  const distanceM = haversineMeters(coords.latitude, coords.longitude, loc.latitude, loc.longitude);
  return {
    status: distanceM <= Number(loc.radius_meters || 0) ? GEOFENCE.within : GEOFENCE.outside,
    distanceM,
  };
}

export async function getActiveLocations() {
  const page = await base44.entities.WorkLocation.filter(
    { status: 'Active' },
    { sort: 'location_name', limit: 1000 }
  );
  return page.items;
}

/** An assignment only authorizes punches while it is active, started and not ended. */
export function isEffectiveAssignment(a, dateStr = todayStr()) {
  if (!a || a.status === 'Inactive') return false;
  if (a.effective_date && a.effective_date > dateStr) return false;
  if (a.end_date && a.end_date < dateStr) return false;
  return true;
}

export async function getEmployeeAssignments(employeeId) {
  const page = await base44.entities.WorkLocationAssignment.filter(
    { employee_id: employeeId, status: { $ne: 'Inactive' } },
    { sort: '-created_date', limit: 200 }
  );
  return page.items;
}

/**
 * Authoritative punch-location check, used by recordPunch().
 * Throws a user-facing Error when the punch must be refused.
 *
 * Rules:
 *  - the location must exist and be Active (inactive locations can never be used
 *    for NEW punches; historical records are untouched),
 *  - when the employee has authorized locations, the punch must be at one of
 *    them (employees with no assignment are not restricted),
 *  - when GPS verification is enabled and the location enforces a geofence, the
 *    punch coordinates must fall inside the allowed radius.
 */
export async function validatePunchLocation({ employeeId, workLocationId, coords, settings }) {
  const loc = await base44.entities.WorkLocation.get(workLocationId);
  if (!loc) throw new Error('The selected work location no longer exists.');
  if (loc.status !== 'Active') {
    throw new Error(`${loc.location_name} is inactive and cannot be used for new attendance punches.`);
  }

  const assignments = await getEmployeeAssignments(employeeId);
  const authorized = assignments.filter((a) => isEffectiveAssignment(a));
  if (authorized.length > 0 && !authorized.some((a) => a.location_id === loc.id)) {
    throw new Error(`Not authorized to punch at ${loc.location_name}.`);
  }

  const gpsOn = settings?.gps_verification_enabled === true;
  const enforce = gpsOn && loc.enforce_geofence !== false && hasCoordinates(loc);
  let distanceM;
  let geofenceStatus;

  if (!enforce) {
    geofenceStatus = GEOFENCE.notEnforced;
  } else if (coords?.latitude == null || coords?.longitude == null) {
    geofenceStatus = GEOFENCE.noGps;
  } else {
    distanceM = haversineMeters(coords.latitude, coords.longitude, loc.latitude, loc.longitude);
    if (distanceM > Number(loc.radius_meters || 0)) {
      throw new Error(
        `Outside the geofence of ${loc.location_name} — you are ${distanceM} m away (allowed radius ${Math.round(Number(loc.radius_meters || 0))} m).`
      );
    }
    geofenceStatus = GEOFENCE.within;
  }

  return {
    location: loc,
    geofenceStatus,
    distanceM,
    latitude: coords?.latitude,
    longitude: coords?.longitude,
    accuracy: coords?.accuracy,
    verified: geofenceStatus === GEOFENCE.within || geofenceStatus === GEOFENCE.notEnforced,
  };
}

/** Fields stamped on the raw punch — only the ones we actually captured. */
export function punchLocationFields(resolved) {
  if (!resolved) return {};
  const f = {
    work_location_id: resolved.location.id,
    work_location_code: resolved.location.location_code || '',
    work_location_name: resolved.location.location_name || '',
    location: locationLabel(resolved.location),
    geofence_status: resolved.geofenceStatus,
    location_verified: resolved.verified,
  };
  if (resolved.latitude != null) f.latitude = resolved.latitude;
  if (resolved.longitude != null) f.longitude = resolved.longitude;
  if (resolved.accuracy != null) f.gps_accuracy_m = Math.round(resolved.accuracy);
  if (resolved.distanceM != null) f.distance_m = resolved.distanceM;
  return f;
}

/** Keeps exactly one primary location per employee. */
export async function setPrimaryAssignment(employeeId, assignmentId, assignments) {
  const others = (assignments || []).filter(
    (a) => a.employee_id === employeeId && a.id !== assignmentId && a.is_primary && a.status !== 'Inactive'
  );
  const updates = [
    ...others.map((a) => ({ id: a.id, is_primary: false })),
    { id: assignmentId, is_primary: true },
  ];
  await base44.entities.WorkLocationAssignment.bulkUpdate(updates);
}

export async function logLocationActivity(action, entityName, entityId, recordName, snapshot, changedFields, email) {
  await base44.entities.ActivityLog.create({
    action,
    entity_name: entityName,
    entity_id: entityId,
    performed_by: email || '',
    record_name: recordName || '',
    record_snapshot: snapshot || {},
    changed_fields: changedFields || [],
  });
}