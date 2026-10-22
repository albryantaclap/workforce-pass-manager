// Export pipeline for the Visual Org Chart Builder:
// PNG / JPEG (canvas capture), PDF (multi page, page sizes), SVG, editable JSON
// chart definition and an Excel personnel list.

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';
import { buildEdgePath, edgeAnchors, nodeSize } from '@/lib/orgChartLayout';

export const PAGE_SIZES = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  A0: [841, 1189],
};

export const EXPORT_FORMATS = ['PNG', 'JPEG', 'PDF', 'SVG', 'JSON', 'Excel'];
export const EXPORT_AREAS = [
  { key: 'all', label: 'Entire Chart' },
  { key: 'visible', label: 'Visible Area' },
  { key: 'selection', label: 'Selected Area' },
];

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const safeName = (value) => String(value || 'org-chart').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();

// Captured images paint card text without its ellipsis, so anything too long for
// its box was clipped mid-word. Shrink it to fit, and only wrap when it still
// does not fit at the smallest readable size.
const HTML_NS = 'http://www.w3.org/1999/xhtml';
const MIN_FONT_PX = 9;

function fitClippedText(doc) {
  const view = doc.defaultView;
  doc.querySelectorAll('[data-node-id] *').forEach((el) => {
    if (el.namespaceURI !== HTML_NS) return;                  // skip icon / shape SVGs
    if (el.children.length || !el.textContent?.trim()) return; // text leaves only
    const available = el.clientWidth;
    if (!available || el.scrollWidth <= available + 1) return;
    let size = parseFloat(view.getComputedStyle(el).fontSize) || 13;
    let guard = 0;
    while (el.scrollWidth > available + 1 && size > MIN_FONT_PX && guard < 24) {
      size = Math.round((size - 0.5) * 10) / 10;
      el.style.fontSize = `${size}px`;
      guard += 1;
    }
    if (el.scrollWidth > available + 1) {
      el.style.whiteSpace = 'normal';
      el.style.overflowWrap = 'anywhere';
      el.style.wordBreak = 'break-word';
    }
  });
}

const MAX_EXPORT_PIXELS = 260_000_000;

export async function captureElement(element, { scale = 2, transparent = false, background = '#ffffff' } = {}) {
  if (!element) throw new Error('There is nothing to export yet');
  const width = Math.round(element.offsetWidth * scale);
  const height = Math.round(element.offsetHeight * scale);
  if (width * height > MAX_EXPORT_PIXELS) {
    throw new Error(`This export would be ${width}×${height} px, which is too large for the browser. Choose a lower resolution or export as SVG.`);
  }
  return html2canvas(element, {
    backgroundColor: transparent ? null : background,
    scale,
    useCORS: true,
    logging: false,
    onclone: (doc) => fitClippedText(doc),
  });
}

// Waits for the off-screen export surface to mount, then for its fonts and
// photos to finish loading, so nothing renders blank or at a fallback font.
export async function waitForExportSurface(getElement, { timeout = 5000 } = {}) {
  const startedAt = Date.now();
  let element = getElement();
  while (!element && Date.now() - startedAt < timeout) {
    await new Promise(resolve => setTimeout(resolve, 50));
    element = getElement();
  }
  if (!element) throw new Error('The export could not be prepared. Please try again.');
  if (document.fonts?.ready) await document.fonts.ready;
  // The connectors are painted onto their own canvas; wait until that paint is done.
  const canvas = element.querySelector('canvas[data-export-ready]');
  while (canvas && canvas.dataset.exportReady !== '1' && Date.now() - startedAt < timeout) {
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  await Promise.all([...element.querySelectorAll('img')].map(img => (
    img.complete && img.naturalWidth
      ? null
      : new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      })
  )).filter(Boolean));
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  return element;
}

const canvasToBlob = (canvas, format) => new Promise(resolve => {
  canvas.toBlob(blob => resolve(blob), format === 'JPEG' ? 'image/jpeg' : 'image/png', 0.95);
});

