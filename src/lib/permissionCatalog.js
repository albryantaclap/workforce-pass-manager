/**
 * Central Permission Catalog — single source of truth for all modules, resources,
 * and actions in the RBAC system. Used by:
 *   - User Management permissions modal (renders the checkbox grid)
 *   - Sidebar (checks page visibility)
 *   - Route protection (AppLayout checks access)
 *   - useRbac hook (permission evaluation)
 *
 * To add a future module, append a new resource here — no destructive changes
 * to existing roles or permissions are needed.
 */

export const PERMISSION_CATALOG = [
  {
    group: 'Workforce Management',
    key: 'workforce',
    resources: [
      { key: 'dashboard', label: 'Dashboard', path: '/', actions: [
        { key: 'view', label: 'View' },
      ]},
      { key: 'master_list', label: 'Master List', path: '/master-list', actions: [
        { key: 'view', label: 'View' },
        { key: 'add', label: 'Add' },
        { key: 'edit', label: 'Edit' },
        { key: 'delete', label: 'Delete' },
        { key: 'export', label: 'Export' },
        { key: 'import', label: 'Import' },
      ]},
      { key: 'medical', label: 'Medical', path: '/medical', actions: [
        { key: 'view', label: 'View' },
        { key: 'edit', label: 'Edit' },
        { key: 'export', label: 'Export' },
      ]},
      { key: 'gatepass', label: 'Gate Pass (RLIC)', path: '/gatepass', actions: [
        { key: 'view', label: 'View' },
        { key: 'edit', label: 'Edit' },
        { key: 'export', label: 'Export' },
      ]},
      { key: 'project_id', label: 'Project ID', path: '/project-id', actions: [
        { key: 'view', label: 'View' },
        { key: 'edit', label: 'Edit' },
        { key: 'export', label: 'Export' },
      ]},
      { key: 'training', label: 'Training', path: '/training', actions: [
        { key: 'view', label: 'View' },
        { key: 'edit', label: 'Edit' },
        { key: 'export', label: 'Export' },
      ]},
      { key: 'como_camp', label: 'COMO Camp', path: '/como-camp', actions: [
        { key: 'view', label: 'View' },
        { key: 'check_in', label: 'Check-in / Check-out' },
        { key: 'edit', label: 'Edit' },
        { key: 'delete', label: 'Delete' },
        { key: 'export', label: 'Export' },
      ]},
      { key: 'inactive', label: 'Inactive / Demobilized', path: '/master-list', actions: [
        { key: 'view', label: 'View' },
        { key: 'edit', label: 'Edit' },
      ]},
      { key: 'reports', label: 'Reports', path: '/projection', actions: [
        { key: 'view', label: 'View' },
        { key: 'export', label: 'Export' },
        { key: 'print', label: 'Print' },
      ]},
    ],
  },
  {
    group: 'Daily Attendance',
    key: 'attendance',
    resources: [
      { key: 'dashboard', label: 'Dashboard', path: '/daily-attendance?tab=dashboard', actions: [
        { key: 'view', label: 'View' },
      ]},
      { key: 'summary', label: 'Employee Summary', path: '/daily-attendance?tab=summary', actions: [
        { key: 'view', label: 'View' },
      ]},
      { key: 'clock', label: 'Attendance Clock', path: '/daily-attendance?tab=scan', actions: [
        { key: 'view', label: 'View' },
        { key: 'use', label: 'Scan / Punch' },
      ]},
      { key: 'entries', label: 'Time Entries', path: '/daily-attendance?tab=entries', actions: [
        { key: 'view', label: 'View' },
        { key: 'edit', label: 'Manual Entry / Edit' },
        { key: 'delete', label: 'Delete' },
        { key: 'export', label: 'Export' },
      ]},
      { key: 'reports', label: 'Attendance Reports', path: '/daily-attendance?tab=reports', actions: [
        { key: 'view', label: 'View' },
        { key: 'export', label: 'Export' },
        { key: 'print', label: 'Print' },
      ]},
      { key: 'settings', label: 'Attendance Settings', path: '/daily-attendance?tab=settings', actions: [
        { key: 'view', label: 'View' },
        { key: 'manage', label: 'Manage Settings' },
      ]},
    ],
  },
  {
    group: 'Inventory Management',
    key: 'inventory',
    resources: [
      { key: 'dashboard', label: 'Inventory Dashboard', path: '/inventory', actions: [
        { key: 'view', label: 'View' },
      ]},
      { key: 'items', label: 'Inventory Items', path: '/inventory/items', actions: [
        { key: 'view', label: 'View' },
        { key: 'add', label: 'Add' },
        { key: 'edit', label: 'Edit' },
        { key: 'import', label: 'Import' },
        { key: 'export', label: 'Export' },
      ]},
      { key: 'stock_in', label: 'Stock In', path: '/inventory/stock-in', actions: [
        { key: 'view', label: 'View' },
        { key: 'add', label: 'Add' },
        { key: 'edit', label: 'Edit' },
        { key: 'export', label: 'Export' },
      ]},
      { key: 'stock_out', label: 'Stock Out', path: '/inventory/stock-out', actions: [
        { key: 'view', label: 'View' },
        { key: 'issue', label: 'Issue' },
        { key: 'edit', label: 'Edit' },
        { key: 'export', label: 'Export' },
      ]},
      { key: 'available_stock', label: 'Available Stock', path: '/inventory/available', actions: [
        { key: 'view', label: 'View' },
        { key: 'export', label: 'Export' },
      ]},
      { key: 'employee_issuance', label: 'Employee Issuance', path: '/inventory/employee-issuance', actions: [
        { key: 'view', label: 'View' },
        { key: 'export', label: 'Export' },
      ]},
      { key: 'transaction_history', label: 'Transaction History', path: '/inventory/transactions', actions: [
        { key: 'view', label: 'View' },
        { key: 'export', label: 'Export' },
      ]},
      { key: 'reports', label: 'Inventory Reports', path: '/inventory/reports', actions: [
        { key: 'view', label: 'View' },
        { key: 'export', label: 'Export' },
        { key: 'print', label: 'Print' },
      ]},
      { key: 'settings', label: 'Inventory Settings', path: '/inventory/settings', actions: [
        { key: 'view', label: 'View' },
        { key: 'edit', label: 'Edit' },
      ]},
      { key: 'warranty', label: 'Warranty Management', path: '/inventory/reports?type=warranty', actions: [
        { key: 'view', label: 'View' },
        { key: 'add', label: 'Add' },
        { key: 'edit', label: 'Edit' },
        { key: 'export', label: 'Export' },
        { key: 'print', label: 'Print' },
        { key: 'manage_settings', label: 'Manage Settings' },
      ]},
    ],
  },
  {
    group: 'System',
    key: 'system',
    resources: [
      { key: 'deleted_personnel', label: 'Deleted Personnel', path: '/deleted-personnel', actions: [
        { key: 'view', label: 'View' },
        { key: 'restore', label: 'Restore' },
      ]},
      { key: 'activity_log', label: 'Activity Log', path: '/activity-log', actions: [
        { key: 'view', label: 'View' },
      ]},
      { key: 'chat', label: 'Team Chat', path: '/chat', actions: [
        { key: 'view', label: 'View' },
        { key: 'send', label: 'Send Messages' },
      ]},
      { key: 'forms', label: 'Forms', path: '/forms', actions: [
        { key: 'view', label: 'View' },
        { key: 'create', label: 'Create' },
      ]},
      { key: 'db_backup', label: 'DB Backup', path: '/database-backup', actions: [
        { key: 'view', label: 'View' },
        { key: 'manage', label: 'Manage / Restore' },
      ]},
      { key: 'admin_panel', label: 'Admin Panel', path: '/admin', actions: [
        { key: 'view', label: 'View' },
        { key: 'manage', label: 'Manage' },
      ]},
      { key: 'user_management', label: 'User Management', path: '/user-management', actions: [
        { key: 'view', label: 'View' },
        { key: 'manage', label: 'Manage Users / Permissions' },
      ]},
    ],
  },
];

