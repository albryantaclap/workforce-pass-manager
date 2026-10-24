// Shared constants for the Visual Org Chart Builder.

export const uid = () => Math.random().toString(36).slice(2, 10);

export const DEFAULT_VIEW_SETTINGS = {
  card_style: 'business',
  density: 'standard',
  accent_color: '#254dd0',
  visible_fields: ['name', 'designation', 'department'],
  background_color: '#ffffff',
  show_grid: true,
  snap_to_grid: true,
  grid_size: 20,
  show_guides: true,
  zoom: 1,
  pan_x: 80,
  pan_y: 80,
};

export const CARD_STYLE_OPTIONS = [
  { key: 'photo', label: 'Photo Card', hint: 'Prominent photo' },
  { key: 'text', label: 'Text Only', hint: 'Compact, no photo' },
  { key: 'business', label: 'Business Card', hint: 'Avatar + footer' },
];

export const DENSITY_OPTIONS = [
  { key: 'minimal', label: 'Minimal' },
  { key: 'standard', label: 'Standard' },
  { key: 'detailed', label: 'Detailed' },
];

export const VISIBLE_FIELD_DEFS = [
  { key: 'name', label: 'Employee Name' },
  { key: 'designation', label: 'Designation' },
  { key: 'department', label: 'Department' },
  { key: 'company', label: 'Company' },
  { key: 'project', label: 'Project' },
  { key: 'employee_code', label: 'Employee ID' },
  { key: 'pid', label: 'PID' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'manager', label: 'Reporting Manager' },
  { key: 'employment_status', label: 'Employment Status' },
  { key: 'planned_fill_date', label: 'Planned Fill Date' },
  { key: 'position_grade', label: 'Position Grade' },
  { key: 'custom', label: 'Custom Fields' },
];

export const ACCENT_PALETTE = [
  '#254dd0', '#0f766e', '#b91c1c', '#7c3aed', '#ea580c',
  '#0891b2', '#4d7c0f', '#be185d', '#334155', '#a16207',
];

export const SHAPES = [
  { key: 'rect', label: 'Rectangle' },
  { key: 'rounded', label: 'Rounded' },
  { key: 'ellipse', label: 'Ellipse' },
  { key: 'circle', label: 'Circle' },
  { key: 'diamond', label: 'Decision' },
  { key: 'hexagon', label: 'Hexagon' },
  { key: 'parallelogram', label: 'Data' },
  { key: 'cylinder', label: 'Database' },
];

export const NODE_KIND_OPTIONS = [
  { key: 'employee', label: 'Employee Card', hint: 'Person, linked or manual' },
  { key: 'position', label: 'Position Card', hint: 'Approved or proposed position' },
  { key: 'text', label: 'Text', hint: 'Free floating title' },
  { key: 'note', label: 'Note', hint: 'Sticky note / legend' },
];

export const CONNECTOR_TYPES = [
  { key: 'Direct Reporting', color: '#254dd0', path: 'orthogonal', line: 'solid', arrow: true },
  { key: 'Functional Reporting', color: '#0f766e', path: 'orthogonal', line: 'dashed', arrow: true },
  { key: 'Matrix Reporting', color: '#7c3aed', path: 'curved', line: 'dashed', arrow: true },
  { key: 'Coordination', color: '#ea580c', path: 'straight', line: 'dotted', arrow: false },
  { key: 'Custom Relationship', color: '#64748b', path: 'straight', line: 'solid', arrow: true },
];

export const CONNECTOR_PATH_STYLES = ['straight', 'orthogonal', 'curved'];
export const CONNECTOR_LINE_STYLES = ['solid', 'dashed', 'dotted'];
export const FONT_WEIGHTS = ['400', '500', '600', '700', '800'];

export const connectorDefaults = (type) =>
  CONNECTOR_TYPES.find(t => t.key === type) || CONNECTOR_TYPES[0];

export const connectorColor = (type) => connectorDefaults(type).color;

