// Smart Color Legend for the Visual Chart Builder.
//
// The legend is a normal chart object (an OrgChartNode with node_kind 'legend'),
// so it drags, resizes, locks, layers and undoes exactly like a card. Its rows
// are documentation only: colors are always read live from the chart objects,
// never copied into a second source of truth, and editing a label or swatch
// never repaints a card, shape or connector.

import { connectorDefaults, defaultNode, uid } from '@/lib/orgChartConstants';
import { isFillNone } from '@/lib/orgChartLayers';

export const DEFAULT_ACCENT = '#254dd0';

export const DETECT_SCOPES = [
  { key: 'cards_bg', label: 'Card Backgrounds' },
  { key: 'cards_border', label: 'Card Borders' },
  { key: 'shapes', label: 'Shapes' },
  { key: 'connectors', label: 'Connectors' },
];
export const ALL_SCOPE_KEYS = DETECT_SCOPES.map((s) => s.key);
export const DEFAULT_SCOPE = ['cards_bg', 'cards_border'];

export const LEGEND_LAYOUTS = [
  { key: 'vertical', label: 'Vertical List' },
  { key: 'horizontal', label: 'Horizontal List' },
  { key: 'two_column', label: 'Two Columns' },
  { key: 'compact', label: 'Compact' },
];

// ------------------------------------------------------------------ colors
const clampByte = (n) => Math.max(0, Math.min(255, Math.round(n)));
const toHexByte = (n) => clampByte(n).toString(16).padStart(2, '0');

// HEX, RGB and RGBA all collapse to one comparable #rrggbb. A fully transparent
// value is not a color at all and normalizes to null.
export function normalizeColor(value) {
  if (!value || typeof value !== 'string') return null;
  const raw = value.trim().toLowerCase();
  if (!raw || raw === 'transparent' || raw === 'none' || raw === 'inherit' || raw === 'currentcolor') return null;
  if (raw.startsWith('#')) {
    const hex = raw.slice(1);
    if (hex.length === 3) {
      return /^[0-9a-f]{3}$/.test(hex) ? `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : null;
    }
    if (hex.length === 6) return /^[0-9a-f]{6}$/.test(hex) ? `#${hex}` : null;
    if (hex.length === 8) {
      if (!/^[0-9a-f]{8}$/.test(hex)) return null;
      return parseInt(hex.slice(6), 16) === 0 ? null : `#${hex.slice(0, 6)}`;
    }
    return null;
  }
  const match = raw.match(/^rgba?\(([^)]+)\)$/);
  if (match) {
    const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
    if (parts.length > 3 && Number.isFinite(parts[3]) && parts[3] === 0) return null;
    return `#${toHexByte(parts[0])}${toHexByte(parts[1])}${toHexByte(parts[2])}`;
  }
  return null;
}

const borderWidthOf = (node) => {
  const raw = node?.border_width;
  if (raw === undefined || raw === null || raw === '') return 1;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 1;
};

// Distinct colors used by the chart, with how many objects use each one.
// Read from the live chart state — never from a stored copy of the palette.
export function detectColors({ nodes = [], edges = [], settings = {}, scope = DEFAULT_SCOPE } = {}) {
  const active = new Set(scope && scope.length ? scope : DEFAULT_SCOPE);
  const canvasBg = normalizeColor(settings.background_color || '#ffffff');
  const chartAccent = normalizeColor(settings.accent_color) || DEFAULT_ACCENT;
  const buckets = new Map();
  const add = (raw, bucket) => {
    const color = normalizeColor(raw);
    if (!color || color === canvasBg) return; // ignore no-fill and the canvas itself
    const row = buckets.get(color) || { color, count: 0, cards_bg: 0, cards_border: 0, shapes: 0, connectors: 0 };
    row.count += 1;
    row[bucket] += 1;
    buckets.set(color, row);
  };
  nodes
    .filter((n) => n && n.node_kind !== 'legend' && n.is_visible !== false)
    .forEach((n) => {
      const isCard = n.node_kind === 'employee' || n.node_kind === 'position';
      const isShape = n.node_kind === 'shape';
      const hasFill = !isFillNone(n);
      const hasBorder = borderWidthOf(n) > 0;
      if (isCard) {
        if (active.has('cards_bg') && hasFill) add(n.background_color || '#ffffff', 'cards_bg');
        if (active.has('cards_border') && hasBorder) add(n.border_color || n.accent_color || chartAccent, 'cards_border');
      }
      if (isShape && active.has('shapes')) {
        if (hasFill) add(n.background_color || '#ffffff', 'shapes');
        if (hasBorder) add(n.border_color || n.accent_color || chartAccent, 'shapes');
      }
    });
  if (active.has('connectors')) {
    edges.forEach((e) => add(e.color || connectorDefaults(e.relationship_type).color, 'connectors'));
  }
  return [...buckets.values()].sort((a, b) => b.count - a.count || a.color.localeCompare(b.color));
}

