import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const ACTION_CONFIG = {
  create: { label: 'Created', icon: Plus, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  update: { label: 'Updated', icon: Pencil, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  delete: { label: 'Deleted', icon: Trash2, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
};

export default function ActivityLog() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: () => base44.entities.ActivityLog.list('-created_date', 500),
    refetchInterval: 30000,
  });

  const filtered = logs.filter(log => {
    const matchesSearch =
      log.record_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.performed_by?.toLowerCase().includes(search.toLowerCase()) ||
      log.entity_name?.toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const counts = {
    create: logs.filter(l => l.action === 'create').length,
    update: logs.filter(l => l.action === 'update').length,
    delete: logs.filter(l => l.action === 'delete').length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Activity className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
          <p className="text-sm text-muted-foreground">Track all user actions and data changes</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {Object.entries(ACTION_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <Card key={key} className={`border ${cfg.border}`}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`p-2 rounded-lg ${cfg.bg}`}>
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold">{counts[key]}</div>
                  <div className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, user, or entity..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Created</SelectItem>
            <SelectItem value="update">Updated</SelectItem>
            <SelectItem value="delete">Deleted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Activity className="w-12 h-12 text-muted-foreground mb-3 opacity-30" />
            <p className="text-muted-foreground font-medium">No activity found</p>
            <p className="text-sm text-muted-foreground mt-1">Actions will appear here as users interact with the system</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Action</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Record</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Performed By</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Changed Fields</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, i) => {
                const cfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.update;
                const Icon = cfg.icon;
                return (
                  <tr key={log.id} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                    <td className="px-4 py-3">
                      <Badge className={`gap-1 ${cfg.bg} ${cfg.color} ${cfg.border} border font-medium`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{log.record_name || log.entity_id}</div>
                      <div className="text-xs text-muted-foreground">{log.entity_name}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{log.performed_by || '—'}</td>
                    <td className="px-4 py-3">
                      {log.changed_fields?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {log.changed_fields.slice(0, 4).map(f => (
                            <Badge key={f} variant="outline" className="text-xs py-0">{f}</Badge>
                          ))}
                          {log.changed_fields.length > 4 && (
                            <Badge variant="outline" className="text-xs py-0">+{log.changed_fields.length - 4}</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {log.created_date ? format(new Date(log.created_date), 'dd MMM yyyy, HH:mm') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}