export const CARD_PRESETS = [
  {
    name: 'Executive',
    style: { accent_color: '#254dd0', background_color: '#ffffff', text_color: '#0e1425', border_width: 2, corner_radius: 10, font_size: 14, font_weight: '700', avatar_size: 54, shadow: 'md', padding: 16, align: 'center' },
  },
  {
    name: 'Site Team',
    style: { accent_color: '#0f766e', background_color: '#f0fdfa', text_color: '#0f172a', border_width: 1, corner_radius: 14, font_size: 13, font_weight: '600', avatar_size: 40, shadow: 'sm', padding: 12, align: 'left' },
  },
  {
    name: 'Proposed (Dashed)',
    style: { accent_color: '#ea580c', background_color: '#fff7ed', text_color: '#7c2d12', border_width: 1, corner_radius: 12, font_size: 13, font_weight: '500', avatar_size: 36, shadow: 'none', padding: 12, align: 'left' },
  },
  {
    name: 'Contractor',
    style: { accent_color: '#7c3aed', background_color: '#faf5ff', text_color: '#3b0764', border_width: 1, corner_radius: 8, font_size: 12, font_weight: '500', avatar_size: 34, shadow: 'sm', padding: 10, align: 'left' },
  },
];

export const AUTO_LAYOUT_MODES = [
  { key: 'top_to_bottom', label: 'Top to Bottom' },
  { key: 'bottom_to_top', label: 'Bottom to Top' },
  { key: 'left_to_right', label: 'Left to Right' },
  { key: 'right_to_left', label: 'Right to Left' },
  { key: 'hierarchical', label: 'Hierarchical' },
  { key: 'tree', label: 'Tree (compact)' },
  { key: 'compact', label: 'Compact grid' },
  { key: 'radial', label: 'Radial' },
  { key: 'matrix', label: 'Matrix' },
  { key: 'divisional', label: 'Divisional' },
];

export const NODE_PERSIST_FIELDS = [
  'chart_id', 'node_kind', 'shape', 'x', 'y', 'width', 'height', 'rotation', 'z_index',
  'group_id', 'is_locked', 'is_visible', 'display_style', 'density', 'name', 'designation',
  'department', 'company', 'project_name', 'employee_code', 'pid', 'qid', 'email', 'phone',
  'photo_url', 'text_content', 'footer_text', 'remarks', 'extra_fields', 'manager_name',
  'employment_status', 'planned_fill_date', 'position_grade', 'linked_employee_id',
  'link_source', 'accent_color', 'border_color', 'background_color', 'fill_mode',
  'border_style', 'opacity', 'text_color',
  'border_width', 'corner_radius', 'font_size', 'font_weight', 'avatar_size', 'shadow',
  'padding', 'align',
];

export const EDGE_PERSIST_FIELDS = [
  'chart_id', 'source_id', 'target_id', 'source_port', 'target_port', 'relationship_type',
  'path_style', 'line_style', 'arrow', 'label', 'color', 'thickness', 'bend_points',
  'is_official', 'official_applied_at', 'official_applied_by',
];

export function defaultNode(kind = 'employee', x = 0, y = 0) {
  const base = {
    node_kind: kind, x, y, width: 260, height: 118, rotation: 0, z_index: 1,
    is_locked: false, is_visible: true, display_style: 'business', density: 'standard',
    shadow: 'sm', padding: 14, align: 'center', border_width: 1, corner_radius: 12,
    font_size: 13, font_weight: '600', avatar_size: 44, link_source: 'manual', extra_fields: [],
    fill_mode: 'solid', border_style: 'solid', opacity: 100,
  };
  if (kind === 'shape') return { ...base, shape: 'rounded', width: 180, height: 92, name: 'Shape', display_style: 'text', font_weight: '600' };
  if (kind === 'text') return { ...base, width: 260, height: 56, name: 'Text', text_content: 'Text', shadow: 'none', display_style: 'text', font_size: 16, font_weight: '700' };
  if (kind === 'note') return { ...base, shape: 'note', width: 230, height: 120, name: 'Note', text_content: 'Note', shadow: 'sm', display_style: 'text', font_weight: '500' };
  if (kind === 'position') {
    return {
      ...base, node_kind: 'position', name: 'New Position', designation: 'Position title',
      link_source: 'manual', accent_color: '#ea580c',
    };
  }
  return { ...base, node_kind: 'employee', name: 'New Employee', designation: 'Designation' };
}

// ---------------------------------------------------------------------------
// Built-in template library (editable cards + connectors, never static images)
// ---------------------------------------------------------------------------
const c = (key, name, designation, x, y, extra = {}) => ({
  key, node_kind: 'position', name, designation, x, y, width: 260, height: 118,
  display_style: 'business', density: 'standard', ...extra,
});
const l = (source, target, relationship_type = 'Direct Reporting') => ({ source, target, relationship_type });
const t = (key, name, category, description, nodes, edges) => ({ key, name, category, description, nodes, edges });

