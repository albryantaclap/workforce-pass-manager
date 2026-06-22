import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { useManagerFilter } from '@/hooks/useManagerFilter';
import { Stethoscope, ShieldCheck, GraduationCap, BadgeCheck, Users, X, Printer } from 'lucide-react';
import RecentUpdates from '@/components/dashboard/RecentUpdates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import MultiSelect from '@/components/common/MultiSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COMPANIES, DEPARTMENTS, RLIC_STATUSES, PID_STATUSES, TRAINING_STATUSES, MEDICAL_RESULTS, computePassStatus, formatDate, normalizeDate } from '@/utils/constants';
import DashboardReport from '@/components/dashboard/DashboardReport';
import ReportConfigModal from '@/components/dashboard/ReportConfigModal';
import ExpiryMonitoringCards from '@/components/dashboard/ExpiryMonitoringCards';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

export default function Dashboard() {
  const { selectedManagerIds, setSelectedManagerIds, managers } = useManagerFilter();
  const [companyFilter, setCompanyFilter] = useState([]);
  const [positionFilter, setPositionFilter] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState([]);
  const [rlicStatusFilter, setRlicStatusFilter] = useState([]);
  const [trainingStatusFilter, setTrainingStatusFilter] = useState([]);
  const [pidStatusFilter, setPidStatusFilter] = useState([]);
  const [medicalResultFilter, setMedicalResultFilter] = useState([]);
  const [locationFilter, setLocationFilter] = useState([]);
  const [dirIndirFilter, setDirIndirFilter] = useState('');
  const [trApprovedFrom, setTrApprovedFrom] = useState('');
  const [trApprovedTo, setTrApprovedTo] = useState('');
  const [trainingScheduledFrom, setTrainingScheduledFrom] = useState('');
  const [trainingScheduledTo, setTrainingScheduledTo] = useState('');
  const [gpIssueFrom, setGpIssueFrom] = useState('');
  const [gpIssueTo, setGpIssueTo] = useState('');
  const [gpReceivedFrom, setGpReceivedFrom] = useState('');
  const [gpReceivedTo, setGpReceivedTo] = useState('');
  const [pidIssueFrom, setPidIssueFrom] = useState('');
  const [pidIssueTo, setPidIssueTo] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [showReportConfig, setShowReportConfig] = useState(false);
  const [reportConfig, setReportConfig] = useState(null);

  // Only fetch active employees for the dashboard — dedicated filter avoids the 2000 list cap
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, '-created_date', 10000),
  });

  const { data: lookupCompanies = [] } = useQuery({
    queryKey: ['lookups', 'company'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'company' }),
  });
  const { data: lookupDepartments = [] } = useQuery({
    queryKey: ['lookups', 'department'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'department' }),
  });
  const { data: customRlicStatuses = [] } = useQuery({
    queryKey: ['lookups', 'rlic_status'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'rlic_status' }),
  });
  const { data: customPidStatuses = [] } = useQuery({
    queryKey: ['lookups', 'pid_status'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'pid_status' }),
  });
  const { data: customFtwResults = [] } = useQuery({
    queryKey: ['lookups', 'ftw_result'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'ftw_result' }),
  });
  const { data: customTrainingStatuses = [] } = useQuery({
    queryKey: ['lookups', 'training_status'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'training_status' }),
  });
  const { data: lookupLocations = [] } = useQuery({
    queryKey: ['lookups', 'location'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'location' }),
  });

  const allCompanyOptions = useMemo(() => {
    // Deduplicate by uppercase value to avoid e.g. "GSO QATAR" vs "GSO Qatar" duplicates
    const seen = new Set();
    const result = [];
    for (const c of [...COMPANIES.map(c => ({ value: c.value, label: c.label })), ...lookupCompanies.filter(c => !c.is_deleted).map(c => ({ value: c.value, label: c.label }))]) {
      const key = c.value.trim().toUpperCase();
      if (!seen.has(key)) { seen.add(key); result.push(c); }
    }
    return result;
  }, [lookupCompanies]);

  // Cascading company options: when department is selected, only show companies with employees in that dept
  const cascadedCompanyOptions = useMemo(() => {
    if (departmentFilter.length === 0) return allCompanyOptions;
    const deptSet = new Set(departmentFilter.map(d => d.trim().toLowerCase()));
    const validCompanies = new Set(
      employees
        .filter(e => deptSet.has((e.department || '').trim().toLowerCase()))
        .map(e => (e.company || '').trim().toUpperCase())
    );
    return allCompanyOptions.filter(c => validCompanies.has(c.value.trim().toUpperCase()));
  }, [allCompanyOptions, departmentFilter, employees]);

  // Reset company selections that are no longer valid after department filter changes
  useEffect(() => {
    if (companyFilter.length === 0) return;
    const validSet = new Set(cascadedCompanyOptions.map(c => c.value.trim().toUpperCase()));
    const still = companyFilter.filter(cf => validSet.has(cf.trim().toUpperCase()));
    if (still.length !== companyFilter.length) setCompanyFilter(still);
  }, [cascadedCompanyOptions]);

  const allDepartmentOptions = useMemo(() => {
    const allDepts = [];
    const seen = new Set();

    // Add built-in departments
    DEPARTMENTS.forEach(d => {
      const key = d.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        allDepts.push({ value: d, label: d.toUpperCase() });
      }
    });

    // Add custom lookup departments
    lookupDepartments.forEach(d => {
      const key = d.value.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        allDepts.push({ value: d.value, label: d.label.toUpperCase() });
      }
    });

    return allDepts;
  }, [lookupDepartments]);

  const allDepartments = useMemo(() => {
    return allDepartmentOptions.map(d => d.value);
  }, [allDepartmentOptions]);

  const positions = useMemo(() => {
    const seen = new Map();
    for (const e of employees) {
      const raw = (e.designation_org_chart || '').trim();
      if (!raw) continue;
      const key = raw.toUpperCase();
      if (!seen.has(key)) seen.set(key, raw);
    }
    return [...seen.values()].sort().map(p => ({ value: p, label: p }));
  }, [employees]);

  // Cascade positions by company, department, gate pass status, and PID status
  const filteredPositions = useMemo(() => {
    const hasFilter = companyFilter.length > 0 || departmentFilter.length > 0 || rlicStatusFilter.length > 0 || pidStatusFilter.length > 0;
    if (!hasFilter) return positions;
    const coSet = companyFilter.length > 0 ? new Set(companyFilter.map(c => c.trim().toUpperCase())) : null;
    const deptSet = departmentFilter.length > 0 ? new Set(departmentFilter.map(d => d.trim().toLowerCase())) : null;
    const seen = new Set();
    return employees
      .filter(e => {
        if (!e.designation_org_chart) return false;
        if (coSet && !coSet.has((e.company || '').trim().toUpperCase())) return false;
        if (deptSet && !deptSet.has((e.department || '').trim().toLowerCase())) return false;
        if (rlicStatusFilter.length > 0 && !rlicStatusFilter.includes(computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status))) return false;
        if (pidStatusFilter.length > 0 && !pidStatusFilter.includes(computePassStatus(e.pid_expiry, 'pid', e.pid_status))) return false;
        return true;
      })
      .map(e => e.designation_org_chart.trim())
      .filter(p => { if (seen.has(p)) return false; seen.add(p); return true; })
      .sort()
      .map(p => ({ value: p, label: p }));
  }, [employees, companyFilter, departmentFilter, rlicStatusFilter, pidStatusFilter]);

  // Reset position when any parent filter changes; keep only valid selections
  useEffect(() => {
    if (positionFilter.length === 0) return;
    const valid = new Set(filteredPositions.map(p => p.value));
    const still = positionFilter.filter(p => valid.has(p));
    if (still.length !== positionFilter.length) setPositionFilter(still);
  }, [filteredPositions]);

  const allRlicOptions = useMemo(() => {
    const allOptions = [];
    const seen = new Set();

    // Add built-in statuses
    RLIC_STATUSES.forEach(s => {
      const key = s.value.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        allOptions.push({ value: s.value, label: s.label.toUpperCase() });
      }
    });

    // Add custom statuses
    customRlicStatuses.forEach(s => {
      const key = s.value.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        allOptions.push({ value: s.value, label: s.label.toUpperCase() });
      }
    });

    return allOptions;
  }, [customRlicStatuses]);

  const allPidOptions = useMemo(() => {
    const allOptions = [];
    const seen = new Set();

    // Add built-in statuses
    PID_STATUSES.forEach(s => {
      const key = s.value.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        allOptions.push({ value: s.value, label: s.label.toUpperCase() });
      }
    });

    // Add custom statuses
    customPidStatuses.forEach(s => {
      const key = s.value.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        allOptions.push({ value: s.value, label: s.label.toUpperCase() });
      }
    });

    return allOptions;
  }, [customPidStatuses]);

  const allMedicalResultOptions = useMemo(() => {
    const allOptions = [];
    const seen = new Set();

    // Add built-in medical results
    MEDICAL_RESULTS.forEach(s => {
      const key = s.value.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        allOptions.push({ value: s.value, label: s.label.toUpperCase() });
      }
    });

    // Add custom medical results
    customFtwResults.forEach(s => {
      const key = s.value.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        allOptions.push({ value: s.value, label: s.label.toUpperCase() });
      }
    });

    return allOptions;
  }, [customFtwResults]);

  const allTrainingOptions = useMemo(() => {
    const allOptions = [];
    const seen = new Set();

    // Add built-in training statuses
    TRAINING_STATUSES.forEach(s => {
      const key = s.value.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        allOptions.push({ value: s.value, label: s.label.toUpperCase() });
      }
    });

    // Add custom training statuses
    customTrainingStatuses.forEach(s => {
      const key = s.value.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        allOptions.push({ value: s.value, label: s.label.toUpperCase() });
      }
    });

    return allOptions;
  }, [customTrainingStatuses]);

  const allLocationOptions = useMemo(() => {
    const allLocs = [];
    const seen = new Set();

    // Add built-in locations
    const LOCATIONS = ['QATAR', 'COMO CAMP', 'OTHER'];
    LOCATIONS.forEach(l => {
      const key = l.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        allLocs.push({ value: l, label: l });
      }
    });

    // Add custom lookup locations
    lookupLocations.forEach(l => {
      const key = l.value.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        allLocs.push({ value: l.value, label: l.label });
      }
    });

    return allLocs;
  }, [lookupLocations]);

  const filtered = useMemo(() => {
    return employees.filter(e => {
      if (e.is_active === false) return false;
      const empCompany = (e.company || '').trim().toUpperCase();
      const matchCo = companyFilter.length === 0 || companyFilter.some(cf => cf.trim().toUpperCase() === empCompany);
      const matchManager = selectedManagerIds.length === 0 || selectedManagerIds.some(mid =>
        e.assigned_manager_id ? e.assigned_manager_id === mid : e.assigned_manager_name === managers.find(m => m.id === mid)?.label
      );
      const matchPos = positionFilter.length === 0 || positionFilter.includes(e.designation_org_chart);
      const matchDept = departmentFilter.length === 0 || departmentFilter.includes(e.department);
      const matchLocation = locationFilter.length === 0 || locationFilter.includes(e.current_location);
      const matchDirIndir = !dirIndirFilter || (e.dir_indir || '').trim().toUpperCase() === dirIndirFilter.toUpperCase();
      const effectiveRlic = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
      const matchRlic = rlicStatusFilter.length === 0 || rlicStatusFilter.includes(effectiveRlic);
      const effectivePid = computePassStatus(e.pid_expiry, 'pid', e.pid_status);
      const matchPid = pidStatusFilter.length === 0 || pidStatusFilter.includes(effectivePid);
      const matchTraining = trainingStatusFilter.length === 0 || trainingStatusFilter.includes(e.training_status);
      const matchMedResult = medicalResultFilter.length === 0 || medicalResultFilter.includes(e.ftw_result);
      const trainSchedDate = normalizeDate(e.training_date_scheduled) || '';
      const matchTrainSchedFrom = !trainingScheduledFrom || trainSchedDate >= trainingScheduledFrom;
      const matchTrainSchedTo = !trainingScheduledTo || trainSchedDate <= trainingScheduledTo;
      const trDate = normalizeDate(e.ftw_approved_date) || '';
      const matchTrFrom = !trApprovedFrom || trDate >= trApprovedFrom;
      const matchTrTo = !trApprovedTo || trDate <= trApprovedTo;
      const gpIssueDateVal = normalizeDate(e.gate_pass_issue_date) || '';
      const matchGpIssueFrom = !gpIssueFrom || gpIssueDateVal >= gpIssueFrom;
      const matchGpIssueTo = !gpIssueTo || gpIssueDateVal <= gpIssueTo;
      const gpReceivedVal = normalizeDate(e.gate_pass_received_date) || '';
      const matchGpReceivedFrom = !gpReceivedFrom || gpReceivedVal >= gpReceivedFrom;
      const matchGpReceivedTo = !gpReceivedTo || gpReceivedVal <= gpReceivedTo;
      const pidDate = normalizeDate(e.pid_issue_date) || '';
      const matchPidFrom = !pidIssueFrom || pidDate >= pidIssueFrom;
      const matchPidTo = !pidIssueTo || pidDate <= pidIssueTo;
      return matchCo && matchPos && matchDept && matchLocation && matchDirIndir && matchRlic && matchPid && matchTraining && matchMedResult && matchTrainSchedFrom && matchTrainSchedTo && matchTrFrom && matchTrTo && matchGpIssueFrom && matchGpIssueTo && matchGpReceivedFrom && matchGpReceivedTo && matchPidFrom && matchPidTo && matchManager;
    });
  },     [employees, companyFilter, positionFilter, departmentFilter, locationFilter, dirIndirFilter, rlicStatusFilter, trainingStatusFilter, pidStatusFilter, medicalResultFilter, trainingScheduledFrom, trainingScheduledTo, customRlicStatuses, customPidStatuses, trApprovedFrom, trApprovedTo, gpIssueFrom, gpIssueTo, gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo, selectedManagerIds, managers]);

  const hasFilter = selectedManagerIds.length > 0 || companyFilter.length > 0 || positionFilter.length > 0 || departmentFilter.length > 0 || locationFilter.length > 0 || !!dirIndirFilter || rlicStatusFilter.length > 0 || trainingStatusFilter.length > 0 || pidStatusFilter.length > 0 || medicalResultFilter.length > 0 || !!trainingScheduledFrom || !!trainingScheduledTo || !!trApprovedFrom || !!trApprovedTo || !!gpIssueFrom || !!gpIssueTo || !!gpReceivedFrom || !!gpReceivedTo || !!pidIssueFrom || !!pidIssueTo;

  const companyCounts = useMemo(() => {
    const knownValues = new Set(allCompanyOptions.map(c => c.value));
    const dataCompanies = [...new Set(filtered.map(e => e.company).filter(Boolean))];
    const extra = dataCompanies.filter(v => !knownValues.has(v)).map(v => ({ value: v, label: v }));
    return [...allCompanyOptions, ...extra]
      .map(c => ({ name: c.label, count: filtered.filter(e => e.company === c.value).length }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [filtered, allCompanyOptions]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const total = filtered.length;
  const dirCount = filtered.filter(e => (e.dir_indir || '').trim().toUpperCase() === 'DIR').length;
  const indirCount = filtered.filter(e => (e.dir_indir || '').trim().toUpperCase() === 'INDIR').length;
  const dirIndirUnknown = total - dirCount - indirCount;
  const getRlic = e => computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
  const getPid = e => computePassStatus(e.pid_expiry, 'pid', e.pid_status);
  const validRlic = filtered.filter(e => getRlic(e) === 'VALID RLIC PASS').length;
  const expiredRlic = filtered.filter(e => getRlic(e) === 'EXPIRED RLIC PASS').length;
  const validPid = filtered.filter(e => getPid(e) === 'VALID PID PASS').length;
  const expiredPid = filtered.filter(e => getPid(e) === 'EXPIRED PID PASS').length;
  const medicalAccepted = filtered.filter(e => e.ftw_result === 'ACCEPTED').length;
  const trainingDone = filtered.filter(e => e.training_status === 'DONE').length;
  const trainingOnGoing = filtered.filter(e => ['ON-GOING', 'ONGOING', 'ON GOING'].includes((e.training_status || '').trim().toUpperCase())).length;

  const medicalReAssess = filtered.filter(e => e.ftw_result === 'RE-ASSESS').length;

  // Build medical stats — "New" = no ftw_result set at all
  const medicalNew = filtered.filter(e => !e.ftw_result).length;
  const medicalWaitingTr = filtered.filter(e => e.ftw_result === 'WAITING TR APPROVAL').length;
  const medicalRejected = filtered.filter(e => e.ftw_result === 'REJECTED').length;
  const medicalStatBreakdown = [
    { label: 'Waiting TR', value: medicalWaitingTr, color: 'text-amber-600' },
    { label: 'Rejected', value: medicalRejected, color: 'text-red-600' },
    { label: 'Re-Assess', value: medicalReAssess, color: 'text-purple-600' },
    // Custom lookup results (e.g. "Recalled") — exclude base results already shown above
    ...customFtwResults
      .filter(r => !['ACCEPTED', 'REJECTED', 'WAITING TR APPROVAL', 'RE-ASSESS'].includes(r.value))
      .map(r => ({
        label: r.label,
        value: filtered.filter(e => e.ftw_result === r.value).length,
        color: 'text-slate-600',
      })),
  ];
  const medicalOverallTotal = medicalAccepted + medicalStatBreakdown.reduce((sum, s) => sum + s.value, 0);

  // Custom RLIC statuses (e.g. "Under Process") — count all non-built-in rlic statuses
  const customRlicCounts = customRlicStatuses.map(s => ({
    label: s.label,
    value: filtered.filter(e => getRlic(e) === s.value).length,
    color: 'text-blue-600',
  }));

  const categoryCards = [
    {
      title: 'Medical Data', icon: Stethoscope, color: 'text-blue-600', bg: 'bg-blue-50', path: '/medical',
      combined: medicalAccepted,
      combinedLabel: 'Accepted',
      stats: medicalStatBreakdown,
    },
    {
      title: 'Gate Pass (RLIC)', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', path: '/gatepass',
      combined: validRlic + filtered.filter(e => getRlic(e) === 'SOON TO EXPIRE').length,
      combinedLabel: 'Total Valid',
      overallTotal: validRlic + filtered.filter(e => getRlic(e) === 'SOON TO EXPIRE').length + expiredRlic + customRlicCounts.reduce((sum, s) => sum + s.value, 0),
      stats: [
        { label: 'Valid', value: validRlic, color: 'text-green-600' },
        { label: 'Soon', value: filtered.filter(e => getRlic(e) === 'SOON TO EXPIRE').length, color: 'text-amber-600' },
        { label: 'Expired', value: expiredRlic, color: 'text-red-600' },
        ...customRlicCounts,
      ],
    },
    {
      title: 'Training', icon: GraduationCap, color: 'text-orange-600', bg: 'bg-orange-50', path: '/training',
      combined: trainingDone,
      combinedLabel: 'Done',
      stats: [
        { label: 'On-Going', value: trainingOnGoing, color: 'text-orange-600' },
        { label: 'Pending', value: filtered.filter(e => e.training_status === 'PENDING').length, color: 'text-amber-600' },
        { label: 'N/A', value: filtered.filter(e => e.training_status === 'NOT REQUIRED').length, color: 'text-slate-500' },
        ...customTrainingStatuses.map(s => ({
          label: s.label,
          value: filtered.filter(e => e.training_status === s.value).length,
          color: 'text-blue-600',
        })),
      ],
    },
    {
      title: 'Project ID', icon: BadgeCheck, color: 'text-purple-600', bg: 'bg-purple-50', path: '/project-id',
      combined: validPid + filtered.filter(e => getPid(e) === 'SOON TO EXPIRE').length,
      combinedLabel: 'Total Valid',
      overallTotal: (() => {
        const soonPid = filtered.filter(e => getPid(e) === 'SOON TO EXPIRE').length;
        const customPidCounts = customPidStatuses
          .filter(s => !['VALID PID PASS', 'EXPIRED PID PASS', 'SOON TO EXPIRE', 'NO PID PASS'].includes(s.value))
          .reduce((sum, s) => sum + filtered.filter(e => getPid(e) === s.value).length, 0);
        return validPid + soonPid + expiredPid + customPidCounts;
      })(),
      stats: [
        { label: 'Valid', value: validPid, color: 'text-green-600' },
        { label: 'Soon', value: filtered.filter(e => getPid(e) === 'SOON TO EXPIRE').length, color: 'text-amber-600' },
        { label: 'Expired', value: expiredPid, color: 'text-red-600' },
        ...customPidStatuses
          .filter(s => !['VALID PID PASS', 'EXPIRED PID PASS', 'SOON TO EXPIRE', 'NO PID PASS'].includes(s.value))
          .map(s => ({
            label: s.label,
            value: filtered.filter(e => getPid(e) === s.value).length,
            color: 'text-slate-600',
          })),
      ],
    },
  ];

  const clearFilters = () => {
    setSelectedManagerIds([]);
    setCompanyFilter([]); setPositionFilter([]); setDepartmentFilter([]); setLocationFilter([]);
    setDirIndirFilter('');
    setRlicStatusFilter([]); setTrainingStatusFilter([]); setPidStatusFilter([]);
    setMedicalResultFilter([]); setTrainingScheduledFrom(''); setTrainingScheduledTo('');
    setTrApprovedFrom(''); setTrApprovedTo(''); setGpIssueFrom(''); setGpIssueTo('');
    setGpReceivedFrom(''); setGpReceivedTo('');
    setPidIssueFrom(''); setPidIssueTo('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">
            GSO Qatar Workforce Overview
            {hasFilter
              ? <span className="ml-2 text-primary font-semibold">· Filtered: {total} personnel</span>
              : <span className="ml-1">· {total} total active personnel</span>}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={() => setShowReportConfig(true)} className="gap-1.5">
            <Printer className="w-4 h-4" /> Print / PDF
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 shadow-md shadow-primary/25">
              <Users className="w-4 h-4" />
              <span className="font-bold text-lg leading-none">{total}</span>
              <span className="text-xs opacity-80">Total</span>
            </div>
            <div className="flex items-center gap-1.5 bg-blue-600 text-white rounded-xl px-3 py-2 shadow-md shadow-blue-600/25">
              <span className="text-xs font-medium opacity-80">DIR</span>
              <span className="font-bold text-lg leading-none">{dirCount}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-600 text-white rounded-xl px-3 py-2 shadow-md shadow-slate-600/25">
              <span className="text-xs font-medium opacity-80">INDIR</span>
              <span className="font-bold text-lg leading-none">{indirCount}</span>
            </div>

          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <Card className="border shadow-sm">
        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filters</p>
          {hasFilter && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" /> Clear All
            </Button>
          )}
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Company</p>
              <MultiSelect options={cascadedCompanyOptions} value={companyFilter} onChange={setCompanyFilter} placeholder="All companies..." />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Position / Designation</p>
              <MultiSelect options={filteredPositions} value={positionFilter} onChange={setPositionFilter} placeholder="All positions..." />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Department</p>
              <MultiSelect options={allDepartmentOptions} value={departmentFilter} onChange={setDepartmentFilter} placeholder="All departments..." />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Manager Name</p>
              <MultiSelect
                options={managers.map(m => ({ value: m.id, label: m.label }))}
                value={selectedManagerIds}
                onChange={setSelectedManagerIds}
                placeholder="All Managers"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">DIR / INDIR</p>
              <select value={dirIndirFilter} onChange={(e) => setDirIndirFilter(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="">All</option>
                <option value="DIR">DIR</option>
                <option value="INDIR">INDIR</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Gate Pass Status</p>
              <MultiSelect options={allRlicOptions} value={rlicStatusFilter} onChange={setRlicStatusFilter} placeholder="All statuses..." />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Training Status</p>
              <MultiSelect options={allTrainingOptions} value={trainingStatusFilter} onChange={setTrainingStatusFilter} placeholder="All statuses..." />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Project ID Status</p>
              <MultiSelect options={allPidOptions} value={pidStatusFilter} onChange={setPidStatusFilter} placeholder="All statuses..." />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Medical Result</p>
              <MultiSelect options={allMedicalResultOptions} value={medicalResultFilter} onChange={setMedicalResultFilter} placeholder="All results..." />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Location</p>
              <MultiSelect options={allLocationOptions} value={locationFilter} onChange={setLocationFilter} placeholder="All locations..." />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1 border-t">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Training Scheduled</p>
              <div className="flex gap-1.5">
                <Input type="date" value={trainingScheduledFrom} onChange={e => setTrainingScheduledFrom(e.target.value)} className="text-xs h-8" />
                <Input type="date" value={trainingScheduledTo} onChange={e => setTrainingScheduledTo(e.target.value)} className="text-xs h-8" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Medical TR Approved</p>
              <div className="flex gap-1.5">
                <Input type="date" value={trApprovedFrom} onChange={e => setTrApprovedFrom(e.target.value)} className="text-xs h-8" />
                <Input type="date" value={trApprovedTo} onChange={e => setTrApprovedTo(e.target.value)} className="text-xs h-8" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Gate Pass Issue</p>
              <div className="flex gap-1.5">
                <Input type="date" value={gpIssueFrom} onChange={e => setGpIssueFrom(e.target.value)} className="text-xs h-8" />
                <Input type="date" value={gpIssueTo} onChange={e => setGpIssueTo(e.target.value)} className="text-xs h-8" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Gate Pass Received</p>
              <div className="flex gap-1.5">
                <Input type="date" value={gpReceivedFrom} onChange={e => setGpReceivedFrom(e.target.value)} className="text-xs h-8" />
                <Input type="date" value={gpReceivedTo} onChange={e => setGpReceivedTo(e.target.value)} className="text-xs h-8" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Project ID Issue</p>
              <div className="flex gap-1.5">
                <Input type="date" value={pidIssueFrom} onChange={e => setPidIssueFrom(e.target.value)} className="text-xs h-8" />
                <Input type="date" value={pidIssueTo} onChange={e => setPidIssueTo(e.target.value)} className="text-xs h-8" />
              </div>
            </div>
          </div>
          {hasFilter && (
            <p className="text-xs text-muted-foreground pt-1">
              Showing <strong className="text-foreground">{total}</strong> of <strong className="text-foreground">{employees.filter(e => e.is_active !== false).length}</strong> active personnel
            </p>
          )}
        </div>
      </Card>

      {/* Category Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        {categoryCards.map(card => (
          <Link key={card.title} to={card.path} className="flex">
            <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group border hover:border-primary/30 overflow-hidden flex flex-col w-full">
              <div className={`h-1 w-full ${card.bg} opacity-80 shrink-0`} />
              <CardHeader className="pb-2 pt-4 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center group-hover:scale-105 transition-transform shrink-0`}>
                      <card.icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                    <CardTitle className="text-sm font-semibold text-foreground">{card.title}</CardTitle>
                  </div>
                  {card.combined !== undefined && (
                    <div className="flex flex-col items-end">
                      <div className="flex items-baseline gap-1">
                        <span className={`text-2xl font-extrabold ${card.color}`}>{card.combined}</span>
                        {card.overallTotal !== undefined && (
                          <span className="text-xs font-medium text-muted-foreground">/{card.overallTotal}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{card.combinedLabel}</p>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pb-4 flex-1 flex flex-col justify-start">
                <div className="grid grid-cols-3 gap-x-2 gap-y-2">
                  {card.stats.map(s => (
                    <div key={s.label} className="text-center bg-muted/40 rounded-lg py-1.5 px-1">
                      <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Expiry Monitoring Overview */}
      <ExpiryMonitoringCards filtered={filtered} />

      {/* Recent Updates */}
      <RecentUpdates filteredEmployeeIds={new Set(filtered.map(e => e.id))} />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm font-semibold">Personnel by Company</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {companyCounts.length === 0 ? (
              <p className="text-center text-muted-foreground py-10 text-sm">No data for selected filters</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(260, companyCounts.length * 28)}>
                <BarChart data={companyCounts} layout="vertical" margin={{ top: 4, right: 36, left: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={120} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {companyCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm font-semibold">Pass &amp; Status Overview</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={[
                { category: 'RLIC Valid', count: validRlic },
                { category: 'RLIC Expired', count: expiredRlic },
                { category: 'PID Valid', count: validPid },
                { category: 'PID Expired', count: expiredPid },
                { category: 'Medical OK', count: medicalAccepted },
                { category: 'Training', count: trainingDone },
              ]} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="category" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {['#10b981','#ef4444','#3b82f6','#f97316','#8b5cf6','#06b6d4'].map((c, i) => (
                    <Cell key={i} fill={c} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm font-semibold">Personnel by Department</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {(() => {
              const deptMap = new Map();
              for (const emp of filtered) {
                const raw = (emp.department || '').trim();
                if (!raw) continue;
                const key = raw.toUpperCase();
                if (!deptMap.has(key)) {
                  const canonical = allDepartments.find(d => d.toUpperCase() === key) || raw;
                  deptMap.set(key, { name: canonical, count: 0 });
                }
                deptMap.get(key).count++;
              }
              const deptData = [...deptMap.values()].filter(d => d.count > 0).sort((a, b) => b.count - a.count);
              if (deptData.length === 0) return <p className="text-center text-muted-foreground py-10 text-sm">No data</p>;
              return (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={deptData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm font-semibold">Location / Mobilized</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {(() => {
              const locationCounts = [...new Set(filtered.map(e => e.current_location).filter(Boolean))]
                .map((loc) => ({ name: loc, value: filtered.filter(e => e.current_location === loc).length }))
                .filter(l => l.value > 0)
                .sort((a, b) => b.value - a.value);
              const unknown = filtered.filter(e => !e.current_location).length;
              if (unknown > 0) locationCounts.push({ name: 'Unknown', value: unknown });
              if (locationCounts.length === 0) return <p className="text-center text-muted-foreground py-10 text-sm">No data</p>;
              return (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={locationCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={82} innerRadius={36}
                      label={({ name, value }) => `${name}: ${value}`} labelLine>
                      {locationCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              );
            })()}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border shadow-sm">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm font-semibold">Top Positions / Designations</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={(() => {
                  const posMap = new Map();
                  for (const e of filtered) {
                    if (!e.designation_org_chart) continue;
                    const key = e.designation_org_chart.trim().toUpperCase();
                    if (!posMap.has(key)) posMap.set(key, { name: e.designation_org_chart.trim(), count: 0 });
                    posMap.get(key).count++;
                  }
                  return [...posMap.values()].sort((a, b) => b.count - a.count).slice(0, 12).map(d => ({ name: d.name.substring(0, 20), count: d.count }));
                })()}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                layout="vertical"
              >
                <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={140} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {showReportConfig && (
        <ReportConfigModal
          filtered={filtered}
          onClose={() => setShowReportConfig(false)}
          onGenerate={(cfg) => { setReportConfig(cfg); setShowReportConfig(false); setShowReport(true); }}
        />
      )}
      {showReport && reportConfig && (
        <DashboardReport
          filtered={filtered}
          categoryCards={categoryCards}
          onClose={() => setShowReport(false)}
          companyFilter={companyFilter}
          config={reportConfig}
        />
      )}
    </div>
  );
}