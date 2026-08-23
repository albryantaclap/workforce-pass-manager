import React, { useMemo } from 'react';
import { Building2, Layers, MapPin, HeartPulse, ShieldCheck, GraduationCap, BadgeCheck, Clock, UserCog } from 'lucide-react';
import {
  aggregateAll, orderedItems, countItems, complianceItems,
  MEDICAL_ORDER, MEDICAL_LABELS, GATEPASS_ORDER, GATEPASS_LABELS,
  TRAINING_ORDER, TRAINING_LABELS, PID_ORDER, PID_LABELS,
  STATUS_COLORS, PID_EXPIRY_GROUPS,
} from './comoCampAggregations';
import DashboardKpiCards from './DashboardKpiCards';
import DashboardBarChart from './DashboardBarChart';
import DashboardStatusOverview from './DashboardStatusOverview';
import DashboardComplianceOverview from './DashboardComplianceOverview';
import DashboardSummaryTables from './DashboardSummaryTables';

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/30">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

export default function ComoCampDashboard({ data, isComo, firstCardLabel, onDrill }) {
  const agg = useMemo(() => aggregateAll(data), [data]);
  const total = agg.kpi.total;

  // byCompany / byDepartment hold compliance buckets — derive headcount from .total.
  const headcount = (map, color) => complianceItems(map).map((i) => ({ key: i.key, label: i.label, value: i.total, color }));
  const companyItems = useMemo(() => headcount(agg.byCompany, '#3b82f6'), [agg]);
  const deptItems = useMemo(() => headcount(agg.byDepartment, '#8b5cf6'), [agg]);
  const locItems = useMemo(() => countItems(agg.byLocation, '#f59e0b'), [agg]);
  const medItems = useMemo(() => orderedItems(agg.byMedical, MEDICAL_ORDER, MEDICAL_LABELS, STATUS_COLORS), [agg]);
  const gpItems = useMemo(() => orderedItems(agg.byGatePass, GATEPASS_ORDER, GATEPASS_LABELS, STATUS_COLORS), [agg]);
  const trainItems = useMemo(() => orderedItems(agg.byTraining, TRAINING_ORDER, TRAINING_LABELS, STATUS_COLORS), [agg]);
  const pidItems = useMemo(() => orderedItems(agg.byPid, PID_ORDER, PID_LABELS, STATUS_COLORS), [agg]);
  const pidExpiryItems = useMemo(
    () => PID_EXPIRY_GROUPS.map((g) => ({ key: g.key, label: g.label, value: agg.pidExpiry[g.key] || 0, color: g.color })),
    [agg]
  );
  const managerHeadcount = useMemo(
    () => complianceItems(agg.byManager).map((m) => ({ key: m.key, label: m.label, value: m.total, color: '#a855f7' })),
    [agg]
  );

  const drill = onDrill || {};

  return (
    <div className="space-y-4">
      <DashboardKpiCards kpi={agg.kpi} firstCardLabel={firstCardLabel} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Personnel by Company" icon={Building2}>
          <DashboardBarChart items={companyItems} onClick={drill.company} />
        </SectionCard>
        <SectionCard title="Personnel by Department" icon={Layers}>
          <DashboardBarChart items={deptItems} onClick={drill.department} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {!isComo ? (
          <SectionCard title="Personnel by Work Location" icon={MapPin}>
            <DashboardBarChart items={locItems} onClick={drill.location} />
          </SectionCard>
        ) : (
          <SectionCard title="Personnel by Assigned Manager" icon={UserCog}>
            <DashboardBarChart items={managerHeadcount} onClick={drill.manager} />
          </SectionCard>
        )}
        <SectionCard title="Medical Status Overview" icon={HeartPulse}>
          <DashboardStatusOverview items={medItems} total={total} onClick={drill.medical} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Gate Pass Status Overview" icon={ShieldCheck}>
          <DashboardStatusOverview items={gpItems} total={total} onClick={drill.gatePass} />
        </SectionCard>
        <SectionCard title="Training Status Overview" icon={GraduationCap}>
          <DashboardStatusOverview items={trainItems} total={total} onClick={drill.training} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Project ID (PID) Status Overview" icon={BadgeCheck}>
          <DashboardStatusOverview items={pidItems} total={total} onClick={drill.pid} />
        </SectionCard>
        <SectionCard title="PID Expiry Monitoring" icon={Clock}>
          <DashboardStatusOverview items={pidExpiryItems} total={total} onClick={drill.pidExpiry} />
        </SectionCard>
      </div>

      <DashboardComplianceOverview agg={agg} total={total} />

      <DashboardSummaryTables
        agg={agg}
        onDrillCompany={drill.company}
        onDrillDepartment={drill.department}
        onDrillPosition={drill.position}
        onDrillManager={drill.manager}
      />
    </div>
  );
}