export const ORG_TEMPLATES = [
  t('blank', 'Blank Canvas', 'Starter', 'Empty canvas — build the chart entirely by hand.', [], []),
  t('oil_gas', 'Oil & Gas Project Organization', 'Oil & Gas', 'Project directorate with construction, HSE and QA/QC reporting lines.', [
    c('pd', 'Project Director', 'Project Directorate', 420, 40),
    c('pm', 'Project Manager', 'Project Management', 420, 250),
    c('hse', 'HSE Manager', 'Health, Safety & Environment', 100, 460),
    c('qa', 'QA/QC Manager', 'Quality Assurance', 420, 460),
    c('cons', 'Construction Manager', 'Construction', 740, 460),
    c('civ', 'Civil Supervisor', 'Construction', 620, 670),
    c('mec', 'Mechanical Supervisor', 'Construction', 880, 670),
  ], [l('pd', 'pm'), l('pm', 'hse'), l('pm', 'qa'), l('pm', 'cons'), l('cons', 'civ'), l('cons', 'mec')]),
  t('epc', 'EPC Contractor Organization', 'Oil & Gas', 'Engineering, procurement, construction and commissioning functions.', [
    c('pd', 'Project Director', 'EPC Contractor', 420, 40),
    c('eng', 'Engineering Manager', 'Engineering', 60, 250),
    c('proc', 'Procurement Manager', 'Procurement', 340, 250),
    c('cons', 'Construction Manager', 'Construction', 620, 250),
    c('comm', 'Commissioning Manager', 'Commissioning', 900, 250),
  ], [l('pd', 'eng'), l('pd', 'proc'), l('pd', 'cons'), l('pd', 'comm')]),
  t('corporate', 'Corporate Organization', 'Corporate', 'Executive office with the functional directorates.', [
    c('ceo', 'Chief Executive Officer', 'Executive Office', 420, 40),
    c('coo', 'Chief Operating Officer', 'Operations', 100, 250),
    c('cfo', 'Chief Financial Officer', 'Finance', 420, 250),
    c('hr', 'HR Director', 'Human Resources', 740, 250),
    c('it', 'IT Director', 'Information Technology', 1060, 250),
  ], [l('ceo', 'coo'), l('ceo', 'cfo'), l('ceo', 'hr'), l('ceo', 'it')]),
  t('divisional', 'Divisional Organization', 'Corporate', 'Managing director with divisional managers.', [
    c('md', 'Managing Director', 'Corporate', 420, 40),
    c('d1', 'Electrical Division Manager', 'Electrical Division', 100, 250),
    c('d2', 'Mechanical Division Manager', 'Mechanical Division', 420, 250),
    c('d3', 'Civil Division Manager', 'Civil Division', 740, 250),
  ], [l('md', 'd1'), l('md', 'd2'), l('md', 'd3')]),
  t('functional', 'Functional Organization', 'Corporate', 'General manager with functional department heads.', [
    c('gm', 'General Manager', 'Corporate', 420, 40),
    c('f1', 'Engineering Manager', 'Engineering', 60, 250),
    c('f2', 'HSE Manager', 'HSE', 300, 250),
    c('f3', 'QA/QC Manager', 'Quality', 540, 250),
    c('f4', 'Project Controls Manager', 'Project Controls', 780, 250),
    c('f5', 'Procurement Manager', 'Procurement', 1020, 250),
  ], [l('gm', 'f1'), l('gm', 'f2'), l('gm', 'f3'), l('gm', 'f4'), l('gm', 'f5')]),
  t('matrix', 'Matrix Organization', 'Corporate', 'Project reporting lines combined with functional reporting.', [
    c('pm', 'Project Manager', 'Project', 420, 40),
    c('em', 'Engineering Manager', 'Engineering (Function)', 100, 250),
    c('cm', 'Construction Manager', 'Construction (Function)', 740, 250),
    c('el', 'Engineering Lead', 'Project Engineering', 100, 460),
    c('cl', 'Construction Lead', 'Project Construction', 740, 460),
    c('note', 'Note', '', 420, 470, {
      node_kind: 'note', name: 'Matrix Reporting', text_content: 'Solid lines = project reporting. Dashed lines = functional reporting.', shadow: 'sm', font_weight: '500',
    }),
  ], [l('pm', 'el'), l('pm', 'cl'), l('em', 'el', 'Functional Reporting'), l('cm', 'cl', 'Functional Reporting')]),
  t('construction_dept', 'Construction Department', 'Department', 'Construction manager with discipline supervisors.', [
    c('cm', 'Construction Manager', 'Construction', 420, 40),
    c('s1', 'Civil Supervisor', 'Construction', 100, 250),
    c('s2', 'Mechanical Supervisor', 'Construction', 420, 250),
    c('s3', 'Electrical Supervisor', 'Construction', 740, 250),
    c('s4', 'Piping Supervisor', 'Construction', 1060, 250),
  ], [l('cm', 's1'), l('cm', 's2'), l('cm', 's3'), l('cm', 's4')]),
  t('qaqc_dept', 'QA/QC Department', 'Department', 'QA/QC manager with inspection and documentation roles.', [
    c('qm', 'QA/QC Manager', 'Quality', 420, 40),
    c('i1', 'Welding Inspector', 'Quality', 100, 250),
    c('i2', 'Painting Inspector', 'Quality', 420, 250),
    c('i3', 'Civil Inspector', 'Quality', 740, 250),
    c('i4', 'Documentation Controller', 'Quality', 1060, 250),
  ], [l('qm', 'i1'), l('qm', 'i2'), l('qm', 'i3'), l('qm', 'i4')]),
  t('hse_dept', 'HSE Department', 'Department', 'HSE manager with officers and inspectors.', [
    c('hm', 'HSE Manager', 'HSE', 420, 40),
    c('o1', 'HSE Officer (Day Shift)', 'HSE', 100, 250),
    c('o2', 'HSE Officer (Night Shift)', 'HSE', 420, 250),
    c('o3', 'Safety Inspector', 'HSE', 740, 250),
    c('o4', 'Environmental Officer', 'HSE', 1060, 250),
  ], [l('hm', 'o1'), l('hm', 'o2'), l('hm', 'o3'), l('hm', 'o4')]),
  t('engineering_dept', 'Engineering Department', 'Department', 'Engineering manager with discipline leads.', [
    c('em', 'Engineering Manager', 'Engineering', 420, 40),
    c('e1', 'Lead Civil Engineer', 'Engineering', 100, 250),
    c('e2', 'Lead Mechanical Engineer', 'Engineering', 420, 250),
    c('e3', 'Lead Electrical Engineer', 'Engineering', 740, 250),
    c('e4', 'Design Coordinator', 'Engineering', 1060, 250),
  ], [l('em', 'e1'), l('em', 'e2'), l('em', 'e3'), l('em', 'e4')]),
  t('project_controls', 'Project Controls', 'Department', 'Planning, cost and progress measurement functions.', [
    c('pcm', 'Project Controls Manager', 'Project Controls', 420, 40),
    c('p1', 'Planning Engineer', 'Project Controls', 100, 250),
    c('p2', 'Cost Engineer', 'Project Controls', 420, 250),
    c('p3', 'Document Controller', 'Project Controls', 740, 250),
    c('p4', 'Progress Measurement Engineer', 'Project Controls', 1060, 250),
  ], [l('pcm', 'p1'), l('pcm', 'p2'), l('pcm', 'p3'), l('pcm', 'p4')]),
  t('procurement', 'Procurement and Logistics', 'Department', 'Procurement manager with buying, expediting and logistics.', [
    c('prm', 'Procurement Manager', 'Procurement', 420, 40),
    c('b1', 'Senior Buyer', 'Procurement', 100, 250),
    c('e1', 'Expediter', 'Procurement', 420, 250),
    c('l1', 'Logistics Coordinator', 'Logistics', 740, 250),
    c('w1', 'Warehouse Supervisor', 'Logistics', 1060, 250),
  ], [l('prm', 'b1'), l('prm', 'e1'), l('prm', 'l1'), l('prm', 'w1')]),
  t('contractor', 'Contractor Organization', 'Contractor', 'Main contractor with sub-contractor supervision.', [
    c('pm', 'Main Contractor Project Manager', 'Main Contractor', 420, 40),
    c('a', 'Sub-contractor A Supervisor', 'Sub-contractor', 100, 250),
    c('b', 'Sub-contractor B Supervisor', 'Sub-contractor', 420, 250),
    c('se', 'Site Engineer', 'Main Contractor', 740, 250),
  ], [l('pm', 'a'), l('pm', 'b'), l('pm', 'se')]),
];