import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NodeCard from '@/components/orgchart/NodeCard';
import ConnectorLayer from '@/components/orgchart/ConnectorLayer';
import LegendCard from '@/components/orgchart/legend/LegendCard';
import ResizeHandles from '@/components/orgchart/ResizeHandles';
import { nodeSize } from '@/lib/orgChartLayout';
import { nodeHasColor } from '@/lib/orgChartLegend';
import { computeResize } from '@/lib/orgChartResize';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
const GUIDE_TOLERANCE = 6;

const unique = (list) => [...new Set(list)];

// Visual-only alignment guides while resizing (no snapping — grid snap owns
// that, so the two can never fight each other).
const resizeGuides = (draft, nodes, selfId) => {
  const out = [];
  const xs = [draft.x, draft.x + draft.width / 2, draft.x + draft.width];
  const ys = [draft.y, draft.y + draft.height / 2, draft.y + draft.height];
  nodes.forEach(other => {
    if (other.id === selfId || other.is_visible === false) return;
    const os = nodeSize(other);
    [other.x, other.x + os.w / 2, other.x + os.w].forEach(theirs => {
      if (xs.some(mine => Math.abs(mine - theirs) <= GUIDE_TOLERANCE)) out.push({ axis: 'v', value: theirs });
    });
    [other.y, other.y + os.h / 2, other.y + os.h].forEach(theirs => {
      if (ys.some(mine => Math.abs(mine - theirs) <= GUIDE_TOLERANCE)) out.push({ axis: 'h', value: theirs });
    });
  });
  return out.slice(0, 8);
};

