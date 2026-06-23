import React, { useMemo, useEffect } from 'react';
import FilterToolbar from '@/components/common/FilterToolbar';

/**
 * Thin wrapper around FilterToolbar for the tracker pages
 * (Medical, Gate Pass, Training, Project ID).
 * Handles cascading company options and clears stale selections.
 */
export default function TrackerFilters({
  filters, setters, options,
  totalFiltered, totalAll,
  employees = [],
  managers = [],
  selectedManagerId = '',
  selectedManagerIds = [],
  onManagerChange,
  onManagerIdsChange,
}) {
  const {
    companyFilter, positionFilter, departmentFilter,
    rlicStatusFilter, trainingStatusFilter, pidStatusFilter, medicalResultFilter,
    trainingScheduledFrom, trainingScheduledTo,
    trApprovedFrom, trApprovedTo,
    gpIssueFrom, gpIssueTo,
    gpReceivedFrom, gpReceivedTo,
    pidIssueFrom, pidIssueTo,
  } = filters;

  const {
    setCompanyFilter, setPositionFilter, setDepartmentFilter,
    setRlicStatusFilter, setTrainingStatusFilter, setPidStatusFilter, setMedicalResultFilter,
    setTrainingScheduledFrom, setTrainingScheduledTo,
    setTrApprovedFrom, setTrApprovedTo,
    setGpIssueFrom, setGpIssueTo,
    setGpReceivedFrom, setGpReceivedTo,
    setPidIssueFrom, setPidIssueTo,
  } = setters;

  // Cascade companies based on selected department
  const cascadedCompanyOptions = useMemo(() => {
    if (departmentFilter.length === 0) return options.companies;
    const deptSet = new Set(departmentFilter.map(d => d.trim().toLowerCase()));
    const validCompanies = new Set(
      employees
        .filter(e => deptSet.has((e.department || '').trim().toLowerCase()))
        .map(e => (e.company || '').trim().toUpperCase())
    );
    return options.companies.filter(c => validCompanies.has(c.value.trim().toUpperCase()));
  }, [options.companies, departmentFilter, employees]);

  // Drop stale company selections when department changes
  useEffect(() => {
    if (companyFilter.length === 0) return;
    const validSet = new Set(cascadedCompanyOptions.map(c => c.value.trim().toUpperCase()));
    const still = companyFilter.filter(cf => validSet.has(cf.trim().toUpperCase()));
    if (still.length !== companyFilter.length) setCompanyFilter(still);
  }, [cascadedCompanyOptions]);

  // Support both multi-select (new) and single-select (legacy)
  const effectiveManagerIds = onManagerIdsChange
    ? selectedManagerIds
    : (selectedManagerId ? [selectedManagerId] : []);

  const managerChange = onManagerIdsChange || ((ids) => onManagerChange?.(ids[0] || ''));

  const clearAll = () => {
    setCompanyFilter([]); setPositionFilter([]); setDepartmentFilter([]);
    setRlicStatusFilter([]); setTrainingStatusFilter([]); setPidStatusFilter([]);
    setMedicalResultFilter([]);
    setTrainingScheduledFrom(''); setTrainingScheduledTo('');
    setTrApprovedFrom(''); setTrApprovedTo('');
    setGpIssueFrom(''); setGpIssueTo('');
    setGpReceivedFrom?.(''); setGpReceivedTo?.('');
    setPidIssueFrom(''); setPidIssueTo('');
    onManagerChange?.('');
    onManagerIdsChange?.([]);
  };

  return (
    <FilterToolbar
      // Main
      companyFilter={companyFilter}
      setCompanyFilter={setCompanyFilter}
      companyOptions={cascadedCompanyOptions}
      departmentFilter={departmentFilter}
      setDepartmentFilter={setDepartmentFilter}
      departmentOptions={options.departments || []}
      positionFilter={positionFilter}
      setPositionFilter={setPositionFilter}
      positionOptions={options.positions || []}
      selectedManagerIds={effectiveManagerIds}
      onManagerIdsChange={managerChange}
      managers={managers}
      // Status
      rlicStatusFilter={rlicStatusFilter}
      setRlicStatusFilter={setRlicStatusFilter}
      rlicOptions={options.rlicStatuses || []}
      trainingStatusFilter={trainingStatusFilter}
      setTrainingStatusFilter={setTrainingStatusFilter}
      trainingOptions={options.trainingStatuses || []}
      pidStatusFilter={pidStatusFilter}
      setPidStatusFilter={setPidStatusFilter}
      pidOptions={options.pidStatuses || []}
      medicalResultFilter={medicalResultFilter}
      setMedicalResultFilter={setMedicalResultFilter}
      medicalOptions={options.medicalResults || []}
      // Dates
      trainingScheduledFrom={trainingScheduledFrom}
      setTrainingScheduledFrom={setTrainingScheduledFrom}
      trainingScheduledTo={trainingScheduledTo}
      setTrainingScheduledTo={setTrainingScheduledTo}
      trApprovedFrom={trApprovedFrom}
      setTrApprovedFrom={setTrApprovedFrom}
      trApprovedTo={trApprovedTo}
      setTrApprovedTo={setTrApprovedTo}
      gpIssueFrom={gpIssueFrom}
      setGpIssueFrom={setGpIssueFrom}
      gpIssueTo={gpIssueTo}
      setGpIssueTo={setGpIssueTo}
      gpReceivedFrom={gpReceivedFrom}
      setGpReceivedFrom={setGpReceivedFrom}
      gpReceivedTo={gpReceivedTo}
      setGpReceivedTo={setGpReceivedTo}
      pidIssueFrom={pidIssueFrom}
      setPidIssueFrom={setPidIssueFrom}
      pidIssueTo={pidIssueTo}
      setPidIssueTo={setPidIssueTo}
      // Meta
      totalFiltered={totalFiltered}
      totalAll={totalAll}
      onClearAll={clearAll}
    />
  );
}