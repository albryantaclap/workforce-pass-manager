import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useManagerFilter() {
  const [selectedManagerIds, setSelectedManagerIds] = useState([]);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, 'name', 10000),
  });

  // Build manager list from employees that have assigned_manager_id/name set on others
  // Use employees marked is_manager, deduplicated by id
  const managers = useMemo(() => {
    const seen = new Map();
    for (const e of employees) {
      if (e.assigned_manager_id && !seen.has(e.assigned_manager_id)) {
        // Try to find the actual manager record for their name
        const mgr = employees.find(m => m.id === e.assigned_manager_id);
        seen.set(e.assigned_manager_id, {
          id: e.assigned_manager_id,
          label: mgr ? mgr.name : (e.assigned_manager_name || e.assigned_manager_id),
        });
      }
    }
    // Also add employees explicitly marked as manager
    for (const e of employees) {
      if (e.is_manager && !seen.has(e.id)) {
        seen.set(e.id, { id: e.id, label: e.name });
      }
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [employees]);

  return {
    selectedManagerIds,
    setSelectedManagerIds,
    // Legacy single-value support for pages that haven't been updated yet
    selectedManagerId: selectedManagerIds[0] || '',
    setSelectedManagerId: (id) => setSelectedManagerIds(id ? [id] : []),
    managers,
  };
}