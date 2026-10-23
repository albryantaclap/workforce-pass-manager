// Insert / merge helpers for the Visual Org Chart Builder.
//
// A saved chart is inserted into a destination chart by translating its whole
// coordinate space with a single offset, so cards, photos, shapes, notes and
// connector routing keep their relative positions exactly. Source records are
// only ever read — an insertion never writes to the chart it came from.

import { base44 } from '@/api/base44Client';
import { EDGE_PERSIST_FIELDS, NODE_PERSIST_FIELDS, uid } from '@/lib/orgChartConstants';

// Reads a saved chart exactly as it stands. Used for both picking and inserting,
// so an insertion always copies the current content of the source.
export async function loadChartBundle(chart) {
  const id = typeof chart === 'string' ? chart : chart?.id;
  const [nodePage, edgePage] = await Promise.all([
    base44.entities.OrgChartNode.filter({ chart_id: id, is_deleted: { $ne: true } }, { limit: 5000, sort: 'created_date' }),
    base44.entities.OrgChartEdge.filter({ chart_id: id, is_deleted: { $ne: true } }, { limit: 8000, sort: 'created_date' }),
  ]);
  return {
    chart: typeof chart === 'string' ? { id } : chart,
    nodes: nodePage.items || [],
    edges: edgePage.items || [],
  };
}

const pick = (obj, fields) => fields.reduce((acc, k) => {
  if (obj && obj[k] !== undefined) acc[k] = obj[k];
  return acc;
}, {});

export const IMPORT_MODES = [
  { key: 'copy', label: 'Copy into this chart', hint: 'Editable cards. The source chart is never affected.' },
  { key: 'linked', label: 'Linked chart', hint: 'Keeps a reference to the source and offers updates when it changes.' },
  { key: 'snapshot', label: 'Snapshot', hint: 'Frozen, locked copy that can be converted to editable cards later.' },
];

export const PLACEMENT_OPTIONS = [
  { key: 'side_by_side', label: 'Side by side' },
  { key: 'stacked', label: 'Stack vertically' },
  { key: 'grid', label: 'Grid' },
  { key: 'cursor', label: 'At cursor' },
  { key: 'below_manager', label: 'Below selected card' },
];

export const DEFAULT_GAP = 140;

