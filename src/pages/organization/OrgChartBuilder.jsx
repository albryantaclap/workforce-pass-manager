import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import useOrgChartEditor from '@/hooks/useOrgChartEditor';
import ChartCanvas from '@/components/orgchart/ChartCanvas';
import LeftSidebar from '@/components/orgchart/LeftSidebar';
import TopToolbar from '@/components/orgchart/TopToolbar';
import BottomToolbar from '@/components/orgchart/BottomToolbar';
import ZoomBar from '@/components/orgchart/ZoomBar';
import AlignBar from '@/components/orgchart/AlignBar';
import ConnectorBar from '@/components/orgchart/ConnectorBar';
import ContextMenu from '@/components/orgchart/ContextMenu';
import NodeDialog from '@/components/orgchart/NodeDialog';
import ShareDialog from '@/components/orgchart/ShareDialog';
import VersionsDialog from '@/components/orgchart/VersionsDialog';
import ExportDialog from '@/components/orgchart/ExportDialog';
import AutoLayoutDialog from '@/components/orgchart/AutoLayoutDialog';
import HelpDialog from '@/components/orgchart/HelpDialog';
import { Button } from '@/components/ui/button';
import { Loader2, X, Network } from 'lucide-react';
import { alignNodes, autoLayout, distributeNodes, nodeBounds, nodeSize } from '@/lib/orgChartLayout';
import { EDGE_PERSIST_FIELDS, NODE_PERSIST_FIELDS, defaultNode, uid } from '@/lib/orgChartConstants';
import {
  captureElement, downloadBlob, exportExcel, exportImage, exportJson, exportPdf, exportSvgFile, safeName,
} from '@/lib/orgChartExport';

const pick = (obj, fields) => fields.reduce((acc, k) => { if (obj && obj[k] !== undefined) acc[k] = obj[k]; return acc; }, {});
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const TEMPLATE_NODE_FIELDS = [
  'node_kind', 'shape', 'x', 'y', 'width', 'height', 'rotation', 'z_index', 'display_style', 'density',
  'name', 'designation', 'department', 'company', 'project_name', 'employee_code', 'pid', 'email', 'phone',
  'photo_url', 'text_content', 'footer_text', 'remarks', 'extra_fields', 'accent_color', 'background_color',
  'border_color', 'text_color', 'border_width', 'corner_radius', 'font_size', 'font_weight', 'avatar_size',
  'shadow', 'padding', 'align',
];