/**
 * Permission presets — when a preset is applied, these define which permission
 * keys are granted (allowed = true). Any key NOT in the set is denied.
 * Admins can customize individual permissions afterward without resetting.
 */
export const ROLE_PRESETS = {
  Admin: { mode: 'all' }, // Admin = all permissions granted
  Manager: {
    granted: [
      // Workforce — view + edit, no delete
      'workforce.dashboard.view',
      'workforce.master_list.view', 'workforce.master_list.edit', 'workforce.master_list.export',
      'workforce.medical.view', 'workforce.medical.edit', 'workforce.medical.export',
      'workforce.gatepass.view', 'workforce.gatepass.edit', 'workforce.gatepass.export',
      'workforce.project_id.view', 'workforce.project_id.edit', 'workforce.project_id.export',
      'workforce.training.view', 'workforce.training.edit', 'workforce.training.export',
      'workforce.como_camp.view', 'workforce.como_camp.check_in', 'workforce.como_camp.edit', 'workforce.como_camp.export',
      'workforce.inactive.view', 'workforce.inactive.edit',
      'workforce.reports.view', 'workforce.reports.export', 'workforce.reports.print',
      // Attendance — view + edit, no settings
      'attendance.dashboard.view',
      'attendance.summary.view',
      'attendance.clock.view', 'attendance.clock.use',
      'attendance.entries.view', 'attendance.entries.edit', 'attendance.entries.export',
      'attendance.reports.view', 'attendance.reports.export', 'attendance.reports.print',
      // Inventory — full access except settings
      'inventory.dashboard.view',
      'inventory.items.view', 'inventory.items.add', 'inventory.items.edit', 'inventory.items.import', 'inventory.items.export',
      'inventory.stock_in.view', 'inventory.stock_in.add', 'inventory.stock_in.edit', 'inventory.stock_in.export',
      'inventory.stock_out.view', 'inventory.stock_out.issue', 'inventory.stock_out.edit', 'inventory.stock_out.export',
      'inventory.available_stock.view', 'inventory.available_stock.export',
      'inventory.employee_issuance.view', 'inventory.employee_issuance.export',
      'inventory.transaction_history.view', 'inventory.transaction_history.export',
      'inventory.reports.view', 'inventory.reports.export', 'inventory.reports.print',
      'inventory.settings.view',
      'inventory.warranty.view', 'inventory.warranty.add', 'inventory.warranty.edit',
      'inventory.warranty.export', 'inventory.warranty.print',
      // System — chat + forms only
      'system.chat.view', 'system.chat.send',
      'system.forms.view', 'system.forms.create',
    ],
  },
  Supervisor: {
    granted: [
      'workforce.dashboard.view',
      'workforce.master_list.view', 'workforce.master_list.edit',
      'workforce.medical.view',
      'workforce.training.view',
      'workforce.como_camp.view', 'workforce.como_camp.check_in',
      'workforce.reports.view',
      'attendance.dashboard.view',
      'attendance.summary.view',
      'attendance.clock.view', 'attendance.clock.use',
      'attendance.entries.view', 'attendance.entries.edit',
      'attendance.reports.view',
      // Inventory — view + issue
      'inventory.dashboard.view',
      'inventory.items.view', 'inventory.items.export',
      'inventory.stock_in.view', 'inventory.stock_in.export',
      'inventory.stock_out.view', 'inventory.stock_out.issue', 'inventory.stock_out.export',
      'inventory.available_stock.view', 'inventory.available_stock.export',
      'inventory.employee_issuance.view', 'inventory.employee_issuance.export',
      'inventory.transaction_history.view', 'inventory.transaction_history.export',
      'inventory.reports.view',
      'inventory.warranty.view', 'inventory.warranty.export', 'inventory.warranty.print',
      'system.chat.view', 'system.chat.send',
    ],
  },
  User: {
    granted: [
      'workforce.dashboard.view',
      'workforce.master_list.view',
      'attendance.dashboard.view',
      'attendance.summary.view',
      'system.chat.view', 'system.chat.send',
    ],
  },
};

