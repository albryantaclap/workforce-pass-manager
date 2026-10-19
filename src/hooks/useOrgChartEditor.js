// Editor state for the Visual Org Chart Builder: loading, manual editing,
// undo/redo, debounced incremental autosave, versions and publishing.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  DEFAULT_VIEW_SETTINGS, EDGE_PERSIST_FIELDS, NODE_PERSIST_FIELDS,
  connectorDefaults, defaultNode, uid,
} from '@/lib/orgChartConstants';

const SAVE_DEBOUNCE = 900;
const HISTORY_LIMIT = 60;

const pick = (obj, fields) => fields.reduce((acc, k) => {
  if (obj && obj[k] !== undefined) acc[k] = obj[k];
  return acc;
}, {});
const clone = (value) => JSON.parse(JSON.stringify(value));
const chunk = (arr, size = 400) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};
const bulkUpdateAll = async (entity, records) => {
  for (const part of chunk(records)) await entity.bulkUpdate(part);
};
const bulkCreateAll = async (entity, records) => {
  const created = [];
  for (const part of chunk(records)) {
    const res = await entity.bulkCreate(part);
    created.push(...(Array.isArray(res) ? res : [res]));
  }
  return created;
};

export default function useOrgChartEditor(chartId) {
  const [chart, setChart] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [saveState, setSaveState] = useState('saved');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [selection, setSelection] = useState([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [me, setMe] = useState(null);
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);

  const dirtyNodes = useRef(new Set());
  const dirtyEdges = useRef(new Set());
  const chartDirty = useRef(false);
  const loadedIds = useRef({ nodes: [], edges: [] });
  const history = useRef({ past: [], future: [] });
  const clipboard = useRef(null);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const stateRef = useRef({ nodes: [], edges: [], chart: null });
  stateRef.current = { nodes, edges, chart };

  // ---------------------------------------------------------------- loading
  useEffect(() => {
    let active = true;
    if (!chartId) {
      setLoading(false);
      setMissing(true);
      return () => { active = false; };
    }
    (async () => {
      setLoading(true);
      setMissing(false);
      try {
        const [record, nodePage, edgePage, user] = await Promise.all([
          base44.entities.OrgChart.get(chartId),
          base44.entities.OrgChartNode.filter({ chart_id: chartId, is_deleted: { $ne: true } }, { limit: 2000, sort: 'created_date' }),
          base44.entities.OrgChartEdge.filter({ chart_id: chartId, is_deleted: { $ne: true } }, { limit: 4000, sort: 'created_date' }),
          base44.auth.me().catch(() => null),
        ]);
        if (!active) return;
        const n = nodePage.items || [];
        const e = edgePage.items || [];
        setChart(record);
        setNodes(n);
        setEdges(e);
        setMe(user);
        loadedIds.current = { nodes: n.map(x => x.id), edges: e.map(x => x.id) };
        history.current = { past: [], future: [] };
        setUndoDepth(0);
        setRedoDepth(0);
        setSaveState('saved');
      } catch (err) {
        if (active) setMissing(true);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [chartId]);

  // ------------------------------------------------------------ save engine
  const sync = useCallback(async (extraChartFields = null) => {
    const current = stateRef.current;
    if (!current.chart) return;
    if (savingRef.current) { pendingRef.current = true; return; }
    savingRef.current = true;
    setSaveState('saving');
    try {
      const presentNodeIds = new Set(current.nodes.filter(n => n.id).map(n => n.id));
      const presentEdgeIds = new Set(current.edges.filter(e => e.id).map(e => e.id));
      const removedNodes = loadedIds.current.nodes.filter(id => !presentNodeIds.has(id));
      const removedEdges = loadedIds.current.edges.filter(id => !presentEdgeIds.has(id));
      const nodeUpdates = [
        ...current.nodes
          .filter(n => n.id && dirtyNodes.current.has(n.id))
          .map(n => ({ ...pick(n, NODE_PERSIST_FIELDS), id: n.id, chart_id: current.chart.id, is_deleted: false })),
        ...removedNodes.map(id => ({ id, is_deleted: true })),
      ];
      const edgeUpdates = [
        ...current.edges
          .filter(e => e.id && dirtyEdges.current.has(e.id))
          .map(e => ({ ...pick(e, EDGE_PERSIST_FIELDS), id: e.id, chart_id: current.chart.id, is_deleted: false })),
        ...removedEdges.map(id => ({ id, is_deleted: true })),
      ];
      if (nodeUpdates.length) await bulkUpdateAll(base44.entities.OrgChartNode, nodeUpdates);
      if (edgeUpdates.length) await bulkUpdateAll(base44.entities.OrgChartEdge, edgeUpdates);
      if (chartDirty.current || extraChartFields) {
        await base44.entities.OrgChart.update(current.chart.id, {
          ...(extraChartFields || {}),
          last_edited_by: me?.email,
          last_edited_by_name: me?.full_name,
          last_edited_at: new Date().toISOString(),
        });
      }
      loadedIds.current = { nodes: [...presentNodeIds], edges: [...presentEdgeIds] };
      dirtyNodes.current.clear();
      dirtyEdges.current.clear();
      chartDirty.current = false;
      setLastSavedAt(new Date());
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
    }
    savingRef.current = false;
    if (pendingRef.current) {
      pendingRef.current = false;
      sync();
    }
  }, [me]);

  const hasPending = () => dirtyNodes.current.size > 0 || dirtyEdges.current.size > 0 || chartDirty.current;

  useEffect(() => {
    if (loading || !chart || !hasPending()) return;
    setSaveState(prev => (prev === 'saving' ? prev : 'dirty'));
    const timer = setTimeout(() => { sync(); }, SAVE_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [nodes, edges, chart, loading, sync]);

  // ------------------------------------------------------------------ history
  const pushHistory = useCallback(() => {
    const current = stateRef.current;
    history.current.past.push({ nodes: clone(current.nodes), edges: clone(current.edges) });
    if (history.current.past.length > HISTORY_LIMIT) history.current.past.shift();
    history.current.future = [];
    setUndoDepth(history.current.past.length);
    setRedoDepth(0);
  }, []);

  const applySnapshot = useCallback((snap) => {
    setNodes(snap.nodes);
    setEdges(snap.edges);
    dirtyNodes.current = new Set(snap.nodes.filter(n => n.id).map(n => n.id));
    dirtyEdges.current = new Set(snap.edges.filter(e => e.id).map(e => e.id));
    setSelection([]);
    setSelectedEdgeId(null);
  }, []);

  const undo = useCallback(() => {
    const past = history.current.past;
    if (!past.length) return;
    const current = stateRef.current;
    history.current.future.push({ nodes: clone(current.nodes), edges: clone(current.edges) });
    applySnapshot(past.pop());
    setUndoDepth(history.current.past.length);
    setRedoDepth(history.current.future.length);
  }, [applySnapshot]);

  const redo = useCallback(() => {
    const future = history.current.future;
    if (!future.length) return;
    const current = stateRef.current;
    history.current.past.push({ nodes: clone(current.nodes), edges: clone(current.edges) });
    applySnapshot(future.pop());
    setUndoDepth(history.current.past.length);
    setRedoDepth(history.current.future.length);
  }, [applySnapshot]);

  // --------------------------------------------------------------- mutations
  const addNode = useCallback(async (partial, options = {}) => {
    if (!chartId) return null;
    if (!options.skipHistory) pushHistory();
    const payload = { chart_id: chartId, ...pick(partial, NODE_PERSIST_FIELDS) };
    const created = await base44.entities.OrgChartNode.create(payload);
    loadedIds.current.nodes.push(created.id);
    setNodes(prev => [...prev, created]);
    if (!options.silent) setSelection([created.id]);
    return created;
  }, [chartId, pushHistory]);

  const updateNodes = useCallback((patches) => {
    if (!patches?.length) return;
    patches.forEach(p => dirtyNodes.current.add(p.id));
    const map = new Map(patches.map(p => [p.id, p]));
    setNodes(prev => prev.map(n => (map.has(n.id) ? { ...n, ...map.get(n.id) } : n)));
  }, []);

  const removeNodes = useCallback((ids) => {
    if (!ids?.length) return;
    pushHistory();
    const set = new Set(ids);
    setNodes(prev => prev.filter(n => !set.has(n.id)));
    setEdges(prev => prev.filter(e => !set.has(e.source_id) && !set.has(e.target_id)));
    setSelection([]);
  }, [pushHistory]);

  const addEdge = useCallback(async (sourceId, targetId, patch = {}, options = {}) => {
    if (!chartId || !sourceId || !targetId || sourceId === targetId) return null;
    const existing = stateRef.current.edges.find(e => e.source_id === sourceId && e.target_id === targetId);
    if (existing && !options.allowDuplicate) {
      setSelectedEdgeId(existing.id);
      return existing;
    }
    if (!options.skipHistory) pushHistory();
    const type = patch.relationship_type || 'Direct Reporting';
    const defaults = connectorDefaults(type);
    const created = await base44.entities.OrgChartEdge.create({
      chart_id: chartId,
      source_id: sourceId,
      target_id: targetId,
      source_port: patch.source_port || 'auto',
      target_port: patch.target_port || 'auto',
      relationship_type: type,
      path_style: patch.path_style || defaults.path,
      line_style: patch.line_style || defaults.line,
      arrow: patch.arrow !== undefined ? patch.arrow : defaults.arrow,
      thickness: 1.5,
      ...pick(patch, EDGE_PERSIST_FIELDS),
    });
    loadedIds.current.edges.push(created.id);
    setEdges(prev => [...prev, created]);
    setSelectedEdgeId(created.id);
    return created;
  }, [chartId, pushHistory]);

  const updateEdge = useCallback((edgeId, patch) => {
    if (!edgeId || !patch) return;
    dirtyEdges.current.add(edgeId);
    setEdges(prev => prev.map(e => (e.id === edgeId ? { ...e, ...patch } : e)));
  }, []);

  const removeEdges = useCallback((ids) => {
    if (!ids?.length) return;
    pushHistory();
    const set = new Set(ids);
    setEdges(prev => prev.filter(e => !set.has(e.id)));
    setSelectedEdgeId(null);
  }, [pushHistory]);

  const duplicateNodes = useCallback(async (ids) => {
    const list = stateRef.current.nodes.filter(n => ids.includes(n.id));
    if (!list.length) return [];
    pushHistory();
    const records = list.map(n => ({
      ...pick(n, NODE_PERSIST_FIELDS),
      chart_id: chartId,
      x: (n.x || 0) + 40,
      y: (n.y || 0) + 40,
    }));
    const created = await bulkCreateAll(base44.entities.OrgChartNode, records);
    created.forEach(r => loadedIds.current.nodes.push(r.id));
    setNodes(prev => [...prev, ...created]);
    setSelection(created.map(c => c.id));
    return created;
  }, [chartId, pushHistory]);

  const copyNodes = useCallback((ids) => {
    const current = stateRef.current;
    const list = current.nodes.filter(n => ids.includes(n.id));
    if (!list.length) return;
    const idSet = new Set(ids);
    clipboard.current = {
      nodes: clone(list),
      edges: clone(current.edges.filter(e => idSet.has(e.source_id) && idSet.has(e.target_id))),
    };
  }, []);

  const pasteNodes = useCallback(async () => {
    if (!clipboard.current?.nodes?.length) return [];
    pushHistory();
    const idMap = new Map();
    const created = await bulkCreateAll(
      base44.entities.OrgChartNode,
      clipboard.current.nodes.map(n => {
        const key = uid();
        idMap.set(n.id, key);
        return { ...pick(n, NODE_PERSIST_FIELDS), chart_id: chartId, x: (n.x || 0) + 40, y: (n.y || 0) + 40 };
      })
    );
    created.forEach((record, i) => idMap.set(clipboard.current.nodes[i].id, record.id));
    created.forEach(r => loadedIds.current.nodes.push(r.id));
    setNodes(prev => [...prev, ...created]);
    const edgeRecords = clipboard.current.edges
      .map(e => ({ ...e, chart_id: chartId, source_id: idMap.get(e.source_id), target_id: idMap.get(e.target_id) }))
      .filter(e => e.source_id && e.target_id);
    let createdEdges = [];
    if (edgeRecords.length) {
      createdEdges = await bulkCreateAll(
        base44.entities.OrgChartEdge,
        edgeRecords.map(e => ({ ...pick(e, EDGE_PERSIST_FIELDS), chart_id: chartId }))
      );
      createdEdges.forEach(r => loadedIds.current.edges.push(r.id));
      setEdges(prev => [...prev, ...createdEdges]);
    }
    setSelection(created.map(c => c.id));
    return created;
  }, [chartId, pushHistory]);

  // --------------------------------------------------------------- settings
  const viewSettings = useMemo(() => ({ ...DEFAULT_VIEW_SETTINGS, ...(chart?.view_settings || {}) }), [chart]);

  const updateViewSettings = useCallback((patch) => {
    chartDirty.current = true;
    setChart(prev => (prev ? { ...prev, view_settings: { ...DEFAULT_VIEW_SETTINGS, ...(prev.view_settings || {}), ...patch } } : prev));
  }, []);

  const updateChart = useCallback((patch, persist = true) => {
    if (persist) chartDirty.current = true;
    setChart(prev => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const setCardPresets = useCallback((presets) => {
    chartDirty.current = true;
    setChart(prev => (prev ? { ...prev, card_presets: presets } : prev));
  }, []);

  // ---------------------------------------------------------------- versions
  const createVersion = useCallback(async (versionName, note) => {
    const current = stateRef.current;
    if (!current.chart) return null;
    const versions = await base44.entities.OrgChartVersion.filter({ chart_id: current.chart.id }, { limit: 200, sort: '-version_no' });
    const nextNo = ((versions.items || [])[0]?.version_no || 0) + 1;
    await sync();
    return base44.entities.OrgChartVersion.create({
      chart_id: current.chart.id,
      version_no: nextNo,
      version_name: versionName || `Version ${nextNo}`,
      note: note || '',
      node_snapshot: clone(current.nodes),
      edge_snapshot: clone(current.edges),
      chart_snapshot: clone(current.chart),
      created_by_email: me?.email,
      created_by_name: me?.full_name,
    });
  }, [me, sync]);

  const restoreVersion = useCallback(async (version) => {
    const current = stateRef.current;
    if (!version || !current.chart) return;
    pushHistory();
    const snapshotNodes = version.node_snapshot || [];
    const snapshotEdges = version.edge_snapshot || [];
    setNodes([]);
    setEdges([]);
    await sync();
    const createdNodes = snapshotNodes.length
      ? await bulkCreateAll(base44.entities.OrgChartNode, snapshotNodes.map(n => ({ ...pick(n, NODE_PERSIST_FIELDS), chart_id: current.chart.id })))
      : [];
    const idMap = new Map(snapshotNodes.map((n, i) => [n.id, createdNodes[i]?.id]).filter(([, v]) => v));
    const createdEdges = snapshotEdges.length
      ? await bulkCreateAll(
        base44.entities.OrgChartEdge,
        snapshotEdges
          .map(e => ({ ...pick(e, EDGE_PERSIST_FIELDS), chart_id: current.chart.id, source_id: idMap.get(e.source_id), target_id: idMap.get(e.target_id) }))
          .filter(e => e.source_id && e.target_id)
      )
      : [];
    createdNodes.forEach(r => loadedIds.current.nodes.push(r.id));
    createdEdges.forEach(r => loadedIds.current.edges.push(r.id));
    setNodes(createdNodes);
    setEdges(createdEdges);
    if (version.chart_snapshot) {
      const { id, created_date, updated_date, created_by_id, ...restorable } = version.chart_snapshot;
      updateChart(restorable);
    }
  }, [pushHistory, sync, updateChart]);

  // ------------------------------------------------------------- permissions
  const myRole = useMemo(() => {
    if (!chart || !me) return 'viewer';
    if (me.role === 'admin') return 'owner';
    if (chart.owner_email && chart.owner_email === me.email) return 'owner';
    const share = (chart.shares || []).find(s => s.user_email === me.email);
    if (share) return share.role;
    return 'editor';
  }, [chart, me]);

  const canEdit = ['owner', 'administrator', 'editor'].includes(myRole);

  return {
    chartId, chart, nodes, edges, loading, missing, saveState, lastSavedAt, me,
    selection, setSelection, selectedEdgeId, setSelectedEdgeId,
    addNode, updateNodes, removeNodes, addEdge, updateEdge, removeEdges,
    duplicateNodes, copyNodes, pasteNodes,
    undo, redo, canUndo: undoDepth > 0, canRedo: redoDepth > 0,
    viewSettings, updateViewSettings, updateChart, setCardPresets,
    createVersion, restoreVersion, saveNow: sync,
    myRole, canEdit, pushHistory, defaultNode,
  };
}