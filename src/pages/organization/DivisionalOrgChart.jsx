import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import OrganizationSubmenuNav from '@/components/common/OrganizationSubmenuNav';
import OrgNodeCard, { DEPT_COLORS, getDeptColor } from '@/components/organization/OrgNodeCard';
import { computeLayout, LAYOUT } from '@/lib/orgChartLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Search, ZoomIn, ZoomOut, Maximize2, RotateCcw, Network, ChevronDown, ChevronUp,
  X, Loader2, Users, User, Mail, Phone, MapPin, Building2, Briefcase, Layers,
} from 'lucide-react';

const COMPANIES = ['GSO QATAR','ITELLIGENT','ANION','SEA QUEEN','LMV E AND I','METAL WORLD','ASMA','FIT','SPRAY CON','EMKAN','ENERTEC','CRYSTAL','MEGATRONICS (GSO)','ENERSERVE (GSO)','ENERTEC (GSO)','NTC (GSO)','MIR (GSO)','SWAN GLOBAL (GSO)','SIGEL (GSO)','AL-RAMSHA (GSO)','ALTHAF (GSO)','ZEAL-IT'];
const STATUSES = ['Active on Site', 'Onboarding', 'Inactive', 'Demobilized'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[p.length - 1]?.[0] || '')).toUpperCase();
}

// Prune a reporting subtree to managers only (nodes with children or is_manager)
function pruneToManagers(node) {
  const kids = (node.children || []).map(pruneToManagers).filter(Boolean);
  if (kids.length > 0 || node.employee.is_manager) return { ...node, children: kids };
  return null;
}