export async function exportImage(canvas, { format = 'PNG', transparent = false, filename }) {
  if (transparent && format === 'JPEG') throw new Error('JPEG does not support a transparent background');
  const blob = await canvasToBlob(canvas, format);
  downloadBlob(blob, `${filename}.${format.toLowerCase() === 'jpeg' ? 'jpg' : 'png'}`);
}

export async function exportPdf(canvas, opts) {
  const {
    pageSize = 'A4', orientation = 'landscape', fitToPage = true, multiPage = true,
    header = {}, filename = 'org-chart',
  } = opts;
  const [w, h] = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;
  const doc = new jsPDF({ orientation, unit: 'mm', format: [w, h] });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 10;
  const headerLines = [
    header.chartTitle, header.projectName,
    header.revisionNo ? `Rev ${header.revisionNo}` : '',
    header.effectiveDate ? `Effective ${header.effectiveDate}` : '',
    header.preparedBy ? `Prepared by ${header.preparedBy}` : '',
    header.approvedBy ? `Approved by ${header.approvedBy}` : '',
  ].filter(Boolean);
  const headerH = headerLines.length ? 6 + headerLines.length * 5 : 0;
  const drawHeader = () => {
    if (!headerLines.length) return;
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(headerLines[0], margin, margin + 4);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    headerLines.slice(1).forEach((line, i) => doc.text(line, margin, margin + 9 + i * 4.5));
    doc.setTextColor(0);
  };
  const imgData = canvas.toDataURL('image/png');
  const availableW = pw - margin * 2;
  const availableH = ph - margin * 2 - headerH;
  const scale = fitToPage
    ? Math.min(availableW / canvas.width, multiPage ? Infinity : availableH / canvas.height)
    : 1;
  const drawW = canvas.width * scale;
  const drawH = canvas.height * scale;
  if (drawH <= availableH) {
    drawHeader();
    doc.addImage(imgData, 'PNG', margin, margin + headerH, drawW, drawH);
  } else if (multiPage) {
    let offset = 0;
    let page = 0;
    while (offset < drawH) {
      if (page > 0) doc.addPage([w, h], orientation);
      drawHeader();
      doc.addImage(imgData, 'PNG', margin, margin + headerH - offset, drawW, drawH);
      offset += availableH;
      page += 1;
      if (page > 40) break;
    }
  } else {
    const single = Math.min(availableW / canvas.width, availableH / canvas.height);
    doc.addImage(imgData, 'PNG', margin, margin + headerH, canvas.width * single, canvas.height * single);
  }
  doc.save(`${filename}.pdf`);
}

