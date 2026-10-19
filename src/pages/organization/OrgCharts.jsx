import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import OrganizationSubmenuNav from '@/components/common/OrganizationSubmenuNav';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Network, Copy, Archive, RotateCcw, Trash2, Pencil, LayoutGrid } from 'lucide-react';
import { DEFAULT_VIEW_SETTINGS, EDGE_PERSIST_FIELDS, NODE_PERSIST_FIELDS, ORG_TEMPLATES, defaultNode } from '@/lib/orgChartConstants';

const pick = (obj, fields) => fields.reduce((acc, k) => { if (obj && obj[k] !== undefined) acc[k] = obj[k]; return acc; }, {});
const CHART_FIELDS = [
  'project_id', 'project_name', 'description', 'template_key', 'owner_email', 'owner_name',
  'shares', 'view_settings', 'card_presets', 'revision_no', 'effective_date', 'prepared_by',
  'approved_by', 'legend_notes', 'status',
];

async function loadContents(chartId) {
  const [nodes, edges] = await Promise.all([
    base44.entities.OrgChartNode.filter({ chart_id: chartId, is_deleted: { $ne: true } }, { limit: 2000 }),
    base44.entities.OrgChartEdge.filter({ chart_id: chartId, is_deleted: { $ne: true } }, { limit: 4000 }),
  ]);
  return { nodes: nodes.items || [], edges: edges.items || [] };
}

async function instantiateTemplate(chart, templateKey) {
  const template = ORG_TEMPLATES.find(t => t.key === templateKey);
  if (!template?.nodes?.length) return;
  const createdNodes = await base44.entities.OrgChartNode.bulkCreate(
    template.nodes.map(item => {
      const { key, ...data } = item;
      return { ...defaultNode(data.node_kind || 'position', data.x, data.y), ...data, chart_id: chart.id };
    })
  );
  const idMap = new Map(template.nodes.map((item, index) => [item.key, createdNodes[index]?.id]));
  const edgeRecords = (template.edges || [])
    .map(link => ({
      chart_id: chart.id,
      source_id: idMap.get(link.source),
      target_id: idMap.get(link.target),
      relationship_type: link.relationship_type || 'Direct Reporting',
      thickness: 1.5,
    }))
    .filter(link => link.source_id && link.target_id);
  if (edgeRecords.length) await base44.entities.OrgChartEdge.bulkCreate(edgeRecords);
}