/** Flatten all permission keys from the catalog. */
export function getAllPermissionKeys() {
  const keys = [];
  for (const mod of PERMISSION_CATALOG) {
    for (const res of mod.resources) {
      for (const act of res.actions) {
        keys.push(`${mod.key}.${res.key}.${act.key}`);
      }
    }
  }
  return keys;
}

/** Get all permission keys for a specific resource (module.resource). */
export function getResourcePermissionKeys(moduleKey, resourceKey) {
  const mod = PERMISSION_CATALOG.find(m => m.key === moduleKey);
  if (!mod) return [];
  const res = mod.resources.find(r => r.key === resourceKey);
  if (!res) return [];
  return res.actions.map(a => `${moduleKey}.${resourceKey}.${a.key}`);
}

/** Get the base view permission key for a resource path. */
export function getResourceKeyByPath(path) {
  for (const mod of PERMISSION_CATALOG) {
    for (const res of mod.resources) {
      if (res.path === path || res.path.split('?')[0] === path.split('?')[0]) {
        return `${mod.key}.${res.key}`;
      }
    }
  }
  return null;
}

/** Map a route pathname (+ optional search) to a resource permission key. */
export function getRoutePermissionKey(pathname, search = '') {
  // Attendance tabs
  if (pathname === '/daily-attendance') {
    const tab = new URLSearchParams(search).get('tab') || 'dashboard';
    const tabMap = {
      dashboard: 'attendance.dashboard',
      summary: 'attendance.summary',
      scan: 'attendance.clock',
      entries: 'attendance.entries',
      reports: 'attendance.reports',
      settings: 'attendance.settings',
    };
    return tabMap[tab] || 'attendance.dashboard';
  }
  // Inventory reports — the warranty report is its own permission resource
  if (pathname === '/inventory/reports') {
    const type = new URLSearchParams(search).get('type');
    if (type === 'warranty') return 'inventory.warranty';
  }
  // Dynamic employee routes
  if (pathname.startsWith('/employees/')) return 'workforce.master_list';
  // Static routes
  const staticMap = {
    '/': 'workforce.dashboard',
    '/master-list': 'workforce.master_list',
    '/employees/new': 'workforce.master_list',
    '/medical': 'workforce.medical',
    '/gatepass': 'workforce.gatepass',
    '/project-id': 'workforce.project_id',
    '/training': 'workforce.training',
    '/como-camp': 'workforce.como_camp',
    '/projection': 'workforce.reports',
    '/deleted-personnel': 'system.deleted_personnel',
    '/activity-log': 'system.activity_log',
    '/chat': 'system.chat',
    '/forms': 'system.forms',
    '/database-backup': 'system.db_backup',
    '/admin': 'system.admin_panel',
    '/user-management': 'system.user_management',
    // Inventory Management routes
    '/inventory': 'inventory.dashboard',
    '/inventory/items': 'inventory.items',
    '/inventory/stock-in': 'inventory.stock_in',
    '/inventory/stock-out': 'inventory.stock_out',
    '/inventory/available': 'inventory.available_stock',
    '/inventory/employee-issuance': 'inventory.employee_issuance',
    '/inventory/transactions': 'inventory.transaction_history',
    '/inventory/reports': 'inventory.reports',
    '/inventory/settings': 'inventory.settings',
  };
  return staticMap[pathname] || null;
}

/** Generate the full set of permission keys for a preset. */
export function getPresetPermissionKeys(presetName) {
  const preset = ROLE_PRESETS[presetName];
  if (!preset) return [];
  if (preset.mode === 'all') return getAllPermissionKeys();
  return preset.granted || [];
}