export function exportSvg(nodes, edges, { background = '#ffffff', transparent = false, title = 'Org Chart' } = {}) {
  const visible = nodes.filter(n => n.is_visible !== false);
  if (!visible.length) throw new Error('There is nothing to export yet');
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  visible.forEach(n => {
    const { w, h } = nodeSize(n);
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h);
  });
  const pad = 40;
  const width = maxX - minX + pad * 2;
  const height = maxY - minY + pad * 2;
  const byId = new Map(visible.map(n => [n.id, n]));
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const arrowColors = [...new Set(edges.filter(e => e.arrow !== false).map(e => e.color || '#254dd0'))];
  const markerFor = (color) => (arrowColors.includes(color) ? ` marker-end="url(#oc-export-arrow-${arrowColors.indexOf(color)})"` : '');
  const defs = arrowColors.length
    ? `<defs>${arrowColors.map((color, i) => `<marker id="oc-export-arrow-${i}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${esc(color)}" /></marker>`).join('')}</defs>`
    : '';
  const edgeMarkup = edges.map(e => {
    const s = byId.get(e.source_id);
    const t = byId.get(e.target_id);
    if (!s || !t) return '';
    const { start, end, sPort, tPort } = edgeAnchors(s, t, e.source_port, e.target_port);
    const d = buildEdgePath(start, end, sPort, tPort, e.path_style || 'orthogonal', e.bend_points);
    const dash = e.line_style === 'dashed' ? ' stroke-dasharray="8 6"' : e.line_style === 'dotted' ? ' stroke-dasharray="2 5"' : '';
    const color = e.color || '#254dd0';
    return `<path d="${d}" fill="none" stroke="${esc(color)}" stroke-width="${e.thickness || 1.5}"${dash}${markerFor(color)} />`;
  }).join('');
  const nodeMarkup = visible.map(n => {
    const { w, h } = nodeSize(n);
    const accent = n.accent_color || '#254dd0';
    const bg = n.background_color || '#ffffff';
    const lines = [n.name, n.designation, n.department].filter(Boolean);
    const text = lines.map((line, i) => `<text x="${n.x + w / 2}" y="${n.y + 28 + i * 16}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${i === 0 ? 14 : 11}" font-weight="${i === 0 ? 700 : 400}" fill="${esc(n.text_color || '#0e1425')}">${esc(line)}</text>`).join('');
    return `<g><rect x="${n.x}" y="${n.y}" width="${w}" height="${h}" rx="${n.corner_radius ?? 12}" fill="${esc(bg)}" stroke="${esc(n.border_color || accent)}" stroke-width="${n.border_width ?? 1}" />${text}</g>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(height)}" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}">
<title>${esc(title)}</title>
${defs}
<rect x="0" y="0" width="${Math.round(width)}" height="${Math.round(height)}" fill="${transparent ? 'none' : esc(background)}" />
<g transform="translate(${pad - minX} ${pad - minY})">${edgeMarkup}${nodeMarkup}</g>
</svg>`;
  return svg;
}

export function exportSvgFile(nodes, edges, options) {
  const svg = exportSvg(nodes, edges, options);
  downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${options.filename || 'org-chart'}.svg`);
}

export function exportJson(chart, nodes, edges, filename = 'org-chart') {
  const payload = {
    format: 'gso-org-chart',
    format_version: 1,
    exported_at: new Date().toISOString(),
    chart: {
      name: chart?.name, project_name: chart?.project_name, description: chart?.description,
      status: chart?.status, revision_no: chart?.revision_no, view_settings: chart?.view_settings,
      card_presets: chart?.card_presets, legend_notes: chart?.legend_notes,
      effective_date: chart?.effective_date, prepared_by: chart?.prepared_by, approved_by: chart?.approved_by,
    },
    nodes,
    edges,
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `${filename}.json`);
}

export async function exportExcel(nodes, chart, filename = 'org-chart-personnel') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GSO Qatar Workforce Management';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Personnel');
  sheet.columns = [
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Designation', key: 'designation', width: 30 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Company', key: 'company', width: 22 },
    { header: 'Project', key: 'project_name', width: 24 },
    { header: 'Employee ID', key: 'employee_code', width: 16 },
    { header: 'PID', key: 'pid', width: 16 },
    { header: 'Email', key: 'email', width: 26 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Employment Status', key: 'employment_status', width: 20 },
    { header: 'Position Grade', key: 'position_grade', width: 16 },
    { header: 'Planned Fill Date', key: 'planned_fill_date', width: 18 },
    { header: 'Card Source', key: 'link_source', width: 16 },
    { header: 'Remarks', key: 'remarks', width: 30 },
  ];
  sheet.getRow(1).font = { bold: true };
  nodes
    .filter(n => n.node_kind === 'employee' || n.node_kind === 'position')
    .forEach(n => sheet.addRow({
      name: n.name, designation: n.designation, department: n.department, company: n.company,
      project_name: n.project_name, employee_code: n.employee_code, pid: n.pid, email: n.email,
      phone: n.phone, employment_status: n.employment_status, position_grade: n.position_grade,
      planned_fill_date: n.planned_fill_date, link_source: n.link_source, remarks: n.remarks,
    }));
  const title = workbook.addWorksheet('Chart');
  title.addRow(['Chart', chart?.name || '']);
  title.addRow(['Project', chart?.project_name || '']);
  title.addRow(['Revision', chart?.revision_no || 1]);
  title.addRow(['Exported', new Date().toISOString()]);
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`);
}