import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Stethoscope, ShieldCheck, GraduationCap, BadgeCheck, Clock, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const CATEGORY_CONFIG = {
  medical: {
    label: 'Medical Updates',
    icon: Stethoscope,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    borderColor: 'border-blue-200',
    fields: ['ftw_result'],
    statusField: 'ftw_result',
    statusLabel: 'Medical Result',
  },
  gatepass: {
    label: 'Gate Pass Updates',
    icon: ShieldCheck,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    fields: ['rlic_status', 'gate_pass_expiry', 'gate_pass_issue_date', 'gate_pass_received_date'],
    statusField: 'rlic_status',
    statusLabel: 'Gate Pass Status',
  },
  training: {
    label: 'Training Updates',
    icon: GraduationCap,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    borderColor: 'border-orange-200',
    fields: ['training_status'],
    statusField: 'training_status',
    statusLabel: 'Training Status',
  },
  projectid: {
    label: 'Project ID Updates',
    icon: BadgeCheck,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    borderColor: 'border-purple-200',
    fields: ['pid_status', 'pid', 'pid_issue_date', 'pid_expiry'],
    statusField: 'pid_status',
    statusLabel: 'PID Status',
  },
};

const STATUS_COLORS = {
  // Medical
  'ACCEPTED': 'bg-green-100 text-green-700',
  'REJECTED': 'bg-red-100 text-red-700',
  'WAITING TR APPROVAL': 'bg-amber-100 text-amber-700',
  'RE-ASSESS': 'bg-purple-100 text-purple-700',
  // Gate Pass / PID
  'VALID RLIC PASS': 'bg-green-100 text-green-700',
  'EXPIRED RLIC PASS': 'bg-red-100 text-red-700',
  'SOON TO EXPIRE': 'bg-amber-100 text-amber-700',
  'NO RLIC PASS': 'bg-slate-100 text-slate-600',
  'VALID PID PASS': 'bg-green-100 text-green-700',
  'EXPIRED PID PASS': 'bg-red-100 text-red-700',
  'NO PID PASS': 'bg-slate-100 text-slate-600',
  // Training
  'DONE': 'bg-green-100 text-green-700',
  'PENDING': 'bg-amber-100 text-amber-700',
  'NOT REQUIRED': 'bg-slate-100 text-slate-600',
  // Custom
  'RENEWAL UNDER PROCESS': 'bg-blue-100 text-blue-700',
};

function getStatusColor(val) {
  if (!val) return 'bg-slate-100 text-slate-500';
  return STATUS_COLORS[val.trim().toUpperCase()] || 'bg-slate-100 text-slate-600';
}

function UpdateRow({ log, config }) {
  const snap = log.record_snapshot || {};
  const name = log.record_name || snap.name || 'Unknown';
  const company = snap.company || '';
  const dept = snap.department || '';
  const position = snap.designation_org_chart || snap.position_application || '';
  const qid = snap.qid_no || '';
  const pid = snap.pid || '';
  const statusVal = snap[config.statusField];
  const updatedAt = log.created_date
    ? format(new Date(log.created_date), 'dd MMM yyyy, HH:mm')
    : '—';
  const performedBy = log.performed_by || 'system';

  return (
    <div className="py-3 px-4 border-b last:border-b-0 hover:bg-muted/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        {/* Left: employee info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-xs text-foreground">{name}</span>
            {qid && <span className="text-[10px] text-muted-foreground">QID: {qid}</span>}
            {pid && config.statusField === 'pid_status' && <span className="text-[10px] text-muted-foreground">PID: {pid}</span>}
          </div>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {company && <span className="text-[10px] text-muted-foreground font-medium">{company}</span>}
            {dept && <><span className="text-[10px] text-muted-foreground">·</span><span className="text-[10px] text-muted-foreground">{dept}</span></>}
            {position && <><span className="text-[10px] text-muted-foreground">·</span><span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{position}</span></>}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">{config.statusLabel}:</span>
            {statusVal ? (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getStatusColor(statusVal)}`}>
                {statusVal}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">—</span>
            )}
          </div>
        </div>
        {/* Right: timestamp + user */}
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground justify-end">
            <Clock className="w-2.5 h-2.5" />
            <span>{updatedAt}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{performedBy}</div>
        </div>
      </div>
    </div>
  );
}

function CategoryPanel({ config, logs, filteredEmployeeIds }) {
  const [showAll, setShowAll] = useState(false);

  const catLogs = useMemo(() => {
    return logs
      .filter(log => {
        if (log.entity_name !== 'Employee') return false;
        const changedFields = log.changed_fields || [];
        // Primary: changed_fields explicitly lists a relevant field
        const hasExplicitChange = changedFields.some(f => config.fields.includes(f));
        // Fallback: changed_fields is empty/missing but snapshot has the status field set
        const snap = log.record_snapshot || {};
        const hasFallback = changedFields.length === 0 && config.fields.some(f => snap[f] !== undefined && snap[f] !== null && snap[f] !== '');
        if (!hasExplicitChange && !hasFallback) return false;
        if (filteredEmployeeIds && !filteredEmployeeIds.has(log.entity_id)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [logs, config.fields, filteredEmployeeIds]);

  const Icon = config.icon;
  const displayed = showAll ? catLogs : catLogs.slice(0, 5);
  const remaining = catLogs.length - 5;

  return (
    <Card className={`border ${config.borderColor} shadow-sm flex flex-col`}>
      <CardHeader className="py-2.5 px-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-md ${config.bg} flex items-center justify-center`}>
            <Icon className={`w-3.5 h-3.5 ${config.color}`} />
          </div>
          <CardTitle className="text-xs font-semibold text-foreground">{config.label}</CardTitle>
          <span className={`text-xs font-bold ml-0.5 ${config.color}`}>{catLogs.length}</span>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1">
        {catLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">No recent updates</div>
        ) : (
          <>
            {displayed.map(log => (
              <UpdateRow key={log.id} log={log} config={config} />
            ))}
            {catLogs.length > 5 && (
              <div className="px-4 py-2 border-t bg-muted/10">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? (
                    '↑ Show Less'
                  ) : (
                    <><ChevronRight className="w-3 h-3" /> View All ({remaining} more)</>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function RecentUpdates({ filteredEmployeeIds }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['activity-logs-recent'],
    queryFn: () => base44.entities.ActivityLog.filter({ entity_name: 'Employee' }, '-created_date', 500),
    staleTime: 60000,
    refetchInterval: 120000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-44 bg-muted/50 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-52 rounded-xl bg-muted/30 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Recent Updates</span>
        <span className="text-xs text-muted-foreground">— Latest status changes</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
          <CategoryPanel
            key={key}
            config={cfg}
            logs={logs}
            filteredEmployeeIds={filteredEmployeeIds}
          />
        ))}
      </div>
    </div>
  );
}