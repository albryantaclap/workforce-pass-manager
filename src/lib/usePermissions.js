import { useAuth } from '@/lib/AuthContext';

/**
 * Returns permission flags based on the current user's role.
 * owner  → Super Administrator: full access
 * admin  → Admin: view + edit, no user management
 * user   → View only: no edits, no deletes
 */
export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role || 'user';

  return {
    isOwner: role === 'owner',
    isAdmin: role === 'admin' || role === 'owner',
    canEdit: role === 'admin' || role === 'owner',
    canDelete: role === 'admin' || role === 'owner',
    canAccessAdmin: role === 'admin' || role === 'owner',
    role,
  };
}