export default function OrgChartBuilder() {
  const navigate = useNavigate();
  const chartId = useMemo(() => new URLSearchParams(window.location.search).get('chart'), []);
  const editor = useOrgChartEditor(chartId);
  const { chart, nodes, edges, canEdit, myRole, viewSettings } = editor;

  const containerRef = useRef(null);
  const initializedRef = useRef(false);
  const [view, setView] = useState({ x: 80, y: 80, zoom: 1 });
  const [tool, setTool] = useState('select');
  const [sidebar, setSidebar] = useState('data');
  const [menu, setMenu] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState('');
  const [exportError, setExportError] = useState('');
  const [showMinimap, setShowMinimap] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectCharts, setProjectCharts] = useState([]);
  const [customTemplates, setCustomTemplates] = useState([]);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // ------------------------------------------------------------- sizing & view
  const fitBounds = useCallback((list, padding = 90) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || !list.length) return;
    const bounds = nodeBounds(list);
    const zoom = Math.min(1.5, Math.max(0.2, Math.min((rect.width - padding * 2) / bounds.w, (rect.height - padding * 2) / bounds.h)));
    setView({
      zoom,
      x: rect.width / 2 - (bounds.x + bounds.w / 2) * zoom,
      y: rect.height / 2 - (bounds.y + bounds.h / 2) * zoom,
    });
  }, []);

  const fitToScreen = useCallback((silent) => {
    const visibleNodes = nodes.filter(n => n.is_visible !== false);
    if (!visibleNodes.length) {
      if (!silent) setNotice('Add a card first, then fit to screen.');
      return;
    }
    fitBounds(visibleNodes, 90);
  }, [nodes, fitBounds]);

  useEffect(() => {
    if (!chart?.id || initializedRef.current) return;
    initializedRef.current = true;
    const settings = chart.view_settings || {};
    setView({ x: settings.pan_x ?? 80, y: settings.pan_y ?? 80, zoom: settings.zoom ?? 1 });
    setTimeout(() => fitToScreen(true), 80);
  }, [chart?.id, chart?.view_settings, fitToScreen]);

  useEffect(() => {
    base44.entities.OrganizationProject.filter({}, { sort: 'project_name', limit: 500 })
      .then(res => setProjects(res.items || []))
      .catch(() => setProjects([]));
    base44.entities.OrgChartTemplate.filter({}, { sort: '-created_date', limit: 200 })
      .then(res => setCustomTemplates(res.items || []))
      .catch(() => setCustomTemplates([]));
  }, []);

  useEffect(() => {
    if (!chart) return;
    base44.entities.OrgChart.filter(
      chart.project_id ? { project_id: chart.project_id } : {},
      { sort: '-updated_date', limit: 200 }
    )
      .then(res => setProjectCharts(res.items || []))
      .catch(() => setProjectCharts([]));
  }, [chart?.project_id, chart?.id]);

  const viewportCenter = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 240, y: 200 };
    return {
      x: Math.round((rect.width / 2 - view.x) / view.zoom - 130),
      y: Math.round((rect.height / 2 - view.y) / view.zoom - 59),
    };
  }, [view]);

  const zoomBy = useCallback((factor) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setView(prev => {
      const zoom = Math.min(2.5, Math.max(0.2, prev.zoom * factor));
      const px = rect.width / 2;
      const py = rect.height / 2;
      return { zoom, x: px - (px - prev.x) * (zoom / prev.zoom), y: py - (py - prev.y) * (zoom / prev.zoom) };
    });
  }, []);

  const centerOn = useCallback((worldX, worldY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setView(prev => ({ ...prev, x: rect.width / 2 - worldX * prev.zoom, y: rect.height / 2 - worldY * prev.zoom }));
  }, []);

  const focusNode = useCallback((id) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    const size = nodeSize(node);
    centerOn(node.x + size.w / 2, node.y + size.h / 2);
    editor.setSelection([id]);
  }, [nodes, centerOn, editor]);

  const saveWithView = useCallback(() => {
    editor.saveNow({
      view_settings: {
        ...viewSettings,
        zoom: Number(view.zoom.toFixed(3)),
        pan_x: Math.round(view.x),
        pan_y: Math.round(view.y),
      },
    });
    setNotice('Chart saved.');
  }, [editor, view, viewSettings]);

  // ------------------------------------------------------------------- editing
  const addCard = useCallback(async (kind, extra = {}) => {
    if (!canEdit) return null;
    const center = viewportCenter();
    return editor.addNode({ ...defaultNode(kind, center.x, center.y), ...extra });
  }, [canEdit, editor, viewportCenter]);

  const addEmployeeCard = useCallback(async (employee) => {
    const center = viewportCenter();
    return editor.addNode({
      ...defaultNode('employee', center.x, center.y),
      name: employee.name || '',
      designation: employee.designation_org_chart || employee.position_application || '',
      department: employee.department || '',
      company: employee.company || '',
      pid: employee.pid || '',
      qid: employee.qid_no || '',
      employee_code: employee.staff_no || '',
      email: employee.email || '',
      phone: employee.contact_details || '',
      photo_url: employee.photo_url || '',
      employment_status: employee.personnel_status || '',
      linked_employee_id: employee.id,
      link_source: 'master_list',
    });
  }, [editor, viewportCenter]);

  const handleQuickAdd = useCallback(async (node) => {
    const size = nodeSize(node);
    const created = await editor.addNode(
      { ...defaultNode(node.node_kind === 'position' ? 'position' : 'employee', node.x, node.y + size.h + 90) },
      { silent: true }
    );
    if (created) await editor.addEdge(node.id, created.id, { source_port: 'bottom', target_port: 'top' });
    editor.setSelection([created.id]);
  }, [editor]);

  const handleAction = useCallback(async (action, node) => {
    switch (action) {
      case 'edit':
        setDialog({ type: 'node', mode: 'edit', node });
        break;
      case 'duplicate':
        await editor.duplicateNodes([node.id]);
        break;
      case 'delete':
        editor.removeNodes([node.id]);
        break;
      case 'subordinate':
        await handleQuickAdd(node);
        break;
      case 'manager': {
        const size = nodeSize(node);
        const created = await editor.addNode(
          { ...defaultNode('employee', node.x, node.y - size.h - 90) },
          { silent: true }
        );
        if (created) await editor.addEdge(created.id, node.id, { source_port: 'bottom', target_port: 'top' });
        editor.setSelection([created.id]);
        break;
      }
      case 'sibling': {
        const parentEdge = edges.find(e => e.target_id === node.id);
        const size = nodeSize(node);
        const created = await editor.addNode(
          { ...defaultNode('employee', node.x + size.w + 60, node.y) },
          { silent: true }
        );
        if (created) {
          if (parentEdge) await editor.addEdge(parentEdge.source_id, created.id, { relationship_type: parentEdge.relationship_type });
          editor.setSelection([created.id]);
        }
        break;
      }
      case 'connect':
        editor.setSelection([node.id]);
        setTool('connector');
        setNotice('Now click the card this person reports to.');
        break;
      case 'style':
        editor.setSelection([node.id]);
        setSidebar('styles');
        break;
      case 'lock':
        editor.updateNodes([{ id: node.id, is_locked: !node.is_locked }]);
        break;
      case 'group':
        editor.updateNodes([{ id: node.id, group_id: node.group_id || uid() }]);
        break;
      default:
        break;
    }
  }, [editor, edges, handleQuickAdd]);

  const handleAlign = (mode) => editor.updateNodes(alignNodes(nodes, editor.selection, mode));
  const handleDistribute = (axis) => editor.updateNodes(distributeNodes(nodes, editor.selection, axis));

  const handleOrder = (mode) => {
    const selected = nodes.filter(n => editor.selection.includes(n.id));
    if (!selected.length) return;
    const zs = nodes.map(n => n.z_index || 1);
    if (mode === 'front') {
      editor.updateNodes(selected.map(n => ({ id: n.id, z_index: Math.max(...zs) + 1 })));
      return;
    }
    if (mode === 'back') {
      editor.updateNodes(selected.map(n => ({ id: n.id, z_index: Math.max(0, Math.min(...zs) - 1) })));
      return;
    }
    editor.updateNodes(selected.map(n => ({ id: n.id, z_index: Math.max(0, (n.z_index || 1) + (mode === 'forward' ? 1 : -1)) })));
  };

  const handleGroup = (group) => {
    if (!editor.selection.length) return;
    if (group && editor.selection.length < 2) {
      setNotice('Select two or more cards to group them.');
      return;
    }
    const groupId = group ? uid() : '';
    editor.updateNodes(editor.selection.map(id => ({ id, group_id: groupId })));
  };

  const handleLock = () => {
    const selected = nodes.filter(n => editor.selection.includes(n.id));
    if (!selected.length) return;
    const anyLocked = selected.some(n => n.is_locked);
    editor.updateNodes(selected.map(n => ({ id: n.id, is_locked: !anyLocked })));
  };

  const submitNode = useCallback(async (form) => {
    if (dialog?.mode === 'edit' && dialog.node?.id) {
      editor.updateNodes([{ id: dialog.node.id, ...pick(form, NODE_PERSIST_FIELDS) }]);
      return;
    }
    await editor.addNode(pick(form, NODE_PERSIST_FIELDS));
  }, [dialog, editor]);

  const applyAutoLayout = (mode) => {
    editor.pushHistory();
    editor.updateNodes(autoLayout(mode, nodes, edges));
    setTimeout(() => fitToScreen(true), 120);
  };

  const applyOfficial = useCallback(async (edge) => {
    const source = nodes.find(n => n.id === edge.source_id);
    const target = nodes.find(n => n.id === edge.target_id);
    if (!source?.linked_employee_id || !target?.linked_employee_id) {
      setNotice('Both cards must be linked to Master List personnel before a reporting line can be applied.');
      return;
    }
    if (!window.confirm(`Set ${source.name}'s reporting manager to ${target.name} on the Master List?`)) return;
    let cursor = target.linked_employee_id;
    const seen = new Set();
    let circular = false;
    while (cursor && !circular) {
      if (cursor === source.linked_employee_id) { circular = true; break; }
      if (seen.has(cursor)) break;
      seen.add(cursor);
      const record = await base44.entities.Employee.get(cursor).catch(() => null);
      cursor = record?.assigned_manager_id;
    }
    if (circular) {
      setNotice('That would create a circular reporting hierarchy, so it was not applied.');
      return;
    }
    await base44.entities.Employee.update(source.linked_employee_id, {
      assigned_manager_id: target.linked_employee_id,
      assigned_manager_name: target.name || '',
    });
    editor.updateEdge(edge.id, {
      is_official: true,
      official_applied_at: new Date().toISOString(),
      official_applied_by: editor.me?.email,
    });
    setNotice(`${source.name} now reports to ${target.name} in the Master List.`);
  }, [nodes, editor]);

  const publish = useCallback(async () => {
    if (!chart) return;
    const revision = chart.revision_no || 1;
    if (!window.confirm(`Publish revision ${revision}? A version of the current layout is saved first.`)) return;
    await editor.createVersion(`Published revision ${revision}`, 'Saved automatically when the chart was published.');
    const fields = { status: 'published', published_at: new Date().toISOString(), revision_no: revision + 1 };
    editor.updateChart(fields, false);
    await editor.saveNow(fields);
    setNotice(`Published as revision ${revision}.`);
  }, [chart, editor]);

  // ----------------------------------------------------------------- templates
  const applyTemplate = useCallback(async (template) => {
    if (!canEdit) return;
    if (!template?.nodes?.length) {
      setSidebar('insert');
      setNotice('Blank canvas — add your first card from Shapes & Cards.');
      return;
    }
    if (nodes.length && !window.confirm(`Add the cards from “${template.name}” to this chart?`)) return;
    editor.pushHistory();
    const idMap = new Map();
    for (const item of template.nodes) {
      const { key, ...data } = item;
      const created = await editor.addNode(
        { ...defaultNode(data.node_kind || 'position', data.x || 0, data.y || 0), ...data },
        { skipHistory: true, silent: true }
      );
      if (created) idMap.set(key || item.key, created.id);
    }
    for (const link of template.edges || []) {
      const source = idMap.get(link.source);
      const target = idMap.get(link.target);
      if (source && target) {
        await editor.addEdge(source, target, { relationship_type: link.relationship_type || 'Direct Reporting' }, { skipHistory: true });
      }
    }
    editor.setSelection([]);
    setNotice(`Added ${template.nodes.length} cards from ${template.name}.`);
    setTimeout(() => fitToScreen(true), 150);
  }, [canEdit, editor, nodes.length, fitToScreen]);

  const saveAsTemplate = useCallback(async () => {
    const name = window.prompt('Template name', chart?.name ? `${chart.name} template` : 'My template');
    if (!name) return;
    const created = await base44.entities.OrgChartTemplate.create({
      name,
      category: 'Custom',
      description: `${nodes.length} cards from ${chart?.name || 'chart'}`,
      nodes: nodes.map(n => ({ key: n.id, ...pick(n, TEMPLATE_NODE_FIELDS) })),
      edges: edges.map(e => ({
        source: e.source_id,
        target: e.target_id,
        relationship_type: e.relationship_type,
        path_style: e.path_style,
        line_style: e.line_style,
        arrow: e.arrow,
        label: e.label,
      })),
      is_shared: false,
      created_by_email: editor.me?.email,
      created_by_name: editor.me?.full_name,
    });
    setCustomTemplates(prev => [created, ...prev]);
    setNotice('Template saved.');
  }, [chart, nodes, edges, editor.me]);

  const duplicateTemplate = async (template) => {
    const created = await base44.entities.OrgChartTemplate.create({
      name: `${template.name} copy`,
      category: template.category,
      description: template.description,
      nodes: template.nodes || [],
      edges: template.edges || [],
      is_shared: false,
      is_system: false,
      created_by_email: editor.me?.email,
      created_by_name: editor.me?.full_name,
    });
    setCustomTemplates(prev => [created, ...prev]);
  };

  const deleteTemplate = async (template) => {
    if (!window.confirm(`Delete the template “${template.name}”?`)) return;
    await base44.entities.OrgChartTemplate.delete(template.id);
    setCustomTemplates(prev => prev.filter(t => t.id !== template.id));
  };

  const exportTemplateJson = (template) => {
    downloadBlob(
      new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' }),
      `${safeName(template.name)}-template.json`
    );
  };

  const importTemplateJson = async (file) => {
    try {
      const parsed = JSON.parse(await file.text());
      const created = await base44.entities.OrgChartTemplate.create({
        name: parsed.name || 'Imported template',
        category: parsed.category || 'Imported',
        description: parsed.description || '',
        nodes: parsed.nodes || [],
        edges: parsed.edges || [],
        is_shared: false,
        created_by_email: editor.me?.email,
        created_by_name: editor.me?.full_name,
      });
      setCustomTemplates(prev => [created, ...prev]);
      setNotice('Template imported.');
    } catch (err) {
      setNotice('That file could not be read as an org chart template.');
    }
  };

  const exportChartJson = () => exportJson(chart, nodes, edges, safeName(chart?.name));

  // --------------------------------------------------------------- chart admin
  const openChart = (item) => navigate(`/organization/chart-builder?chart=${item.id}`);
  const newChart = () => navigate('/organization/charts');

  const renameChart = async (item) => {
    const name = window.prompt('Chart name', item.name);
    if (!name) return;
    await base44.entities.OrgChart.update(item.id, { name });
    setProjectCharts(prev => prev.map(c => (c.id === item.id ? { ...c, name } : c)));
    if (item.id === chart?.id) editor.updateChart({ name }, false);
  };

  const duplicateChart = async (item) => {
    const name = window.prompt('Name for the duplicated chart', `${item.name} copy`);
    if (!name) return;
    const copy = await base44.entities.OrgChart.create({
      ...pick(item, ['project_id', 'project_name', 'description', 'template_key', 'owner_email', 'owner_name', 'shares', 'view_settings', 'card_presets', 'revision_no', 'effective_date', 'prepared_by', 'approved_by', 'legend_notes']),
      name,
      status: 'draft',
      is_archived: false,
    });
    const sourceNodes = (await base44.entities.OrgChartNode.filter({ chart_id: item.id, is_deleted: { $ne: true } }, { limit: 2000 })).items || [];
    const sourceEdges = (await base44.entities.OrgChartEdge.filter({ chart_id: item.id, is_deleted: { $ne: true } }, { limit: 4000 })).items || [];
    const createdNodes = sourceNodes.length
      ? await base44.entities.OrgChartNode.bulkCreate(sourceNodes.map(n => ({ ...pick(n, NODE_PERSIST_FIELDS), chart_id: copy.id })))
      : [];
    const idMap = new Map(sourceNodes.map((n, index) => [n.id, createdNodes[index]?.id]));
    const edgeRecords = sourceEdges
      .map(e => ({ ...pick(e, EDGE_PERSIST_FIELDS), chart_id: copy.id, source_id: idMap.get(e.source_id), target_id: idMap.get(e.target_id) }))
      .filter(e => e.source_id && e.target_id);
    if (edgeRecords.length) await base44.entities.OrgChartEdge.bulkCreate(edgeRecords);
    setProjectCharts(prev => [copy, ...prev]);
    navigate(`/organization/chart-builder?chart=${copy.id}`);
  };

  const archiveChart = async (item, archived) => {
    await base44.entities.OrgChart.update(item.id, { is_archived: archived });
    setProjectCharts(prev => prev.map(c => (c.id === item.id ? { ...c, is_archived: archived } : c)));
  };

  const deleteChart = async (item) => {
    if (!window.confirm(`Delete the chart “${item.name}”? Archiving keeps it available if you need it later.`)) return;
    await base44.entities.OrgChart.delete(item.id);
    setProjectCharts(prev => prev.filter(c => c.id !== item.id));
    if (item.id === chart?.id) navigate('/organization/charts');
  };

  const onProjectChange = async (projectId) => {
    const project = projects.find(p => p.id === projectId);
    const fields = { project_id: projectId, project_name: project?.project_name || '' };
    editor.updateChart(fields, false);
    await editor.saveNow(fields);
  };

  const updateChartField = async (key, value) => {
    editor.updateChart({ [key]: value }, false);
    await editor.saveNow({ [key]: value });
  };

  const loadVersions = async () => {
    if (!chartId) return;
    setVersionsLoading(true);
    try {
      const res = await base44.entities.OrgChartVersion.filter({ chart_id: chartId }, { sort: '-version_no', limit: 200 });
      setVersions(res.items || []);
    } finally {
      setVersionsLoading(false);
    }
  };

  // -------------------------------------------------------------------- export
  const handleExport = useCallback(async (options) => {
    setExportError('');
    const filename = safeName(chart?.name);
    try {
      if (options.format === 'JSON') { exportJson(chart, nodes, edges, filename); return; }
      if (options.format === 'Excel') { await exportExcel(nodes, chart, `${filename}-personnel`); return; }
      if (options.format === 'SVG') {
        exportSvgFile(nodes, edges, {
          background: viewSettings.background_color,
          transparent: options.transparent,
          filename,
          title: chart?.name,
        });
        return;
      }
      const previousView = view;
      const previousSelection = editor.selection;
      const target = options.area === 'selection'
        ? nodes.filter(n => editor.selection.includes(n.id))
        : nodes.filter(n => n.is_visible !== false);
      editor.setSelection([]);
      if (options.area !== 'visible') fitBounds(target, 70);
      await sleep(options.area === 'visible' ? 60 : 280);
      const canvas = await captureElement(containerRef.current, {
        scale: options.resolution || 2,
        transparent: options.transparent,
        background: viewSettings.background_color || '#ffffff',
      });
      if (options.format === 'PDF') {
        await exportPdf(canvas, {
          pageSize: options.pageSize,
          orientation: options.orientation,
          fitToPage: options.fitToPage,
          multiPage: options.multiPage,
          header: options.header,
          filename,
        });
      } else {
        await exportImage(canvas, { format: options.format, transparent: options.transparent, filename });
      }
      setView(previousView);
      editor.setSelection(previousSelection);
    } catch (err) {
      setExportError(err.message || 'The export could not be produced.');
      setNotice(err.message || 'The export could not be produced.');
    }
  }, [chart, nodes, edges, view, viewSettings, editor, fitBounds]);

  // ---------------------------------------------------------------- shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z' && !e.shiftKey) { e.preventDefault(); editor.undo(); return; }
      if ((mod && key === 'y') || (mod && e.shiftKey && key === 'z')) { e.preventDefault(); editor.redo(); return; }
      if (mod && key === 'c') { editor.copyNodes(editor.selection); return; }
      if (mod && key === 'v') { e.preventDefault(); editor.pasteNodes(); return; }
      if (mod && key === 'd') { e.preventDefault(); editor.duplicateNodes(editor.selection); return; }
      if (mod && key === 's') { e.preventDefault(); saveWithView(); return; }
      if (mod && key === 'a') { e.preventDefault(); editor.setSelection(nodes.map(n => n.id)); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editor.selectedEdgeId) editor.removeEdges([editor.selectedEdgeId]);
        else if (editor.selection.length) editor.removeNodes(editor.selection);
        return;
      }
      if (e.key === 'Escape') { editor.setSelection([]); editor.setSelectedEdgeId(null); setMenu(null); return; }
      if (key === 'v') { setTool('select'); return; }
      if (key === 'h') { setTool('hand'); return; }
      if (e.key.startsWith('Arrow') && editor.selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? (viewSettings.grid_size || 20) : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        editor.updateNodes(editor.selection
          .map(id => {
            const node = nodes.find(n => n.id === id);
            return node ? { id, x: node.x + dx, y: node.y + dy } : null;
          })
          .filter(Boolean));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor, nodes, saveWithView, viewSettings]);

  // ------------------------------------------------------------- context menu
  const openContextMenu = useCallback((e, nodeId) => {
    e.preventDefault();
    const target = nodeId ? nodes.find(n => n.id === nodeId) : null;
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: target ? [
        { label: 'Edit card', onClick: () => handleAction('edit', target) },
        { label: 'Duplicate', onClick: () => editor.duplicateNodes([target.id]) },
        { label: 'Add subordinate', onClick: () => handleQuickAdd(target) },
        { separator: true },
        { label: 'Connect to another card', onClick: () => handleAction('connect', target) },
        { label: 'Copy', onClick: () => editor.copyNodes([target.id]) },
        { label: target.is_locked ? 'Unlock card' : 'Lock card', onClick: () => handleAction('lock', target) },
        { separator: true },
        { label: 'Delete card', danger: true, onClick: () => editor.removeNodes([target.id]) },
      ] : [
        { label: 'Add employee card', disabled: !canEdit, onClick: () => addCard('employee') },
        { label: 'Add position card', disabled: !canEdit, onClick: () => addCard('position') },
        { label: 'Add shape', disabled: !canEdit, onClick: () => addCard('shape') },
        { label: 'Add text', disabled: !canEdit, onClick: () => addCard('text') },
        { label: 'Add note', disabled: !canEdit, onClick: () => addCard('note') },
        { separator: true },
        { label: 'Paste', disabled: !canEdit, onClick: () => editor.pasteNodes() },
        { label: 'Select all', onClick: () => editor.setSelection(nodes.map(n => n.id)) },
        { separator: true },
        { label: 'Auto layout…', disabled: !canEdit || !nodes.length, onClick: () => setDialog({ type: 'autoLayout' }) },
        { label: 'Fit to screen', onClick: () => fitToScreen() },
        { label: 'Zoom to 100%', onClick: () => setView(prev => ({ ...prev, zoom: 1 })) },
        { separator: true },
        { label: 'Undo', disabled: !editor.canUndo, onClick: editor.undo },
        { label: 'Redo', disabled: !editor.canRedo, onClick: editor.redo },
      ],
    });
  }, [nodes, editor, addCard, canEdit, fitToScreen, handleAction, handleQuickAdd]);

  const ctx = {
    chart, nodes, edges, settings: viewSettings, selection: editor.selection, selectedEdgeId: editor.selectedEdgeId,
    canEdit, projects, projectCharts, customTemplates,
    updateNodes: editor.updateNodes, removeNodes: editor.removeNodes, setSelection: editor.setSelection,
    setSelectedEdgeId: editor.setSelectedEdgeId, updateViewSettings: editor.updateViewSettings,
    setCardPresets: editor.setCardPresets, addCard, addEmployeeCard, focusNode, onProjectChange,
    applyTemplate, saveAsTemplate, duplicateTemplate, deleteTemplate, exportTemplateJson, importTemplateJson,
    exportChartJson, updateChartField, openChart, newChart, renameChart, duplicateChart, archiveChart, deleteChart,
    applyDisplayToSelection: () => editor.updateNodes(editor.selection.map(id => ({
      id, display_style: viewSettings.card_style, density: viewSettings.density,
    }))),
    applyPresetToChart: (preset) => {
      editor.updateViewSettings({ accent_color: preset.style?.accent_color || viewSettings.accent_color });
      editor.setCardPresets([...(chart?.card_presets || []), preset]);
    },
  };

  if (!chartId || editor.missing) {
    return (
      <div className="h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <Network className="w-10 h-10 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold">No chart selected</h1>
          <p className="text-sm text-muted-foreground">
            Open the visual chart builder from Organization Management to pick a project and chart, or start a new one.
          </p>
          <Button asChild><Link to="/organization/charts">Go to Organization Charts</Link></Button>
        </div>
      </div>
    );
  }

  if (editor.loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedEdge = edges.find(e => e.id === editor.selectedEdgeId) || null;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <TopToolbar
        chart={chart}
        projects={projects}
        saveState={editor.saveState}
        lastSavedAt={editor.lastSavedAt}
        canEdit={canEdit}
        myRole={myRole}
        onRename={(name) => { editor.updateChart({ name }, false); editor.saveNow({ name }); }}
        onProjectChange={onProjectChange}
        onSave={saveWithView}
        onExport={() => { setExportError(''); setDialog({ type: 'export' }); }}
        onShare={() => setDialog({ type: 'share' })}
        onVersions={() => { setDialog({ type: 'versions' }); loadVersions(); }}
        onPublish={publish}
      />

      <div className="flex flex-1 min-h-0">
        <LeftSidebar active={sidebar} onChange={setSidebar} ctx={ctx} />

        <div className="relative flex-1 min-h-0 overflow-hidden">
          <ChartCanvas
            containerRef={containerRef}
            nodes={nodes}
            edges={edges}
            view={view}
            setView={setView}
            settings={viewSettings}
            tool={tool}
            canEdit={canEdit}
            selection={editor.selection}
            setSelection={editor.setSelection}
            selectedEdgeId={editor.selectedEdgeId}
            setSelectedEdgeId={(id) => { editor.setSelectedEdgeId(id); if (id) editor.setSelection([]); }}
            onUpdateNodes={editor.updateNodes}
            onUpdateEdge={editor.updateEdge}
            onCreateEdge={editor.addEdge}
            onReconnectEdge={(edgeId, end, nodeId) => editor.updateEdge(edgeId, end === 'source' ? { source_id: nodeId } : { target_id: nodeId })}
            onAddAt={(position) => setDialog({ type: 'node', mode: 'create', position })}
            onOpenNode={(node) => setDialog({ type: 'node', mode: 'edit', node })}
            onContextMenu={openContextMenu}
            onQuickAdd={handleQuickAdd}
            onAction={handleAction}
          />

          {notice && (
            <div className="absolute top-3 left-3 z-40 max-w-sm rounded-lg border bg-card px-3 py-2 shadow-lg flex items-start gap-2">
              <p className="text-[11px] flex-1">{notice}</p>
              <button type="button" onClick={() => setNotice('')}><X className="w-3 h-3" /></button>
            </div>
          )}

          {!canEdit && (
            <div className="absolute top-3 right-3 z-40 rounded-lg border bg-card px-3 py-1.5 text-[11px] text-muted-foreground shadow">
              Read-only ({myRole})
            </div>
          )}

          <AlignBar
            selectionCount={editor.selection.length}
            canEdit={canEdit}
            anyLocked={nodes.some(n => editor.selection.includes(n.id) && n.is_locked)}
            onAlign={handleAlign}
            onDistribute={handleDistribute}
            onOrder={handleOrder}
            onGroup={handleGroup}
            onLock={handleLock}
            onDuplicate={() => editor.duplicateNodes(editor.selection)}
            onDelete={() => editor.removeNodes(editor.selection)}
          />

          {selectedEdge && (
            <ConnectorBar
              edge={selectedEdge}
              canApplyOfficial={['owner', 'administrator'].includes(myRole)}
              onUpdate={(patch) => editor.updateEdge(selectedEdge.id, patch)}
              onDelete={() => editor.removeEdges([selectedEdge.id])}
              onAddBend={() => {
                const source = nodes.find(n => n.id === selectedEdge.source_id);
                const target = nodes.find(n => n.id === selectedEdge.target_id);
                if (!source || !target) return;
                const sourceSize = nodeSize(source);
                const targetSize = nodeSize(target);
                const points = selectedEdge.bend_points || [];
                editor.updateEdge(selectedEdge.id, {
                  bend_points: [...points, {
                    x: Math.round((source.x + sourceSize.w / 2 + target.x + targetSize.w / 2) / 2),
                    y: Math.round((source.y + sourceSize.h / 2 + target.y + targetSize.h / 2) / 2),
                  }],
                });
              }}
              onClearBends={() => editor.updateEdge(selectedEdge.id, { bend_points: [] })}
              onApplyOfficial={applyOfficial}
            />
          )}

          <BottomToolbar
            tool={tool}
            setTool={setTool}
            onAdd={(kind) => addCard(kind)}
            onGroup={handleGroup}
            onUndo={editor.undo}
            onRedo={editor.redo}
            canUndo={editor.canUndo}
            canRedo={editor.canRedo}
            canEdit={canEdit}
            selectionCount={editor.selection.length}
          />

          <ZoomBar
            zoom={view.zoom}
            onZoom={zoomBy}
            onFit={() => fitToScreen()}
            showMinimap={showMinimap}
            setShowMinimap={setShowMinimap}
            nodes={nodes}
            view={view}
            containerRef={containerRef}
            onJump={centerOn}
            onHelp={() => setDialog({ type: 'help' })}
          />
        </div>
      </div>

      <ContextMenu menu={menu} onClose={() => setMenu(null)} />

      <NodeDialog
        open={dialog?.type === 'node'}
        mode={dialog?.mode}
        node={dialog?.node}
        position={dialog?.position}
        onClose={() => setDialog(null)}
        onSubmit={submitNode}
      />

      <ShareDialog
        open={dialog?.type === 'share'}
        chart={chart}
        onClose={() => setDialog(null)}
        onSave={async (shares) => { editor.updateChart({ shares }, false); await editor.saveNow({ shares }); }}
      />

      <VersionsDialog
        open={dialog?.type === 'versions'}
        chart={chart}
        versions={versions}
        loading={versionsLoading}
        currentNodes={nodes}
        currentEdges={edges}
        onCreate={editor.createVersion}
        onRestore={editor.restoreVersion}
        onClose={() => setDialog(null)}
      />

      <ExportDialog
        open={dialog?.type === 'export'}
        chart={chart}
        error={exportError}
        onClose={() => setDialog(null)}
        onExport={handleExport}
      />

      <AutoLayoutDialog
        open={dialog?.type === 'autoLayout'}
        nodes={nodes}
        edges={edges}
        onClose={() => setDialog(null)}
        onApply={applyAutoLayout}
      />

      <HelpDialog open={dialog?.type === 'help'} onClose={() => setDialog(null)} />
    </div>
  );
}