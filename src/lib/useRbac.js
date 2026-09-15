/**
 * RBAC Hook — granular permission evaluation for the current authenticated user.
 *
 * Strategy (additive, backward-compatible):
 *   1. Builder/Owner (app builder) → full access, always.
 *   2. If the user has UserPermission records configured → use granular RBAC.
 *   3. If no RBAC configured → fall back to legacy role-based behavior
 *      (owner/admin/user from the built-in User.role field) so existing
 *      access is preserved during deployment.
 *
 * Access scope (UserAccessScope) is fetched separately and exposed for
 * record-level filtering (company/department/location/team).
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/lib/usePermissions';
import { getRoutePermissionKey } from '@/lib/permissionCatalog';

const SUPER_ADMIN_EMAILS = ['albryantaclap@gmail.com'];

export function useRbac() {
  const { user } = useAuth();
  const legacy = usePermissions();

  const isBuilder = legacy.isBuilder;
  const isOwner = legacy.isOwner;
  const isSuperAdminOnly = !isBuilder && SUPER_ADMIN_EMAILS.includes(user?.email);

  // Fetch current user's RBAC permissions
  const { data: permissions = [] } = useQuery({
    queryKey: ['rbac-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const all = await base44.entities.UserPermission.list('-created_date', 10000);
      return all.filter(p => p.user_id === user.id);
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  // Fetch current user's access scope
  const { data: scope = null } = useQuery({
    queryKey: ['rbac-scope', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const all = await base44.entities.UserAccessScope.list('-created_date', 100);
      return all.find(s => s.user_id === user.id) || null;
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  const allowedKeys = new Set(
    permissions.filter(p => p.allowed).map(p => p.permission_key)
  );
  const hasRBAC = permissions.length > 0;

  /** Legacy fallback for users without RBAC configured. */
  const legacyCan = (permissionKey) => {
    if (isOwner || isBuilder) return true;
    if (isSuperAdminOnly) {
      return permissionKey.startsWith('system.db_backup') || permissionKey.startsWith('system.admin_panel');
    }
    // Admin panel + DB backup: owner-only in legacy behavior
    if (permissionKey.startsWith('system.admin_panel') || permissionKey.startsWith('system.db_backup')) {
      return false;
    }
    if (permissionKey.startsWith('system.user_management')) {
      return false; // user management = owner/admin only in legacy
    }
    const action = permissionKey.split('.').pop();
    if (action === 'view' || action === 'use' || action === 'send') return true;
    return legacy.canEdit;
  };

  /** Check a specific granular permission key (group.resource.action). */
  const can = (permissionKey) => {
    if (isOwner || isBuilder) return true;
    // Platform admins always retain user management access (prevents self-lockout)
    if (user?.role === 'admin' && permissionKey.startsWith('system.user_management')) return true;
    if (!hasRBAC) return legacyCan(permissionKey);
    return allowedKeys.has(permissionKey);
  };

  /** Check if user can view/use a resource (resourceKey = group.resource). */
  const canView = (resourceKey) => {
    if (isOwner || isBuilder) return true;
    return can(`${resourceKey}.view`) || can(`${resourceKey}.use`);
  };

  /** Check if user can access a route (pathname + search). */
  const canAccessRoute = (pathname, search = '') => {
    if (isOwner || isBuilder) return true;
    const resourceKey = getRoutePermissionKey(pathname, search);
    if (!resourceKey) return true; // no permission mapping = allow
    return canView(resourceKey);
  };

  /** Check if user can manage a resource (has 'manage' action). */
  const canManage = (resourceKey) => can(`${resourceKey}.manage`);

  return {
    can,
    canView,
    canAccessRoute,
    canManage,
    hasRBAC,
    scope,
    isOwner,
    isBuilder,
    isSuperAdminOnly,
    // Legacy passthrough for backward compatibility with existing components
    isAdmin: legacy.isAdmin,
    canEdit: legacy.canEdit,
    canDelete: legacy.canDelete,
    canAccessAdmin: legacy.canAccessAdmin,
    role: legacy.role,
  };
}