import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { COMPANIES, RLIC_STATUSES, PID_STATUSES, MEDICAL_RESULTS, TRAINING_STATUSES, LOCATIONS } from '@/utils/constants';

const COMPANY_TYPES = [
  { value: 'Main', label: 'Main' },
  { value: 'Sub-contractor', label: 'Sub-contractor' },
  { value: 'GSO Supervision', label: 'GSO Supervision' },
];

const DEPARTMENTS_BASE = [
  { value: 'ELECTRICAL', label: 'ELECTRICAL' },
  { value: 'MECHANICAL', label: 'MECHANICAL' },
  { value: 'CIVIL', label: 'CIVIL' },
  { value: 'SERVICES', label: 'SERVICES' },
  { value: 'STEEL STRUCTURE', label: 'STEEL STRUCTURE' },
];

/**
 * Merges built-in constants with DB lookup records.
 * - DB records with is_builtin=true override the label of the matching built-in.
 * - DB records with is_deleted=true remove the built-in from options entirely.
 * - Custom DB records (is_builtin=false) that are not deleted are appended.
 */
function mergeLookups(base, allDbEntries) {
  // Map all DB records by uppercase value for O(1) lookup
  const dbByValue = {};
  allDbEntries.forEach(c => {
    dbByValue[c.value.toUpperCase()] = c;
  });

  const baseValueSet = new Set(base.map(b => b.value.toUpperCase()));

  // Process base (built-in) entries — apply DB label override, exclude if soft-deleted
  const baseEntries = base
    .filter(b => {
      const db = dbByValue[b.value.toUpperCase()];
      return !db || !db.is_deleted;
    })
    .map(b => {
      const db = dbByValue[b.value.toUpperCase()];
      const lbl = (db?.is_builtin && db?.label) ? db.label.toUpperCase() : b.label.toUpperCase();
      return { value: b.value, label: lbl };
    });

  // Custom entries: DB records that are NOT built-in overrides and NOT deleted
  const customEntries = allDbEntries
    .filter(c => !c.is_builtin && !c.is_deleted && !baseValueSet.has(c.value.toUpperCase()))
    .map(c => ({ value: c.value, label: c.label.toUpperCase() }));

  return [...baseEntries, ...customEntries];
}

/**
 * Fetches all lookup types and merges with built-in constants.
 * Respects soft-delete (is_deleted) and built-in label overrides (is_builtin).
 * Returns options arrays ready to pass to InlineEditCell or select dropdowns.
 */
export function useLookupOptions() {
  const lookupTypes = ['company', 'company_type', 'location', 'department', 'rlic_status', 'pid_status', 'ftw_result', 'training_status', 'nationality'];

  const queries = lookupTypes.map(type =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({
      queryKey: ['lookups', type],
      queryFn: () => base44.entities.Lookup.filter({ type }),
      staleTime: 60000,
    })
  );

  const [
    { data: dbCompanies = [] },
    { data: dbCompanyTypes = [] },
    { data: dbLocations = [] },
    { data: dbDepartments = [] },
    { data: dbRlicStatuses = [] },
    { data: dbPidStatuses = [] },
    { data: dbMedicalResults = [] },
    { data: dbTrainingStatuses = [] },
    { data: dbNationalities = [] },
  ] = queries;

  return useMemo(() => ({
    companyOptions: mergeLookups(COMPANIES.map(c => ({ value: c.value, label: c.label.toUpperCase() })), dbCompanies),
    companyTypeOptions: mergeLookups(COMPANY_TYPES, dbCompanyTypes),
    locationOptions: mergeLookups(LOCATIONS.map(l => ({ value: l.toUpperCase(), label: l.toUpperCase() })), dbLocations),
    departmentOptions: mergeLookups(DEPARTMENTS_BASE, dbDepartments),
    rlicStatusOptions: mergeLookups(
      RLIC_STATUSES.map(s => ({ value: s.value, label: s.label.toUpperCase() })),
      dbRlicStatuses
    ),
    pidStatusOptions: mergeLookups(
      PID_STATUSES.map(s => ({ value: s.value, label: s.label.toUpperCase() })),
      dbPidStatuses
    ),
    medicalResultOptions: mergeLookups(
      MEDICAL_RESULTS.map(s => ({ value: s.value, label: s.label.toUpperCase() })),
      dbMedicalResults
    ),
    trainingStatusOptions: mergeLookups(
      TRAINING_STATUSES.map(s => ({ value: s.value, label: s.label.toUpperCase() })),
      dbTrainingStatuses
    ),
    nationalityOptions: dbNationalities
      .filter(n => !n.is_deleted)
      .map(n => ({ value: n.value, label: n.label.toUpperCase() })),
  }), [dbCompanies, dbCompanyTypes, dbLocations, dbDepartments, dbRlicStatuses, dbPidStatuses, dbMedicalResults, dbTrainingStatuses, dbNationalities]);
}