import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Stethoscope, ShieldCheck, GraduationCap, BadgeCheck, Clock, ChevronRight, ChevronDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';

// Status fields to watch per category
const CATEGORY_CONFIG = {
  medical: {
    label: 'Medical Updates',
    icon: Stethoscope,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    fields: ['ftw_result'],
  },
  gatepass: {
    label: 'Gate Pass Updates',
    icon: ShieldCheck,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    fields: ['rlic_status', 'gate_pass_expiry', 'gate_pass_issue_date', 'gate_pass_received_date'],
  },
  training: {
    label: 'Training Updates',
    icon: GraduationCap,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    fields: ['training_status'],
  },
  projectid: {
    label: 'Project ID Updates',
    icon: BadgeCheck,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    fields: ['pid_status', 'pid', 'pid_issue_date', 'pid_expiry'],
  },
};

const STATUS_FIELD_LABEL = {
  ftw_result: 'Medical Result',
  rlic_status: 'Gate Pass Status',
  gate_pass_expiry: 'GP Expiry',
  gate_pass_issue_date: 'GP Issue Date',
  gate_pass_received_date: 'GP Received',
  training_status: 'Training Status',
  pid_status: 'PID Status',
  pid: 'Project ID',
  pid_issue_date: 'PID Issue Date',
  pid_expiry: 'PID Expiry',
};

function formatVal(val) {
  if (!val) return '—';
  // If it looks like an ISO date, format it
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    try { return format(parseISO(val), 'dd MMM yyyy'); } catch { return val; }
  }
  return String(val);
}

function UpdateRow({ log, catFields }) {
  const snap = log.record_snapshot || {};
  const changed = (log.changed_fields || []).filter(f => catFields.includes(f));

  // Extract prev/new values from snapshot and infer prev from changed_fields
  // The snapshot is the state AFTER the change, so we show what changed
  const employee = snap;
  const name = log.record_name || employee.name || 'Unknown';
  const company = employee.company || '—';
  const dept = employee.department || '—';
  const position = employee.designation_org_chart || employee.position_application || '—';
  const qid = employee.qid_no || '—';
  const pid = employee.pid || '—';

  const updatedAt = log.created_date
    ? format(new Date(log.created_date), 'dd MMM yyyy, HH:mm')
    : '—';

  return (
    <div className="py-3 px-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground truncate">{name}</span>
            {qid !== '—' && <span className="text-xs text-muted-foreground">QID: {qid}</span>}
            {pid !== '—' && <span className="text-xs text-muted-foreground">PID: {pid}</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-muted-foreground">
            <span>{company}</span>
            <span>·</span>
            <span>{dept}</span>
            <span>·</span>
            <span className="truncate max-w-[160px]">{position}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {changed.map(field => {
              const newVal = snap[field];
              return (
                <div key={field} className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">{STATUS_FIELD_LABEL[field] || field}:</span>
                  <Badge variant="outline" className="text-xs py-0 px-1.5 h-5 border-green-300 text-green-700 bg-green-50">
                    {formatVal(newVal)}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
            <Clock className="w-3 h-3" />
            <span>{updatedAt}</span>
          </div>
          {log.performed_by && (
            <div className="text-xs text-muted-foreground mt-0.5">{log.performed_by}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryPanel({ catKey, config, logs, filteredEmployeeIds }) {
  const [showAll, setShowAll] = useState(false);

  // Filter logs: only Employee entity, only updates with relevant changed fields, only filtered employees
  const catLogs = useMemo(() => {
    return logs
      .filter(log => {
        if (log.action !== 'update') return false;
        if (log.entity_name !== 'Employee') return false;
        const hasRelevantChange = (log.changed_fields || []).some(f => config.fields.includes(f));
        if (!hasRelevantChange) return false;
        if (filteredEmployeeIds && !filteredEmployeeIds.has(log.entity_id)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [logs, config.fields, filteredEmployeeIds]);

  const Icon = config.icon;
  const displayed = showAll ? catLogs : catLogs.slice(0, 5);

  return (
    <Card className={`border ${config.border} shadow-sm`}>
      <CardHeader className="py-3 px-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg ${config.bg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${config.color}`} />
            </div>
            <CardTitle className="text-sm font-semibold">{config.label}</CardTitle>
            {catLogs.length > 0 && (
              <Badge variant="secondary" className="text-xs h-5 px-1.5">{catLogs.length}</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {catLogs.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No recent updates</div>
        ) : (
          <>
            {displayed.map(log => (
              <UpdateRow key={log.id} log={log} catFields={config.fields} />
            ))}
            {catLogs.length > 5 && (
              <div className="px-4 py-2.5 border-t bg-muted/20">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? (
                    <><ChevronDown className="w-3 h-3 rotate-180" /> Show Less</>
                  ) : (
                    <><ChevronRight className="w-3 h-3" /> View All ({catLogs.length - 5} more)</>
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
    queryFn: () => base44.entities.ActivityLog.filter({ action: 'update', entity_name: 'Employee' }, '-created_date', 300),
    staleTime: 60000,
    refetchInterval: 120000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 bg-muted/50 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-48 rounded-xl bg-muted/30 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Recent Updates</h3>
        <span className="text-xs text-muted-foreground">— Latest status changes</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
          <CategoryPanel
            key={key}
            catKey={key}
            config={cfg}
            logs={logs}
            filteredEmployeeIds={filteredEmployeeIds}
          />
        ))}
      </div>
    </div>
  );
}