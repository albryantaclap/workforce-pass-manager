// Inserted chart groups: listing, refreshing, grouping and manager connections
// for charts merged into the Visual Chart Builder. Only the destination chart is
// ever written to — source charts are read, never modified.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { isGroupStale, loadChartBundle, rootNodeOf } from '@/lib/orgChartMerge';

export default function useChartImports({ editor, chart, allCharts, onNotice, fitGroup, onInsertRequest }) {
  const chartId = chart?.id;
  const [imports, setImports] = useState([]);
  const [connectTarget, setConnectTarget] = useState(null);

  useEffect(() => {
    if (!chartId) return undefined;
    let active = true;
    base44.entities.OrgChartImport.filter({ chart_id: chartId }, { sort: 'created_date', limit: 200 })
      .then((res) => { if (active) setImports(res.items || []); })
      .catch(() => { if (active) setImports([]); });
    return () => { active = false; };
  }, [chartId]);

  const nodes = editor.nodes;
  const nodesOf = useCallback((rec) => nodes.filter(n => n.group_id === rec.group_id), [nodes]);
  const latestById = useMemo(() => new Map((allCharts || []).map(c => [c.id, c])), [allCharts]);

  const patchRecord = useCallback(async (rec, patch) => {
    const updated = await base44.entities.OrgChartImport.update(rec.id, patch);
    setImports(prev => prev.map(item => (item.id === rec.id ? { ...item, ...patch, ...(updated || {}) } : item)));
    return updated;
  }, []);

  const commitInsertion = useCallback(async (plan) => {
    const result = await editor.applyInsertion(plan);
    if (!result) return null;
    setImports(prev => [...prev, ...(result.imports || [])]);
    onNotice(`Inserted ${result.nodes.length} cards from ${(plan.groups || []).map(g => g.name).join(', ')}.`);
    fitGroup([...(editor.nodes || []), ...result.nodes]);
    return result;
  }, [editor, onNotice, fitGroup]);

  const groups = useMemo(() => {
    if (!chartId) return null;
    return {
      list: imports.map(rec => ({
        ...rec,
        is_stale: rec.import_mode === 'linked' && !rec.is_detached && isGroupStale(rec, latestById.get(rec.source_chart_id)),
        is_locked: nodes.some(n => n.group_id === rec.group_id && n.is_locked),
      })),
      insert: onInsertRequest,
      select: (rec) => editor.setSelection(nodesOf(rec).map(n => n.id)),
      fit: (rec) => fitGroup(nodesOf(rec)),
      lock: (rec, locked) => editor.updateNodes(nodesOf(rec).map(n => ({ id: n.id, is_locked: locked }))),
      collapse: (rec) => {
        const list = nodesOf(rec);
        const root = rootNodeOf(list);
        const next = !rec.is_collapsed;
        editor.updateNodes(list.filter(n => n.id !== root?.id).map(n => ({ id: n.id, is_visible: !next })));
        patchRecord(rec, { is_collapsed: next });
      },
      rename: (rec) => {
        const name = window.prompt('Group name', rec.name);
        if (name) patchRecord(rec, { name });
      },
      color: (rec, color) => {
        editor.updateNodes(nodesOf(rec).map(n => ({ id: n.id, accent_color: color })));
        patchRecord(rec, { color });
      },
      duplicate: async (rec) => {
        const created = await editor.duplicateGroup(rec);
        if (created) setImports(prev => [...prev, created]);
      },
      connect: (rec) => setConnectTarget(rec),
      update: async (rec) => {
        const source = latestById.get(rec.source_chart_id) || await base44.entities.OrgChart.get(rec.source_chart_id);
        const bundle = await loadChartBundle(source);
        if (!bundle.nodes.length) {
          onNotice('That source chart is empty, so the group was left unchanged.');
          return;
        }
        const updated = await editor.updateLinkedGroup(rec, bundle);
        if (updated) {
          setImports(prev => prev.map(item => (item.id === rec.id ? { ...item, ...updated } : item)));
          onNotice(`“${rec.name}” was refreshed from ${source.name}.`);
        }
      },
      detach: async (rec) => {
        editor.updateNodes(nodesOf(rec).map(n => ({ id: n.id, is_locked: false })));
        await patchRecord(rec, { import_mode: 'copy', is_detached: true });
        onNotice(`“${rec.name}” is now independent of ${rec.source_chart_name || 'its source chart'}.`);
      },
      ungroup: async (rec) => {
        editor.updateNodes(nodesOf(rec).map(n => ({ id: n.id, group_id: '' })));
        await base44.entities.OrgChartImport.delete(rec.id);
        setImports(prev => prev.filter(item => item.id !== rec.id));
      },
      remove: async (rec) => {
        if (!window.confirm(`Remove “${rec.name}” from this chart? The source chart and its personnel records are not touched.`)) return;
        editor.removeGroup(rec.group_id);
        await base44.entities.OrgChartImport.delete(rec.id);
        setImports(prev => prev.filter(item => item.id !== rec.id));
      },
    };
  }, [chartId, imports, nodes, latestById, editor, patchRecord, nodesOf, onInsertRequest, fitGroup, onNotice]);

  const connectGroup = useCallback(async ({ managerId, rootId, type, pathStyle }) => {
    await editor.addEdge(managerId, rootId, {
      relationship_type: type,
      path_style: pathStyle,
      source_port: 'bottom',
      target_port: 'top',
    });
    setConnectTarget(null);
    onNotice('Department connected to the manager card.');
  }, [editor, onNotice]);

  return {
    imports,
    groups,
    commitInsertion,
    connectTarget,
    setConnectTarget,
    connectGroup,
    groupNodesOf: nodesOf,
  };
}