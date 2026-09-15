/**
 * RBAC Service — functions for managing users, permissions, scopes, and audit
 * logs. Used by the User Management page and its modals.
 */
import { base44 } from '@/api/base44Client';
import {
  getAllPermissionKeys,
  getPresetPermissionKeys,
  PERMISSION_CATALOG,
} from '@/lib/permissionCatalog';

/** Fetch all users (platform: only admins can list other users). */
export async function fetchAllUsers() {
  return await base44.entities.User.list('-created_date', 10000);
}

/** Fetch all UserPermission records. */
export async function fetchAllPermissions() {
  return await base44.entities.UserPermission.list('-created_date', 50000);
}

/** Fetch all UserAccessScope records. */
export async function fetchAllScopes() {
  return await base44.entities.UserAccessScope.list('-created_date', 10000);
}

/** Fetch all UserRole records. */
export async function fetchAllRoles() {
  return await base44.entities.UserRole.list('display_order', 100);
}

/** Fetch all PermissionAuditLog records. */
export async function fetchAuditLogs() {
  return await base44.entities.PermissionAuditLog.list('-created_date', 10000);
}

/** Get permissions for a specific user (from a pre-fetched list). */
export function getPermissionsForUser(allPermissions, userId) {
  return allPermissions.filter(p => p.user_id === userId);
}

/** Get scope for a specific user (from a pre-fetched list). */
export function getScopeForUser(allScopes, userId) {
  return allScopes.find(s => s.user_id === userId) || null;
}

/**
 * Save permissions for a user — replaces all existing permission records for
 * that user with the provided set of allowed permission keys.
 * @param {string} userId
 * @param {string} userEmail
 * @param {string[]} allowedKeys — permission keys that are granted
 * @param {object} adminUser — current admin user (for audit)
 */
export async function saveUserPermissions(userId, userEmail, allowedKeys, adminUser) {
  const allKeys = getAllPermissionKeys();
  const allowedSet = new Set(allowedKeys);

  // Fetch existing permissions for this user
  const existing = await base44.entities.UserPermission.list('-created_date', 50000);
  const userPerms = existing.filter(p => p.user_id === userId);

  // Delete all existing, then recreate — simplest reliable approach
  if (userPerms.length > 0) {
    await base44.entities.UserPermission.deleteMany({ user_id: userId });
  }

  // Build new permission records (only for allowed keys — denied = not present)
  const records = allKeys
    .filter(k => allowedSet.has(k))
    .map(key => {
      const [module, resource, action] = key.split('.');
      return {
        user_id: userId,
        user_email: userEmail || '',
        permission_key: key,
        module,
        resource,
        action,
        allowed: true,
      };
    });

  if (records.length > 0) {
    // Bulk create in batches of 500
    for (let i = 0; i < records.length; i += 500) {
      await base44.entities.UserPermission.bulkCreate(records.slice(i, i + 500));
    }
  }

  // Audit log
  await logAudit({
    adminUser,
    affectedUserId: userId,
    affectedUserEmail: userEmail,
    actionType: 'permission_change',
    fieldChanged: 'permissions',
    oldValue: '',
    newValue: `${records.length} permissions granted`,
    description: `Updated permissions for ${userEmail || userId}: ${records.length} permissions granted`,
  });
}

/**
 * Apply a preset to a user — populates permissions from the preset definition.
 */
export async function applyPreset(userId, userEmail, presetName, adminUser) {
  const keys = getPresetPermissionKeys(presetName);
  await saveUserPermissions(userId, userEmail, keys, adminUser);
}

/**
 * Save access scope for a user — creates or updates the UserAccessScope record.
 */
export async function saveUserScope(userId, userEmail, scopeData, adminUser) {
  const existing = await base44.entities.UserAccessScope.list('-created_date', 10000);
  const userScope = existing.find(s => s.user_id === userId);

  const payload = {
    user_id: userId,
    user_email: userEmail || '',
    ...scopeData,
  };

  let oldDesc = '';
  let newDesc = '';

  if (userScope) {
    oldDesc = `${userScope.scope_mode} | companies: ${userScope.companies?.join(', ') || 'all'} | depts: ${userScope.departments?.join(', ') || 'all'}`;
    await base44.entities.UserAccessScope.update(userScope.id, payload);
  } else {
    await base44.entities.UserAccessScope.create(payload);
  }
  newDesc = `${scopeData.scope_mode} | companies: ${scopeData.companies?.join(', ') || 'all'} | depts: ${scopeData.departments?.join(', ') || 'all'}`;

  await logAudit({
    adminUser,
    affectedUserId: userId,
    affectedUserEmail: userEmail,
    actionType: 'scope_change',
    fieldChanged: 'access_scope',
    oldValue: oldDesc,
    newValue: newDesc,
    description: `Updated access scope for ${userEmail || userId}: ${newDesc}`,
  });
}