// Used by the interactive highlight: which objects carry this exact color today.
export function nodeHasColor(node, color) {
  const target = normalizeColor(color);
  if (!target || !node || node.node_kind === 'legend') return false;
  const own = [];
  if (!isFillNone(node) && normalizeColor(node.background_color)) own.push(normalizeColor(node.background_color));
  if (borderWidthOf(node) > 0) {
    const border = normalizeColor(node.border_color) || normalizeColor(node.accent_color);
    if (border) own.push(border);
  }
  return own.includes(target);
}

// ------------------------------------------------------------------ config
export const DEFAULT_LEGEND_CONFIG = {
  layout: 'vertical',
  scope: DEFAULT_SCOPE,
  swatch_shape: 'circle',
  swatch_size: 12,
  row_spacing: 8,
  show_header: true,
  header_color: '#6b7280',
  header_text_color: '#ffffff',
  auto_add: true,
  font_family: '',
  entries: [],
};

export const legendConfig = (node) => ({ ...DEFAULT_LEGEND_CONFIG, ...(node?.legend_config || {}) });

export const legendEntries = (node) => (legendConfig(node).entries || []).filter((e) => e && e.color);

export const visibleEntries = (node) => legendEntries(node).filter((e) => e.visible !== false);

export const makeEntry = (color, label = '') => ({
  id: uid(),
  color: normalizeColor(color) || '#94a3b8',
  label,
  visible: true,
});

// Adds colors that are not in the legend yet. Every existing entry — with its
// label, order and visibility — is preserved, and nothing is ever duplicated.
export function mergeDetected(entries = [], detected = []) {
  const known = new Set(entries.map((e) => normalizeColor(e.color)).filter(Boolean));
  const additions = detected.filter((d) => !known.has(d.color)).map((d) => makeEntry(d.color));
  return additions.length ? [...entries, ...additions] : entries;
}

export const unusedEntries = (node, detected = []) => {
  const used = new Set(detected.map((d) => d.color));
  return legendEntries(node).filter((e) => !used.has(normalizeColor(e.color)));
};

// ------------------------------------------------------------------ geometry
export function legendDefaultSize(count, config = DEFAULT_LEGEND_CONFIG) {
  const cfg = { ...DEFAULT_LEGEND_CONFIG, ...config };
  const cols = cfg.layout === 'two_column' ? 2 : cfg.layout === 'horizontal' ? Math.max(1, count) : 1;
  const rows = Math.max(1, Math.ceil(count / cols));
  const rowH = Math.max(cfg.swatch_size || 12, 18);
  const gap = cfg.layout === 'compact' ? Math.max(2, (cfg.row_spacing ?? 8) / 2) : (cfg.row_spacing ?? 8);
  const headerH = cfg.show_header === false ? 0 : 32;
  return {
    width: cols === 1 ? 240 : cols === 2 ? 300 : Math.max(240, count * 130),
    height: Math.round(headerH + 28 + rows * rowH + Math.max(0, rows - 1) * gap),
  };
}