export default function ChartCanvas({
  nodes, edges, view, setView, settings, tool, canEdit,
  selection, setSelection, selectedEdgeId, setSelectedEdgeId,
  onUpdateNodes, onUpdateEdge, onCreateEdge, onReconnectEdge,
  onAddAt, onOpenNode, onContextMenu, onQuickAdd, onAction, containerRef,
  onBeginGesture, onEndGesture, highlight, onLegendEntryClick,
}) {
  const [drag, setDrag] = useState(null);
  const [resize, setResize] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [connect, setConnect] = useState(null);
  const [pan, setPan] = useState(null);
  const [guides, setGuides] = useState([]);
  const [hoverId, setHoverId] = useState(null);
  const spaceRef = useRef(false);
  // Authoritative copy of the live gesture, so pointerup / pointercancel /
  // Escape can never read a stale render and double-commit a resize.
  const resizeRef = useRef(null);

  const grid = settings.grid_size || 20;

  useEffect(() => {
    const down = (e) => { if (e.code === 'Space') spaceRef.current = true; };
    const up = (e) => { if (e.code === 'Space') spaceRef.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const toWorld = useCallback((clientX, clientY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left - view.x) / view.zoom, y: (clientY - rect.top - view.y) / view.zoom };
  }, [containerRef, view.x, view.y, view.zoom]);

  // ------------------------------------------------------- zoom (wheel at cursor)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const scaleFactor = Math.exp(-e.deltaY * 0.0015);
      setView(prev => {
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * scaleFactor));
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        return {
          x: px - (px - prev.x) * (zoom / prev.zoom),
          y: py - (py - prev.y) * (zoom / prev.zoom),
          zoom,
        };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [containerRef, setView]);

  const displayNodes = useMemo(() => nodes
    .filter(n => n.is_visible !== false)
    .map(n => {
      if (drag && drag.ids.includes(n.id)) return { ...n, x: n.x + drag.delta.x, y: n.y + drag.delta.y };
      if (resize && resize.kind === 'resize' && resize.draft && resize.id === n.id) {
        return { ...n, x: resize.draft.x, y: resize.draft.y, width: resize.draft.width, height: resize.draft.height };
      }
      return n;
    }), [nodes, drag, resize]);

  const nodeById = useCallback((id) => nodes.find(n => n.id === id), [nodes]);

  // ------------------------------------------------------------------ gestures
  const handleNodePointerDown = (node, e) => {
    e.stopPropagation();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    let ids;
    if (additive) {
      ids = selection.includes(node.id) ? selection.filter(id => id !== node.id) : [...selection, node.id];
    } else if (node.group_id) {
      ids = nodes.filter(n => n.group_id === node.group_id).map(n => n.id);
    } else {
      ids = selection.includes(node.id) ? selection : [node.id];
    }
    setSelection(ids);
    setSelectedEdgeId(null);
    if (!canEdit || node.is_locked) return;
    if (tool === 'connector') {
      setConnect({ fromId: node.id, port: 'auto', reconnect: null, to: toWorld(e.clientX, e.clientY) });
      return;
    }
    const movable = ids.filter(id => { const n = nodeById(id); return n && !n.is_locked; });
    if (!movable.length) return;
    setDrag({ ids: movable, startWorld: toWorld(e.clientX, e.clientY), delta: { x: 0, y: 0 } });
  };

  const handleBackgroundPointerDown = (e) => {
    if (e.button === 1 || tool === 'hand' || spaceRef.current) {
      setPan({ clientX: e.clientX, clientY: e.clientY, viewX: view.x, viewY: view.y });
      return;
    }
    setMarquee({ x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, additive: e.shiftKey });
    if (!e.shiftKey) {
      setSelection([]);
      setSelectedEdgeId(null);
    }
  };

  // Captures the box the gesture started from. Nothing is written to the chart
  // until the pointer is released, so dragging stays smooth and one gesture is
  // exactly one undo step.
  const startResize = (node, handle, e) => {
    e.stopPropagation();
    e.preventDefault?.();
    if (!canEdit || node.is_locked) return;
    const size = nodeSize(node);
    const start = { x: node.x, y: node.y, width: size.w, height: size.h };
    const gesture = {
      kind: 'resize',
      id: node.id,
      handle,
      start,
      rotation: Number(node.rotation) || 0,
      startWorld: toWorld(e.clientX, e.clientY),
      draft: start,
    };
    resizeRef.current = gesture;
    setResize(gesture);
  };

  const startRotate = (node, e) => {
    e.stopPropagation();
    e.preventDefault?.();
    if (!canEdit || node.is_locked) return;
    const size = nodeSize(node);
    const center = { x: node.x + size.w / 2, y: node.y + size.h / 2 };
    const gesture = {
      kind: 'rotate',
      id: node.id,
      center,
      rotation: Number(node.rotation) || 0,
      startWorld: toWorld(e.clientX, e.clientY),
    };
    resizeRef.current = gesture;
    setResize(gesture);
  };

  const startConnect = (node, port, e) => {
    e.stopPropagation();
    setConnect({ fromId: node.id, port, reconnect: null, to: toWorld(e.clientX, e.clientY) });
  };

  const startReconnect = (edgeId, end, e) => {
    e.stopPropagation();
    const edge = edges.find(x => x.id === edgeId);
    if (!edge) return;
    setConnect({ fromId: end === 'source' ? edge.target_id : edge.source_id, port: 'auto', reconnect: { edgeId, end }, to: toWorld(e.clientX, e.clientY) });
  };

  const startBend = (edgeId, index, e) => {
    e.stopPropagation();
    resizeRef.current = null;
    setResize(null);
    // One undo step for the whole bend drag, captured before the first move.
    onBeginGesture?.();
    setDrag({ bend: { edgeId, index }, ids: [], startWorld: toWorld(e.clientX, e.clientY), delta: { x: 0, y: 0 } });
  };

  useEffect(() => {
    if (!pan && !drag && !resize && !marquee && !connect) return undefined;

    // Ends the current resize / rotate. `commit` false (Escape, pointercancel)
    // restores the original geometry and records no history entry.
    const finishResize = (commit) => {
      const gesture = resizeRef.current;
      resizeRef.current = null;
      setResize(null);
      setGuides([]);
      if (!gesture) return;
      const current = nodeById(gesture.id);
      if (!current) return;
      if (gesture.kind === 'rotate') {
        const angle = Number(gesture.rotation) || 0;
        if (commit && angle !== (Number(current.rotation) || 0)) {
          onUpdateNodes([{ id: gesture.id, rotation: angle }]);
        }
        return;
      }
      const draft = gesture.draft;
      const start = gesture.start;
      if (!commit || !draft) return;
      if (draft.x === start.x && draft.y === start.y
        && draft.width === start.width && draft.height === start.height) return;
      // One completed gesture = one saved geometry = one undo step.
      onUpdateNodes([{
        id: gesture.id,
        x: draft.x,
        y: draft.y,
        width: draft.width,
        height: draft.height,
      }]);
    };

    const move = (e) => {
      if (pan) {
        setView(prev => ({ ...prev, x: pan.viewX + (e.clientX - pan.clientX), y: pan.viewY + (e.clientY - pan.clientY) }));
        return;
      }
      if (marquee) {
        setMarquee(m => ({ ...m, x1: e.clientX, y1: e.clientY }));
        return;
      }
      if (connect) {
        setConnect(c => ({ ...c, to: toWorld(e.clientX, e.clientY) }));
        return;
      }
      if (drag?.bend) {
        const point = toWorld(e.clientX, e.clientY);
        const edge = edges.find(x => x.id === drag.bend.edgeId);
        if (!edge) return;
        const points = [...(edge.bend_points || [])];
        points[drag.bend.index] = { x: Math.round(point.x), y: Math.round(point.y) };
        onUpdateEdge(edge.id, { bend_points: points });
        return;
      }
      if (drag) {
        const world = toWorld(e.clientX, e.clientY);
        let dx = world.x - drag.startWorld.x;
        let dy = world.y - drag.startWorld.y;
        const primary = nodeById(drag.ids[0]);
        if (primary && settings.snap_to_grid) {
          const size = nodeSize(primary);
          const snappedX = Math.round((primary.x + dx) / grid) * grid;
          const snappedY = Math.round((primary.y + dy) / grid) * grid;
          dx = snappedX - primary.x;
          dy = snappedY - primary.y;
          const snappedW = size.w;
          const snappedH = size.h;
          if (snappedW) { /* keep size for guide math below */ }
          if (snappedH) { /* no-op */ }
        }
        const nextGuides = [];
        if (primary && settings.show_guides) {
          const size = nodeSize(primary);
          const xs = [primary.x + dx, primary.x + dx + size.w / 2, primary.x + dx + size.w];
          const ys = [primary.y + dy, primary.y + dy + size.h / 2, primary.y + dy + size.h];
          nodes.forEach(other => {
            if (drag.ids.includes(other.id) || other.is_visible === false) return;
            const os = nodeSize(other);
            const otherXs = [other.x, other.x + os.w / 2, other.x + os.w];
            const otherYs = [other.y, other.y + os.h / 2, other.y + os.h];
            xs.forEach(mine => otherXs.forEach(theirs => {
              if (Math.abs(mine - theirs) <= GUIDE_TOLERANCE) {
                dx += theirs - mine;
                nextGuides.push({ axis: 'v', value: theirs });
              }
            }));
            ys.forEach(mine => otherYs.forEach(theirs => {
              if (Math.abs(mine - theirs) <= GUIDE_TOLERANCE) {
                dy += theirs - mine;
                nextGuides.push({ axis: 'h', value: theirs });
              }
            }));
          });
        }
        setGuides(nextGuides);
        setDrag(d => ({ ...d, delta: { x: dx, y: dy } }));
        return;
      }
      if (resize) {
        const world = toWorld(e.clientX, e.clientY);
        if (resize.kind === 'rotate') {
          const angle = Math.atan2(world.y - resize.center.y, world.x - resize.center.x) * (180 / Math.PI) + 90;
          const next = { ...resize, rotation: Math.round(angle) };
          resizeRef.current = next;
          setResize(next);
          return;
        }
        // Always measured from the box captured at pointerdown — the delta is
        // applied once, never added to the live size (that double-counting is
        // what made the handle run away from the cursor).
        const draft = computeResize({
          start: resize.start,
          handle: resize.handle,
          dx: world.x - resize.startWorld.x,
          dy: world.y - resize.startWorld.y,
          rotation: resize.rotation,
          aspect: e.shiftKey,
          fromCenter: e.altKey,
          snap: !!settings.snap_to_grid,
          grid,
        });
        const next = { ...resize, draft };
        resizeRef.current = next;
        setResize(next);
        setGuides(settings.show_guides && !resize.rotation ? resizeGuides(draft, nodes, resize.id) : []);
      }
    };

    const up = (e) => {
      if (pan) setPan(null);
      if (connect) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const targetNodeEl = el?.closest?.('[data-node-id]');
        const targetId = targetNodeEl?.getAttribute('data-node-id');
        setConnect(c => {
          if (targetId && targetId !== c.fromId) {
            if (c.reconnect) {
              onReconnectEdge(c.reconnect.edgeId, c.reconnect.end, targetId);
            } else {
              onCreateEdge(c.fromId, targetId, { source_port: c.port });
            }
          }
          return null;
        });
      }
      if (marquee) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const a = {
            x: Math.min(marquee.x0, marquee.x1), y: Math.min(marquee.y0, marquee.y1),
            w: Math.abs(marquee.x1 - marquee.x0), h: Math.abs(marquee.y1 - marquee.y0),
          };
          if (a.w > 4 || a.h > 4) {
            const x1 = (a.x - rect.left - view.x) / view.zoom;
            const y1 = (a.y - rect.top - view.y) / view.zoom;
            const x2 = x1 + a.w / view.zoom;
            const y2 = y1 + a.h / view.zoom;
            const hits = nodes
              .filter(n => n.is_visible !== false)
              .filter(n => {
                const s = nodeSize(n);
                return !(n.x + s.w < x1 || n.x > x2 || n.y + s.h < y1 || n.y > y2);
              })
              .map(n => n.id);
            setSelection(prev => (marquee.additive ? unique([...prev, ...hits]) : hits));
          }
        }
        setMarquee(null);
      }
      if (resize) finishResize(true);
      if (drag) {
        if (drag.bend) {
          onEndGesture?.(true);
          setDrag(null);
          setGuides([]);
          return;
        }
        if (drag.delta.x || drag.delta.y) {
          const patches = drag.ids
            .map(id => {
              const n = nodeById(id);
              if (!n) return null;
              return { id, x: Math.round(n.x + drag.delta.x), y: Math.round(n.y + drag.delta.y) };
            })
            .filter(Boolean);
          onUpdateNodes(patches);
        }
        setDrag(null);
        setGuides([]);
      }
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    // A cancelled or captured-lost pointer must not leave the object stuck at a
    // preview size: the gesture is restored (cancel) or finished safely.
    const onPointerCancel = () => finishResize(false);
    const onLostCapture = () => { if (resizeRef.current) finishResize(true); };
    const onKeyDown = (e) => {
      if (e.key !== 'Escape' || !resizeRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      finishResize(false);
    };
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('lostpointercapture', onLostCapture, true);
    if (resize) window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('lostpointercapture', onLostCapture, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [pan, drag, resize, marquee, connect, nodes, edges, view, grid, settings, toWorld, setView, setSelection, onUpdateNodes, onUpdateEdge, onCreateEdge, onReconnectEdge, nodeById, containerRef, onBeginGesture, onEndGesture]);

  const single = selection.length === 1 ? displayNodes.find(n => n.id === selection[0]) : null;
  const singleSize = single ? nodeSize(single) : null;
  const connectStart = connect
    ? (() => {
      const from = nodeById(connect.fromId);
      if (!from) return null;
      return connect.reconnect
        ? (connect.reconnect.end === 'source' ? { x: from.x + nodeSize(from).w, y: from.y + nodeSize(from).h / 2 } : { x: from.x + nodeSize(from).w / 2, y: from.y })
        : { x: from.x + nodeSize(from).w / 2, y: from.y + nodeSize(from).h };
    })()
    : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ background: settings.background_color || '#ffffff', cursor: pan ? 'grabbing' : tool === 'hand' ? 'grab' : 'default' }}
      onPointerDown={handleBackgroundPointerDown}
      onDoubleClick={(e) => {
        if (e.target !== e.currentTarget) return;
        if (!canEdit) return;
        const world = toWorld(e.clientX, e.clientY);
        onAddAt({ x: Math.round(world.x - 130), y: Math.round(world.y - 59) });
      }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, null); }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: settings.show_grid
            ? 'radial-gradient(circle, rgba(100,116,139,0.35) 1px, transparent 1px)'
            : undefined,
          backgroundSize: `${grid * view.zoom}px ${grid * view.zoom}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      />

      <div
        className="absolute left-0 top-0"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, transformOrigin: '0 0' }}
      >
        <ConnectorLayer
          nodes={displayNodes}
          edges={edges}
          selectedEdgeId={selectedEdgeId}
          canEdit={canEdit}
          onSelectEdge={setSelectedEdgeId}
          onReconnectStart={startReconnect}
          onBendStart={startBend}
        />

        {displayNodes.map(node => (node.node_kind === 'legend' ? (
          <LegendCard
            key={node.id}
            node={node}
            selected={selection.includes(node.id)}
            canEdit={canEdit}
            highlightedColor={highlight?.color}
            onEntryClick={onLegendEntryClick}
            onPointerDown={handleNodePointerDown}
            onDoubleClick={onOpenNode}
            onContextMenu={onContextMenu}
          />
        ) : (
          <NodeCard
            key={node.id}
            node={node}
            settings={settings}
            selected={selection.includes(node.id)}
            multiSelected={selection.length > 1}
            canEdit={canEdit}
            hovered={hoverId === node.id}
            dimmed={!!highlight && !nodeHasColor(node, highlight.color)}
            onPointerDown={handleNodePointerDown}
            onDoubleClick={onOpenNode}
            onPortStart={startConnect}
            onQuickAdd={onQuickAdd}
            onContextMenu={onContextMenu}
            onAction={(action, target) => {
              if (action === 'hover') setHoverId(target.id);
              else if (action === 'hoverOut') setHoverId(null);
              else onAction(action, target);
            }}
          />
        )))}

        {connect && connectStart && (
          <svg className="absolute left-0 top-0" style={{ width: 1, height: 1, overflow: 'visible', pointerEvents: 'none' }}>
            <path
              d={`M ${connectStart.x} ${connectStart.y} L ${connect.to.x} ${connect.to.y}`}
              stroke="#254dd0"
              strokeWidth={2}
              strokeDasharray="6 4"
              fill="none"
            />
          </svg>
        )}

        {canEdit && single && !single.is_locked && singleSize && (
          <ResizeHandles
            x={single.x}
            y={single.y}
            width={singleSize.w}
            height={singleSize.h}
            rotation={Number(single.rotation) || 0}
            zoom={view.zoom}
            handles={single.node_kind === 'shape' ? undefined : ['se']}
            showRotate={single.node_kind === 'shape'}
            onHandleDown={(handle, e) => startResize(single, handle, e)}
            onRotateDown={(e) => startRotate(single, e)}
          />
        )}
      </div>

      {guides.map((guide, i) => (
        <div
          key={`${guide.axis}-${i}-${guide.value}`}
          className="absolute bg-fuchsia-500/70 pointer-events-none"
          style={guide.axis === 'v'
            ? { left: view.x + guide.value * view.zoom, top: 0, bottom: 0, width: 1 }
            : { top: view.y + guide.value * view.zoom, left: 0, right: 0, height: 1 }}
        />
      ))}

      {marquee && (
        <div
          className="absolute border border-blue-500 bg-blue-500/10 pointer-events-none"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
          }}
        />
      )}
    </div>
  );
}