export function exactBounds(nodes = []) {
  if (!nodes.length) return { x: 0, y: 0, w: 1, h: 1 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach((n) => {
    const x = n.x || 0;
    const y = n.y || 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + (n.width || 260));
    maxY = Math.max(maxY, y + (n.height || 118));
  });
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

export const rootNodeOf = (nodes = []) => nodes.reduce((best, n) => {
  if (!best) return n;
  if ((n.y || 0) < (best.y || 0)) return n;
  if ((n.y || 0) === (best.y || 0) && (n.x || 0) < (best.x || 0)) return n;
  return best;
}, null);

// Offsets are translation deltas: newX = sourceX + offset.x
export function planOffsets(bundles, placement, { gap = DEFAULT_GAP, origin = { x: 0, y: 0 }, anchor = null } = {}) {
  const boxes = bundles.map(b => exactBounds(b.nodes));
  if (!boxes.length) return [];
  const offsets = [];

  if (placement === 'stacked' || placement === 'grid') {
    if (placement === 'stacked') {
      let y = origin.y;
      boxes.forEach((box) => {
        offsets.push({ x: Math.round(origin.x - box.x), y: Math.round(y - box.y) });
        y += box.h + gap;
      });
      return offsets;
    }
    const cols = Math.max(1, Math.ceil(Math.sqrt(boxes.length)));
    const colW = Math.max(...boxes.map(b => b.w)) + gap;
    const rowH = Math.max(...boxes.map(b => b.h)) + gap;
    boxes.forEach((box, i) => offsets.push({
      x: Math.round(origin.x + (i % cols) * colW - box.x),
      y: Math.round(origin.y + Math.floor(i / cols) * rowH - box.y),
    }));
    return offsets;
  }

  if (placement === 'below_manager' && anchor) {
    const total = boxes.reduce((sum, box) => sum + box.w, 0) + gap * (boxes.length - 1);
    let x = anchor.x + anchor.w / 2 - total / 2;
    boxes.forEach((box) => {
      offsets.push({ x: Math.round(x - box.x), y: Math.round(anchor.y + anchor.h + gap - box.y) });
      x += box.w + gap;
    });
    return offsets;
  }

  let x = origin.x;
  boxes.forEach((box) => {
    offsets.push({ x: Math.round(x - box.x), y: Math.round(origin.y - box.y) });
    x += box.w + gap;
  });
  return offsets;
}

// Every source card becomes a new destination card with a new id, in one group.
export function buildInsertion(bundles, { mode = 'copy', offsets = [], meta = {}, groupIds = [], names = [] } = {}) {
  const nodes = [];
  const edges = [];
  const groups = [];

  bundles.forEach((bundle, index) => {
    const groupId = groupIds[index] || uid();
    const offset = offsets[index] || { x: 0, y: 0 };
    const keyOf = new Map();

    (bundle.nodes || []).forEach((n) => {
      const key = `${groupId}:${n.id}`;
      keyOf.set(n.id, key);
      nodes.push({
        ...pick(n, NODE_PERSIST_FIELDS),
        __key: key,
        group_id: groupId,
        x: Math.round((n.x || 0) + offset.x),
        y: Math.round((n.y || 0) + offset.y),
        is_locked: mode === 'snapshot' ? true : !!n.is_locked,
        is_visible: n.is_visible !== false,
      });
    });

    (bundle.edges || []).forEach((e) => {
      const fromKey = keyOf.get(e.source_id);
      const toKey = keyOf.get(e.target_id);
      if (!fromKey || !toKey) return;
      edges.push({
        ...pick(e, EDGE_PERSIST_FIELDS),
        fromKey,
        toKey,
        bend_points: (e.bend_points || []).map(p => ({
          x: Math.round((p.x || 0) + offset.x),
          y: Math.round((p.y || 0) + offset.y),
        })),
      });
    });

    const root = rootNodeOf(bundle.nodes);
    groups.push({
      group_id: groupId,
      name: names[index] || bundle.chart?.name || 'Imported chart',
      color: '',
      source_chart_id: bundle.chart?.id || '',
      source_chart_name: bundle.chart?.name || '',
      source_project_name: bundle.chart?.project_name || '',
      source_status: bundle.chart?.status || 'draft',
      source_revision: bundle.chart?.revision_no || 1,
      source_updated_at: bundle.chart?.last_edited_at || bundle.chart?.updated_date || '',
      import_mode: mode,
      offset_x: offset.x,
      offset_y: offset.y,
      node_count: (bundle.nodes || []).length,
      edge_count: (bundle.edges || []).length,
      node_map: (bundle.nodes || []).map(n => ({ key: `${groupId}:${n.id}`, src_id: n.id })),
      rootKey: root ? `${groupId}:${root.id}` : null,
      imported_at: new Date().toISOString(),
      imported_by: meta.email || '',
      imported_by_name: meta.name || '',
    });
  });

  return { nodes, edges, groups };
}

export function buildGroupInsertion(bundle, { mode = 'copy', offset = { x: 0, y: 0 }, groupId, name, meta = {} } = {}) {
  const result = buildInsertion([bundle], {
    mode,
    offsets: [offset],
    meta,
    groupIds: groupId ? [groupId] : [],
    names: name ? [name] : [],
  });
  const group = result.groups[0];
  return { ...result, rootKey: group?.rootKey || null };
}

// Cards in the destination already linked to the same Master List person.
export function findDuplicates(destNodes = [], bundleNodes = []) {
  const existing = new Map();
  destNodes.forEach((n) => {
    if (!n.linked_employee_id) return;
    existing.set(n.linked_employee_id, (existing.get(n.linked_employee_id) || 0) + 1);
  });
  const incoming = new Map();
  bundleNodes.forEach((n) => {
    if (!n.linked_employee_id) return;
    const entry = incoming.get(n.linked_employee_id) || {
      employee_id: n.linked_employee_id,
      name: n.name || '',
      pid: n.pid || '',
      existing: existing.get(n.linked_employee_id) || 0,
      incoming: 0,
      node_ids: [],
    };
    entry.incoming += 1;
    entry.node_ids.push(n.id);
    incoming.set(n.linked_employee_id, entry);
  });
  return [...incoming.values()].filter(item => item.existing > 0);
}

export const filterDuplicates = (bundleNodes, employeeIds) => {
  const set = new Set(employeeIds || []);
  return (bundleNodes || []).filter(n => !n.linked_employee_id || !set.has(n.linked_employee_id));
};

// A source chart may not be inserted when it already (directly or through a
// chain of linked imports) contains the destination chart.
export function wouldCreateCycle(imports, destinationId, sourceId) {
  if (!destinationId || !sourceId) return false;
  if (sourceId === destinationId) return true;
  const byChart = new Map();
  (imports || []).forEach((rec) => {
    if (!rec.chart_id || !rec.source_chart_id) return;
    const list = byChart.get(rec.chart_id) || [];
    list.push(rec.source_chart_id);
    byChart.set(rec.chart_id, list);
  });
  const walk = (chartId, seen) => {
    if (chartId === destinationId) return true;
    if (seen.has(chartId)) return false;
    seen.add(chartId);
    return (byChart.get(chartId) || []).some(next => walk(next, seen));
  };
  return walk(sourceId, new Set());
}

export const isGroupStale = (group, chart) => {
  if (!group || group.import_mode !== 'linked' || !chart) return false;
  const current = chart.last_edited_at || chart.updated_date || '';
  if (!current) return false;
  if (!group.source_updated_at) return true;
  return new Date(current).getTime() > new Date(group.source_updated_at).getTime();
};