// Shared metric block: the SVG export draws from exactly these numbers so an
// exported legend keeps the size, spacing and swatch geometry of the canvas.
export function legendGeometry(node) {
  const cfg = legendConfig(node);
  const entries = visibleEntries(node);
  const fontSize = Number(node?.font_size) || 13;
  const titleSize = Number(node?.font_size) || 13;
  const pad = node?.padding ?? 14;
  const swatch = cfg.swatch_shape === 'square' ? cfg.swatch_size : cfg.swatch_size;
  const gap = cfg.layout === 'compact' ? Math.max(2, cfg.row_spacing / 2) : cfg.row_spacing;
  const rowH = Math.max(cfg.swatch_size, Math.round(fontSize * 1.4));
  const headerH = cfg.show_header ? Math.round(titleSize * 1.35) + 16 : 0;
  const cols = cfg.layout === 'two_column' ? 2 : cfg.layout === 'horizontal' ? Math.max(1, entries.length) : 1;
  const rows = [];
  if (cols > 1) {
    for (let i = 0; i < entries.length; i += cols) rows.push(entries.slice(i, i + cols));
  } else {
    entries.forEach((entry) => rows.push([entry]));
  }
  const x = Number(node?.x) || 0;
  const y = Number(node?.y) || 0;
  const w = Number(node?.width) || 240;
  const h = Number(node?.height) || 200;
  const gapCol = 16;
  const colW = cols > 1 ? Math.max(40, (w - pad * 2 - gapCol * (cols - 1)) / cols) : w - pad * 2;
  return { cfg, entries, rows, x, y, w, h, pad, swatch, gap, rowH, headerH, cols, colW, gapCol, fontSize, titleSize, title: node?.name || 'Legend' };
}

// ------------------------------------------------------------------ node
export function defaultLegendNode(x, y, { entries = [], scope = DEFAULT_SCOPE } = {}) {
  const config = { ...DEFAULT_LEGEND_CONFIG, scope, entries };
  const { width, height } = legendDefaultSize(entries.length, config);
  return {
    ...defaultNode('legend', x, y),
    node_kind: 'legend',
    name: 'Legend',
    width,
    height,
    background_color: '#ffffff',
    border_color: '#dcdfe5',
    border_width: 0,
    border_style: 'solid',
    corner_radius: 8,
    text_color: '#333333',
    font_size: 13,
    font_weight: '500',
    padding: 14,
    align: 'left',
    shadow: 'sm',
    fill_mode: 'solid',
    legend_config: config,
  };
}

// Picks an insertion spot that does not sit on top of an existing object, and
// keeps the legend inside the area the user is currently looking at.
export function legendInsertionPoint(nodes = [], size, visibleWorld) {
  const objects = nodes.filter((n) => n.is_visible !== false && n.node_kind !== 'legend');
  const overlaps = (x, y) => objects.some((n) => {
    const w = n.width || 260;
    const h = n.height || 118;
    return !(n.x + w + 20 < x || n.x > x + size.width + 20 || n.y + h + 20 < y || n.y > y + size.height + 20);
  });
  const fallback = visibleWorld
    ? { x: Math.round(visibleWorld.x + 40), y: Math.round(visibleWorld.y + 40) }
    : { x: 240, y: 200 };
  if (!objects.length) return fallback;

  const minX = Math.min(...objects.map((n) => n.x));
  const minY = Math.min(...objects.map((n) => n.y));
  const maxX = Math.max(...objects.map((n) => n.x + (n.width || 260)));
  const maxY = Math.max(...objects.map((n) => n.y + (n.height || 118)));
  const candidates = [
    { x: Math.round(maxX + 60), y: Math.round(minY) },
    { x: Math.round(minX), y: Math.round(maxY + 60) },
    { x: Math.round(minX - size.width - 60), y: Math.round(minY) },
    { x: Math.round(minX), y: Math.round(minY - size.height - 60) },
  ];
  const free = candidates.find((c) => !overlaps(c.x, c.y)) || candidates[0];
  if (!visibleWorld) return free;
  // Nudge it back into the visible canvas when the chart itself is off-screen.
  const clampX = Math.min(Math.max(free.x, visibleWorld.x + 24), visibleWorld.x + visibleWorld.w - size.width - 24);
  const clampY = Math.min(Math.max(free.y, visibleWorld.y + 24), visibleWorld.y + visibleWorld.h - size.height - 24);
  const clamped = {
    x: Number.isFinite(clampX) ? Math.round(clampX) : free.x,
    y: Number.isFinite(clampY) ? Math.round(clampY) : free.y,
  };
  return overlaps(clamped.x, clamped.y) ? free : clamped;
}

