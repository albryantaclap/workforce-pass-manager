/**
 * Shared permission check for backend functions.
 *
 * Checks whether the current authenticated user has a specific granular
 * permission (group.resource.action) in the UserPermission entity.
 *
 * Strategy (additive, backward-compatible — mirrors the frontend useRbac hook):
 *   1. Builder/Owner (app builder) → full access, always.
 *   2. If the user has UserPermission records → use granular RBAC.
 *   3. If no RBAC configured → fall back to legacy role-based behavior.
 *
 * @param base44 — the user-scoped base44 client (from createClientFromRequest)
 * @param user   — the current user (from base44.auth.me())
 * @param permissionKey — e.g. 'attendance.entries.edit'
 * @returns { allowed: boolean }
 */
export async function checkPermission(base44, user, permissionKey) {
  // Builder/Owner = full access
  const isBuilder = user?.collaborator_role === 'editor' || user?.collaborator_role === 'owner';
  if (isBuilder) return { allowed: true };

  // Fetch user's permission records using service role (bypasses RLS)
  const allPerms = await base44.asServiceRole.entities.UserPermission.list('-created_date', 50000);
  const userPerms = allPerms.filter(p => p.user_id === user.id);

  // If user has RBAC records configured, check the specific permission
  if (userPerms.length > 0) {
    const allowedKeys = new Set(
      userPerms.filter(p => p.allowed).map(p => p.permission_key)
    );
    return { allowed: allowedKeys.has(permissionKey) };
  }

  // Legacy fallback: no RBAC configured
  // view/use/send actions = allowed for all; edit/delete/manage = admin only
  const action = permissionKey.split('.').pop();
  if (action === 'view' || action === 'use' || action === 'send') {
    return { allowed: true };
  }
  return { allowed: user?.role === 'admin' };
}