export default function OrgCharts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTemplate, setNewTemplate] = useState('blank');
  const [newProject, setNewProject] = useState('');
  const [error, setError] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['org-projects-list'],
    queryFn: async () => (await base44.entities.OrganizationProject.filter({}, { sort: 'project_name', limit: 500 })).items,
  });
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me().catch(() => null),
  });
  const { data: charts = [], isLoading } = useQuery({
    queryKey: ['orgcharts'],
    queryFn: async () => (await base44.entities.OrgChart.filter({}, { sort: '-updated_date', limit: 300 })).items,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['orgcharts'] });

  const visible = charts.filter(chart => (
    (showArchived ? chart.is_archived : !chart.is_archived)
    && (!projectId || chart.project_id === projectId)
  ));

  const createChart = async () => {
    if (!newName.trim()) { setError('Give the chart a name first.'); return; }
    setError('');
    try {
      const project = projects.find(p => p.id === newProject);
      const chart = await base44.entities.OrgChart.create({
        name: newName.trim(),
        project_id: newProject,
        project_name: project?.project_name || '',
        template_key: newTemplate,
        status: 'draft',
        owner_email: me?.email,
        owner_name: me?.full_name,
        view_settings: DEFAULT_VIEW_SETTINGS,
        revision_no: 1,
      });
      await instantiateTemplate(chart, newTemplate);
      navigate(`/organization/chart-builder?chart=${chart.id}`);
    } catch (err) {
      setError(err.message || 'The chart could not be created.');
    }
  };

  const duplicateChart = async (item) => {
    const name = window.prompt('Name for the duplicated chart', `${item.name} copy`);
    if (!name) return;
    const copy = await base44.entities.OrgChart.create({
      ...pick(item, CHART_FIELDS),
      name, status: 'draft', is_archived: false,
    });
    const { nodes, edges } = await loadContents(item.id);
    const createdNodes = nodes.length
      ? await base44.entities.OrgChartNode.bulkCreate(nodes.map(n => ({ ...pick(n, NODE_PERSIST_FIELDS), chart_id: copy.id })))
      : [];
    const idMap = new Map(nodes.map((n, index) => [n.id, createdNodes[index]?.id]));
    const edgeRecords = edges
      .map(e => ({ ...pick(e, EDGE_PERSIST_FIELDS), chart_id: copy.id, source_id: idMap.get(e.source_id), target_id: idMap.get(e.target_id) }))
      .filter(e => e.source_id && e.target_id);
    if (edgeRecords.length) await base44.entities.OrgChartEdge.bulkCreate(edgeRecords);
    refresh();
  };

  const renameChart = async (item) => {
    const name = window.prompt('Chart name', item.name);
    if (!name) return;
    await base44.entities.OrgChart.update(item.id, { name });
    refresh();
  };

  const archiveChart = async (item, archived) => {
    await base44.entities.OrgChart.update(item.id, { is_archived: archived });
    refresh();
  };

  const deleteChart = async (item) => {
    if (!window.confirm(`Delete the chart “${item.name}”? Archiving keeps it available later.`)) return;
    await base44.entities.OrgChart.delete(item.id);
    refresh();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <OrganizationSubmenuNav />

      <div className="flex flex-wrap items-center gap-3 my-5">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Network className="w-5 h-5 text-blue-700" />
        </div>
        <div className="flex-1 min-w-[220px]">
          <h1 className="text-xl font-bold">Visual Org Chart Builder</h1>
          <p className="text-xs text-muted-foreground">Build organization charts by hand — drag cards, draw reporting lines, save multiple charts per project.</p>
        </div>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-xs">
          <option value="">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Archived
        </label>
        <Button className="gap-1.5" onClick={() => setCreating(v => !v)}>
          <Plus className="w-4 h-4" /> New chart
        </Button>
      </div>

      {creating && (
        <Card className="p-4 mb-5 space-y-3">
          <p className="text-sm font-semibold">Create a chart</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Chart name (e.g. Overall Organization)" className="h-9 text-sm" />
            <select value={newProject} onChange={(e) => setNewProject(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">No project (corporate)</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
            <select value={newTemplate} onChange={(e) => setNewTemplate(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
              {ORG_TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={createChart}>Create and open</Button>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <span className="text-[11px] text-muted-foreground">Start from a blank canvas or any built-in template.</span>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading charts…</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map(chart => (
          <Card key={chart.id} className="p-4 flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <LayoutGrid className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{chart.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {chart.project_name || 'Corporate'} · {chart.status}
                  {chart.revision_no ? ` · rev ${chart.revision_no}` : ''}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Edited {chart.last_edited_at ? new Date(chart.last_edited_at).toLocaleString() : '—'}
                  {chart.last_edited_by_name ? ` by ${chart.last_edited_by_name}` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-auto">
              <Button size="sm" onClick={() => navigate(`/organization/chart-builder?chart=${chart.id}`)}>Open builder</Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => renameChart(chart)}>
                <Pencil className="w-3 h-3" /> Rename
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => duplicateChart(chart)}>
                <Copy className="w-3 h-3" /> Duplicate
              </Button>
              {chart.is_archived ? (
                <Button size="sm" variant="outline" className="gap-1" onClick={() => archiveChart(chart, false)}>
                  <RotateCcw className="w-3 h-3" /> Restore
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="gap-1" onClick={() => archiveChart(chart, true)}>
                  <Archive className="w-3 h-3" /> Archive
                </Button>
              )}
              <Button size="sm" variant="ghost" className="gap-1 text-red-600" onClick={() => deleteChart(chart)}>
                <Trash2 className="w-3 h-3" /> Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {!isLoading && !visible.length && (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No charts here yet. Create one from a blank canvas or a template — oil &amp; gas, EPC, divisional, department and more.
          </p>
        </Card>
      )}
    </div>
  );
}