/**
 * Update a user's RBAC role and/or account status.
 */
export async function updateUserRbac(userId, updates, adminUser, oldValues = {}) {
  await base44.entities.User.update(userId, updates);

  const changes = [];
  if (updates.rbac_role && updates.rbac_role !== oldValues.rbac_role) {
    changes.push({
      action_type: 'role_change',
      field: 'rbac_role',
      old: oldValues.rbac_role || '',
      new: updates.rbac_role,
      desc: `Role changed: ${oldValues.rbac_role || '—'} → ${updates.rbac_role}`,
    });
  }
  if (updates.account_status && updates.account_status !== oldValues.account_status) {
    const actionType = updates.account_status === 'active' ? 'user_activate' : 'user_deactivate';
    changes.push({
      action_type: actionType,
      field: 'account_status',
      old: oldValues.account_status || 'active',
      new: updates.account_status,
      desc: `Account status: ${oldValues.account_status || 'active'} → ${updates.account_status}`,
    });
  }

  for (const c of changes) {
    await logAudit({
      adminUser,
      affectedUserId: userId,
      affectedUserEmail: oldValues.email || '',
      actionType: c.action_type,
      fieldChanged: c.field,
      oldValue: c.old,
      newValue: c.new,
      description: c.desc,
    });
  }
}

/** Write an audit log entry. */
export async function logAudit({ adminUser, affectedUserId, affectedUserEmail, actionType, fieldChanged, oldValue, newValue, description }) {
  try {
    await base44.entities.PermissionAuditLog.create({
      performed_by: adminUser?.email || '',
      performed_by_name: adminUser?.full_name || '',
      affected_user_id: affectedUserId || '',
      affected_user_email: affectedUserEmail || '',
      action_type: actionType,
      field_changed: fieldChanged || '',
      old_value: typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue || ''),
      new_value: typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue || ''),
      description: description || '',
    });
  } catch (e) {
    console.error('Failed to write audit log:', e);
  }
}

/**
 * Check lockout protection — ensure at least one active admin with user
 * management permission remains. Returns true if the operation is safe.
 */
export async function checkLockoutProtection(excludeUserId) {
  const [allUsers, allPerms] = await Promise.all([
    base44.entities.User.list('-created_date', 10000),
    base44.entities.UserPermission.list('-created_date', 50000),
  ]);

  // Find active users with user_management.manage permission
  const adminUsers = allUsers.filter(u => {
    if (u.id === excludeUserId) return false;
    if (u.account_status && u.account_status !== 'active') return false;
    // Builder/owner always has access
    if (u.collaborator_role === 'editor' || u.collaborator_role === 'owner') return true;
    if (u.role === 'owner') return true;
    // Check RBAC permission
    const userPerms = allPerms.filter(p => p.user_id === u.id && p.allowed);
    return userPerms.some(p => p.permission_key === 'system.user_management.manage');
  });

  return adminUsers.length > 0;
}

/** Seed default roles if they don't exist. */
export async function seedDefaultRoles() {
  const existing = await base44.entities.UserRole.list('display_order', 100);
  const existingNames = new Set(existing.map(r => r.role_name));

  const defaults = [
    { role_name: 'Admin', description: 'Full system access', is_system: true, display_order: 1 },
    { role_name: 'Manager', description: 'Module access granted by Admin, optionally restricted to assigned team/company/department/location', is_system: true, display_order: 2 },
    { role_name: 'Supervisor', description: 'Operational access to assigned modules/areas only', is_system: true, display_order: 3 },
    { role_name: 'User', description: 'Basic/restricted access — only explicitly granted pages and actions', is_system: true, display_order: 4 },
  ];

  const toCreate = defaults.filter(d => !existingNames.has(d.role_name));
  if (toCreate.length > 0) {
    await base44.entities.UserRole.bulkCreate(toCreate);
  }
  return toCreate.length;
}