export default function DivisionalOrgChart() {
  const [projectFilter, setProjectFilter] = useState('all');
  const [viewMode, setViewMode] = useState('full');
  const [deptFilter, setDeptFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [collapsedSet, setCollapsedSet] = useState(() => new Set());
  const [selectedId, setSelectedId] = useState(null);
  const [z, setZ] = useState(1);
  const [legendOpen, setLegendOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);

  const viewportRef = useRef(null);
  const pendingScroll = useRef(null);
  const dragRef = useRef(null);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees-active'],
    queryFn: async () => (await base44.entities.Employee.filter({ is_active: { $ne: false } }, { sort: 'name', limit: 100000 })).items,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ['org-projects'],
    queryFn: async () => (await base44.entities.OrganizationProject.filter({}, { sort: '-created_date', limit: 1000 })).items,
  });
  const { data: units = [] } = useQuery({
    queryKey: ['org-units'],
    queryFn: async () => (await base44.entities.OrgUnit.filter({ is_active: { $ne: false } }, { sort: 'level', limit: 5000 })).items,
  });

  const byId = useMemo(() => {
    const m = {};
    for (const e of employees) m[e.id] = e;
    return m;
  }, [employees]);

  const childrenMap = useMemo(() => {
    const m = {};
    for (const e of employees) {
      const p = e.assigned_manager_id;
      if (p && byId[p] && p !== e.id) (m[p] = m[p] || []).push(e);
    }
    return m;
  }, [employees, byId]);

  const filteredEmployees = useMemo(() => {
    let arr = employees;
    if (deptFilter !== 'all') arr = arr.filter((e) => e.department === deptFilter);
    if (companyFilter !== 'all') arr = arr.filter((e) => e.company === companyFilter);
    if (statusFilter !== 'all') arr = arr.filter((e) => e.personnel_status === statusFilter);
    return arr;
  }, [employees, deptFilter, companyFilter, statusFilter]);

  const tree = useMemo(() => {
    const fSet = new Set(filteredEmployees.map((e) => e.id));
    const fById = {};
    for (const e of filteredEmployees) fById[e.id] = e;
    const fChildren = {};
    for (const e of filteredEmployees) {
      const p = e.assigned_manager_id;
      if (p && fById[p] && p !== e.id) (fChildren[p] = fChildren[p] || []).push(e);
    }

    let rootEmployees;
    if (projectFilter !== 'all') {
      const headSet = new Set(units.filter((u) => u.project_id === projectFilter && u.head_of_unit_id).map((u) => u.head_of_unit_id));
      rootEmployees = filteredEmployees.filter((e) => headSet.has(e.id));
    } else {
      rootEmployees = filteredEmployees.filter((e) => !e.assigned_manager_id || !fById[e.assigned_manager_id] || e.assigned_manager_id === e.id);
    }

    const build = (e) => ({ id: e.id, employee: e, children: (fChildren[e.id] || []).map(build) });
    let roots = rootEmployees.map(build);
    if (viewMode === 'management') roots = roots.map(pruneToManagers).filter(Boolean);
    return roots;
  }, [filteredEmployees, projectFilter, units, viewMode]);

  const layout = useMemo(() => computeLayout(tree, collapsedSet), [tree, collapsedSet]);
  const { positions, edges, width, height, nodeWidth, nodeHeight } = layout;

  const presentDepts = useMemo(() => {
    const s = new Set();
    for (const e of filteredEmployees) if (e.department) s.add(e.department);
    return Object.keys(DEPT_COLORS).filter((d) => s.has(d)).concat(
      [...s].filter((d) => !DEPT_COLORS[d])
    );
  }, [filteredEmployees]);

  const nodeCount = positions.size;

  // Highlight set: search matches, else reporting chain of selected
  const highlightSet = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      const s = new Set();
      for (const e of filteredEmployees) {
        if ([e.name, e.position_application, e.designation_org_chart, e.department, e.company]
          .some((v) => (v || '').toLowerCase().includes(q))) s.add(e.id);
      }
      return s;
    }
    if (selectedId) {
      const s = new Set([selectedId]);
      let cur = byId[selectedId]?.assigned_manager_id;
      const guard = new Set();
      while (cur && byId[cur] && !guard.has(cur)) { s.add(cur); guard.add(cur); cur = byId[cur].assigned_manager_id; }
      return s;
    }
    return null;
  }, [search, selectedId, filteredEmployees, byId]);

  // ---- Pan (drag to scroll) ----
  const onPointerDown = (e) => {
    if (e.target.closest('[data-card]')) return;
    const vp = viewportRef.current;
    dragRef.current = { x: e.clientX, y: e.clientY, sx: vp.scrollLeft, sy: vp.scrollTop, moved: false };
    vp.style.cursor = 'grabbing';
  };
  useEffect(() => {
    const move = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const vp = viewportRef.current;
      if (!vp) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
      vp.scrollLeft = d.sx - dx;
      vp.scrollTop = d.sy - dy;
    };
    const up = () => {
      if (dragRef.current) viewportRef.current && (viewportRef.current.style.cursor = 'grab');
      dragRef.current = null;
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  // ---- Zoom & fit ----
  const zoomBy = (factor) => {
    const vp = viewportRef.current; if (!vp) return;
    const vw = vp.clientWidth, vh = vp.clientHeight;
    const cx = vp.scrollLeft + vw / 2, cy = vp.scrollTop + vh / 2;
    const z2 = clamp(z * factor, 0.1, 2.5);
    pendingScroll.current = { x: cx * (z2 / z) - vw / 2, y: cy * (z2 / z) - vh / 2 };
    setZ(z2);
  };

  const fit = useCallback(() => {
    const vp = viewportRef.current; if (!vp || !width) return;
    const vw = vp.clientWidth, vh = vp.clientHeight;
    const z2 = clamp(Math.min(vw / width, vh / height) * 0.92, 0.1, 2);
    pendingScroll.current = { x: (width * z2 - vw) / 2, y: Math.max(0, (height * z2 - vh) / 2 - 24) };
    setZ(z2);
  }, [width, height]);

  const reset = () => {
    pendingScroll.current = { x: (width - viewportRef.current?.clientWidth) / 2, y: 24 };
    setZ(1);
  };

  const centerOn = (id) => {
    const p = positions.get(id); if (!p || !viewportRef.current) return;
    const vp = viewportRef.current;
    pendingScroll.current = { x: p.x * z - vp.clientWidth / 2, y: p.y * z - vp.clientHeight / 2 };
    // trigger scroll apply
    requestAnimationFrame(() => {
      const v = viewportRef.current; if (!v) return;
      v.scrollLeft = pendingScroll.current.x;
      v.scrollTop = pendingScroll.current.y;
      pendingScroll.current = null;
    });
  };

  // Apply pending scroll after z / size changes
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || !pendingScroll.current) return;
    vp.scrollLeft = pendingScroll.current.x;
    vp.scrollTop = pendingScroll.current.y;
    pendingScroll.current = null;
  }, [z, width, height]);

  // Auto-fit when structure (not collapse) changes
  useEffect(() => {
    if (width > 0) fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter, viewMode, deptFilter, companyFilter, statusFilter]);

  const onCardClick = (id) => {
    if (dragRef.current?.moved) return;
    const node = { id, employee: byId[id] };
    const hasChildren = (childrenMap[id] || []).length > 0;
    if (hasChildren) {
      // toggle collapse + open panel
      setCollapsedSet((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    }
    setSelectedId(id);
    setPanelOpen(true);
  };

  const fullscreen = () => {
    const el = viewportRef.current?.parentElement;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  const selected = selectedId ? byId[selectedId] : null;
  const selectedReports = selectedId ? (childrenMap[selectedId] || []) : [];

  return (
    <div className="space-y-4">
      <OrganizationSubmenuNav />

      {/* Centered chart header */}
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-700">GSO Qatar — Divisional Organizational Chart</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Organization Management Module · Rev. 1.0 · Effective {new Date().toLocaleDateString('en-GB')}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[200px] h-9"><span className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /><SelectValue /></span></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Personnel</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={viewMode} onValueChange={setViewMode}>
          <SelectTrigger className="w-[180px] h-9"><span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /><SelectValue /></span></SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Full Divisional Chart</SelectItem>
            <SelectItem value="management">Management Only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="All divisions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Divisions</SelectItem>
            {Object.keys(DEPT_COLORS).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="All companies" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {COMPANIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search name, position, division, company…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-9" />
        </div>
      </div>

      {/* Chart canvas + overlays */}
      <div className="relative">
        <div
          ref={viewportRef}
          onMouseDown={onPointerDown}
          className="relative overflow-auto h-[68vh] min-h-[480px] bg-[#F7FAFC] rounded-xl ring-1 ring-slate-200 select-none"
          style={{ cursor: 'grab' }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-slate-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading organization…</div>
          ) : nodeCount === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-1">
              <Network className="w-8 h-8" />
              <p className="text-sm">No personnel match the current filters.</p>
            </div>
          ) : (
            <div style={{ width: Math.max(width * z, 1), height: Math.max(height * z, 1) }} className="relative">
              <div style={{ width, height, transform: `scale(${z})`, transformOrigin: '0 0', position: 'absolute', top: 24, left: 0 }}>
                {/* Connectors */}
                <svg width={width} height={height} className="absolute top-0 left-0 pointer-events-none">
                  {edges.map((ed, i) => {
                    const a = positions.get(ed.from), b = positions.get(ed.to);
                    if (!a || !b) return null;
                    const midY = a.y + nodeHeight + (b.y - a.y - nodeHeight) / 2;
                    const onChain = highlightSet && highlightSet.has(ed.from) && highlightSet.has(ed.to);
                    const dim = highlightSet && !onChain;
                    return (
                      <path
                        key={i}
                        d={`M ${a.x} ${a.y + nodeHeight} L ${a.x} ${midY} L ${b.x} ${midY} L ${b.x} ${b.y}`}
                        fill="none"
                        stroke={onChain ? '#2D3748' : '#A0AEC0'}
                        strokeWidth={onChain ? 2 : 1.3}
                        opacity={dim ? 0.25 : 1}
                      />
                    );
                  })}
                </svg>
                {/* Cards */}
                {[...positions.entries()].map(([id, pos]) => {
                  const emp = byId[id] || { name: id };
                  const hasChildren = pos.childCount > 0;
                  const isMatch = highlightSet ? highlightSet.has(id) : false;
                  return (
                    <div key={id} data-card>
                      <OrgNodeCard
                        employee={emp}
                        pos={pos}
                        nodeWidth={nodeWidth}
                        nodeHeight={nodeHeight}
                        selected={selectedId === id && !search}
                        highlighted={isMatch}
                        dimmed={highlightSet && !isMatch}
                        hasChildren={hasChildren}
                        onClick={() => onCardClick(id)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        {!isLoading && nodeCount > 0 && (
          <div className="absolute top-3 right-3 z-20 bg-white rounded-lg ring-1 ring-slate-200 shadow-sm w-52">
            <button onClick={() => setLegendOpen((v) => !v)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600">
              <span>Divisions</span>
              {legendOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {legendOpen && (
              <div className="px-3 pb-3 space-y-1.5">
                {presentDepts.map((d) => (
                  <div key={d} className="flex items-center gap-2 text-xs">
                    <span className="inline-block w-4 h-4 rounded border-2" style={{ borderColor: getDeptColor(d), background: `${getDeptColor(d)}11` }} />
                    <span className="text-slate-600">{d}</span>
                    <span className="ml-auto text-[10px] text-slate-400">
                      {filteredEmployees.filter((e) => e.department === d).length}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Zoom controls */}
        {!isLoading && nodeCount > 0 && (
          <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1 bg-white rounded-lg ring-1 ring-slate-200 shadow-sm p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomBy(1.2)} title="Zoom in"><ZoomIn className="w-4 h-4" /></Button>
            <span className="text-[11px] text-slate-500 w-10 text-center">{Math.round(z * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomBy(1 / 1.2)} title="Zoom out"><ZoomOut className="w-4 h-4" /></Button>
            <div className="w-px h-5 bg-slate-200 mx-0.5" />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fit} title="Fit to screen"><Maximize2 className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={reset} title="Reset view"><RotateCcw className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fullscreen} title="Full screen"><Maximize2 className="w-4 h-4" /></Button>
          </div>
        )}

        {/* Node count */}
        {!isLoading && nodeCount > 0 && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-white rounded-lg ring-1 ring-slate-200 shadow-sm px-3 py-1.5 text-xs text-slate-500">
            <Users className="w-3.5 h-3.5" /> {nodeCount} nodes
          </div>
        )}

        {/* Employee side panel */}
        {panelOpen && selected && (
          <div className="absolute top-3 right-[14rem] bottom-3 z-30 w-72 bg-white rounded-xl ring-1 ring-slate-200 shadow-lg overflow-y-auto">
            <div className="flex items-center justify-between p-3 border-b">
              <p className="text-sm font-semibold text-slate-700">Employee Details</p>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setPanelOpen(false); setSelectedId(null); }}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-4 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-white shadow flex items-center justify-center" style={{ boxShadow: `0 0 0 2px ${getDeptColor(selected.department)}` }}>
                {selected.photo_url ? <img src={selected.photo_url} alt={selected.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl font-bold text-white" style={{ backgroundColor: getDeptColor(selected.department) }}>{initials(selected.name)}</div>}
              </div>
              <p className="text-base font-bold text-slate-800 mt-2">{selected.name}</p>
              <p className="text-xs text-slate-500">{selected.designation_org_chart || selected.position_application || '—'}</p>
              <Badge className="mt-2" variant="secondary" style={{ color: getDeptColor(selected.department) }}>{selected.department || 'Unassigned'}</Badge>
            </div>
            <div className="px-4 pb-4 space-y-2 text-xs">
              <Row icon={Building2} label="Company" value={selected.company} />
              <Row icon={Briefcase} label="Position" value={selected.position_application} />
              <Row icon={User} label="Manager" value={selected.assigned_manager_name || (selected.assigned_manager_id ? byId[selected.assigned_manager_id]?.name : '—')} />
              <Row icon={Layers} label="Status" value={selected.personnel_status} />
              {selected.contact_details && <Row icon={Phone} label="Contact" value={selected.contact_details} />}
              {selected.current_location && <Row icon={MapPin} label="Location" value={selected.current_location} />}
            </div>
            {selectedReports.length > 0 && (
              <div className="px-4 pb-4">
                <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Direct Reports ({selectedReports.length})</p>
                <div className="space-y-1">
                  {selectedReports.map((r) => (
                    <button key={r.id} onClick={() => { setSelectedId(r.id); centerOn(r.id); }} className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 text-left">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: getDeptColor(r.department) }} />
                      <span className="text-xs font-medium truncate">{r.name}</span>
                      <span className="text-[10px] text-slate-400 ml-auto truncate">{r.designation_org_chart || r.position_application || ''}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        Click a card to view details and collapse/expand its branch · Drag the canvas to pan · Use zoom controls or fit-to-screen.
      </p>
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400">{label}</p>
        <p className="text-xs text-slate-700 break-words">{value || '—'}</p>
      </div>
    </div>
  );
}