// ------------------------------------------------------------------ SVG export
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function legendSvgMarkup(node) {
  const g = legendGeometry(node);
  const { cfg } = g;
  const fillNone = isFillNone(node);
  const radius = Number(node.corner_radius ?? 8);
  const strokeWidth = Number(node.border_width || 0);
  const font = cfg.font_family || 'Inter, Arial, sans-serif';
  const textColor = node.text_color || '#333333';
  const parts = [];

  parts.push(`<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="${radius}" fill="${fillNone ? 'none' : esc(node.background_color || '#ffffff')}"${strokeWidth > 0 ? ` stroke="${esc(node.border_color || '#dcdfe5')}" stroke-width="${strokeWidth}"` : ''} />`);
  if (cfg.show_header) {
    parts.push(`<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.headerH}" rx="${Math.min(radius, g.headerH / 2)}" fill="${esc(cfg.header_color)}" />`);
    parts.push(`<rect x="${g.x}" y="${g.y + Math.min(radius, g.headerH / 2)}" width="${g.w}" height="${Math.max(0, g.headerH - Math.min(radius, g.headerH / 2))}" fill="${esc(cfg.header_color)}" />`);
    parts.push(`<text x="${g.x + g.pad}" y="${g.y + g.headerH / 2 + g.titleSize * 0.36}" font-family="${esc(font)}" font-size="${g.titleSize}" font-weight="700" fill="${esc(cfg.header_text_color)}">${esc(g.title)}</text>`);
  }
  const contentTop = g.y + g.headerH + g.pad;
  g.rows.forEach((row, rowIndex) => {
    const centerY = contentTop + rowIndex * (g.rowH + g.gap) + g.rowH / 2;
    row.forEach((entry, colIndex) => {
      const colX = g.x + g.pad + colIndex * (g.colW + g.gapCol);
      const swatchX = colX + g.swatch / 2;
      parts.push(cfg.swatch_shape === 'square'
        ? `<rect x="${swatchX - g.swatch / 2}" y="${centerY - g.swatch / 2}" width="${g.swatch}" height="${g.swatch}" rx="2" fill="${esc(entry.color)}" stroke="rgba(15,23,42,0.12)" />`
        : `<circle cx="${swatchX}" cy="${centerY}" r="${g.swatch / 2}" fill="${esc(entry.color)}" stroke="rgba(15,23,42,0.12)" />`);
      parts.push(`<text x="${colX + g.swatch + 8}" y="${centerY + g.fontSize * 0.36}" font-family="${esc(font)}" font-size="${g.fontSize}" font-weight="500" fill="${esc(textColor)}">${esc(entry.label || entry.color)}</text>`);
    });
  });
  if (!g.entries.length) {
    parts.push(`<text x="${g.x + g.pad}" y="${contentTop + g.rowH / 2}" font-family="${esc(font)}" font-size="${g.fontSize}" fill="${esc(textColor)}" opacity="0.6">No legend items yet</text>`);
  }
  const opacity = node.opacity !== undefined && node.opacity !== null && node.opacity !== '' ? Math.min(100, Math.max(0, Number(node.opacity))) / 100 : 1;
  return `<g${opacity < 1 ? ` opacity="${opacity}"` : ''}>${parts.join('')}</g>`;
}