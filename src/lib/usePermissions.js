import { useAuth } from '@/lib/AuthContext';

/**
 * Returns permission flags based on the current user's role.
 * owner  → Super Administrator: full access
 * admin  → Admin: view + edit, no user management
 * user   → View only: no edits, no deletes
 */
const SUPER_ADMIN_EMAILS = ['albryantaclap@gmail.com'];

export function usePermissions() {
  const { user } = useAuth();
  // App builder (collaborator) is always treated as owner
  const isBuilder = user?.collaborator_role === 'editor' || user?.collaborator_role === 'owner';
  const role = isBuilder ? 'owner' : (user?.role || 'user');

  // Super admin accounts: can only access DB Backup and Admin Panel
  const isSuperAdminOnly = !isBuilder && SUPER_ADMIN_EMAILS.includes(user?.email);

  return {
    isOwner: role === 'owner',
    isBuilder,
    isSuperAdminOnly,
    isAdmin: role === 'admin' || role === 'owner',
    canEdit: isSuperAdminOnly ? false : (role === 'admin' || role === 'owner'),
    canDelete: isSuperAdminOnly ? false : (role === 'admin' || role === 'owner'),
    canAccessAdmin: role === 'admin' || role === 'owner',
    role,
  };
}