import React, { useEffect, useRef } from 'react';
import { edgeAnchors } from '@/lib/orgChartLayout';
import { connectorColor } from '@/lib/orgChartConstants';

// Connectors for the exported image are painted onto a canvas that uses exactly
// the same world coordinates as the cards. A canvas keeps its own pixel grid, so
// lines can never drift away from the cards the way a scaled SVG raster can.
const RATIO = 2;

function pathTail(ctx, start, end, sPort, tPort, style, bends) {
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  if (bends && bends.length) {
    let tail = start;
    bends.forEach((p) => { ctx.lineTo(p.x, p.y); tail = p; });
    ctx.lineTo(end.x, end.y);
    return tail;
  }
  if (style === 'straight') {
    ctx.lineTo(end.x, end.y);
    return start;
  }
  const vertical = sPort === 'top' || sPort === 'bottom';
  if (style === 'curved') {
    const c1 = vertical
      ? { x: start.x, y: start.y + (end.y - start.y) / 2 }
      : { x: start.x + (end.x - start.x) / 2, y: start.y };
    const c2 = vertical
      ? { x: end.x, y: start.y + (end.y - start.y) / 2 }
      : { x: start.x + (end.x - start.x) / 2, y: end.y };
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
    return c2;
  }
  if (vertical) {
    const mid = (start.y + end.y) / 2;
    ctx.lineTo(start.x, mid);
    ctx.lineTo(end.x, mid);
    ctx.lineTo(end.x, end.y);
    return { x: end.x, y: mid };
  }
  const mid = (start.x + end.x) / 2;
  ctx.lineTo(mid, start.y);
  ctx.lineTo(mid, end.y);
  ctx.lineTo(end.x, end.y);
  return { x: mid, y: end.y };
}

function arrowhead(ctx, tail, end, color, thickness) {
  const angle = Math.atan2(end.y - tail.y, end.x - tail.x);
  // Match the live SVG marker: 7 stroke units, viewBox 0 0 10 10, ref 9 5.
  const unit = thickness * 0.7;
  ctx.save();
  ctx.translate(end.x, end.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(unit, 0);
  ctx.lineTo(-9 * unit, 5 * unit);
  ctx.lineTo(-9 * unit, -5 * unit);
  ctx.closePath();
  ctx.restore();
  ctx.fillStyle = color;
  ctx.fill();
}

export default function ExportConnectorCanvas({ rect, nodes, edges }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = Math.max(1, Math.ceil(rect.w));
    const h = Math.max(1, Math.ceil(rect.h));
    // Limit both bitmap area and dimensions without changing CSS/world geometry.
    const ratio = Math.min(rect.resolution || RATIO, Math.sqrt(32_000_000 / (w * h)), 16384 / w, 16384 / h);
    canvas.width = Math.max(1, Math.floor(w * ratio));
    canvas.height = Math.max(1, Math.floor(h * ratio));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.dataset.exportReady = '0';
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.dataset.exportReady = 'error';
      return;
    }
    // Use the allocated size on each axis so bitmap rounding cannot shift anchors.
    ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.translate(-rect.x, -rect.y);

    const byId = new Map(nodes.map(n => [n.id, n]));
    edges.forEach((edge) => {
      const source = byId.get(edge.source_id);
      const target = byId.get(edge.target_id);
      if (!source || !target) return;
      const { start, end, sPort, tPort } = edgeAnchors(source, target, edge.source_port, edge.target_port);
      const color = edge.color || connectorColor(edge.relationship_type);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = edge.thickness || 1.5;
      ctx.lineJoin = 'miter';
      ctx.lineCap = 'butt';
      if (edge.line_style === 'dashed') ctx.setLineDash([9, 6]);
      else if (edge.line_style === 'dotted') ctx.setLineDash([2, 5]);
      const tail = pathTail(ctx, start, end, sPort, tPort, edge.path_style || 'orthogonal', edge.bend_points);
      ctx.stroke();
      ctx.restore();
      if (edge.arrow !== false) arrowhead(ctx, tail, end, color, edge.thickness || 1.5);
      if (edge.label) {
        const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
        const boxW = Math.max(56, edge.label.length * 7.2);
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = `${color}55`;
        ctx.lineWidth = 1;
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(mid.x - boxW / 2, mid.y - 9, boxW, 18, 4);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(mid.x - boxW / 2, mid.y - 9, boxW, 18);
        }
        ctx.fillStyle = '#334155';
        ctx.font = '10px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(edge.label, mid.x, mid.y + 3);
        ctx.restore();
      }
    });
    canvas.dataset.exportReady = '1';
  }, [rect, nodes, edges]);

  return <canvas ref={canvasRef} data-export-ready="0" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 0 }} />;
}