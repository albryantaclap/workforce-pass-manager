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
 * Fetches all lookup types and merges with built-in constants.
 * Returns options arrays ready to pass to InlineEditCell or select dropdowns.
 */
export function useLookupOptions() {
  const lookupTypes = ['company', 'company_type', 'location', 'department', 'rlic_status', 'pid_status', 'ftw_result', 'training_status'];

  const queries = lookupTypes.map(type =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({
      queryKey: ['lookups', type],
      queryFn: () => base44.entities.Lookup.filter({ type }),
      staleTime: 60000,
    })
  );

  const [
    { data: customCompanies = [] },
    { data: customCompanyTypes = [] },
    { data: customLocations = [] },
    { data: customDepartments = [] },
    { data: customRlicStatuses = [] },
    { data: customPidStatuses = [] },
    { data: customMedicalResults = [] },
    { data: customTrainingStatuses = [] },
  ] = queries;

  const merge = (base, custom) => {
    const baseValues = new Set(base.map(b => b.value));
    const extras = custom.filter(c => !baseValues.has(c.value)).map(c => ({ value: c.value, label: c.label }));
    return [...base, ...extras];
  };

  return useMemo(() => ({
    companyOptions: merge(COMPANIES.map(c => ({ value: c.value, label: c.label })), customCompanies),
    companyTypeOptions: merge(COMPANY_TYPES, customCompanyTypes),
    locationOptions: merge(LOCATIONS.map(l => ({ value: l, label: l })), customLocations),
    departmentOptions: merge(DEPARTMENTS_BASE, customDepartments),
    rlicStatusOptions: merge(RLIC_STATUSES, customRlicStatuses),
    pidStatusOptions: merge(PID_STATUSES, customPidStatuses),
    medicalResultOptions: merge(MEDICAL_RESULTS, customMedicalResults),
    trainingStatusOptions: merge(TRAINING_STATUSES, customTrainingStatuses),
  }), [customCompanies, customCompanyTypes, customLocations, customDepartments, customRlicStatuses, customPidStatuses, customMedicalResults, customTrainingStatuses]);
}