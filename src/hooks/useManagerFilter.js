import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useManagerFilter() {
  const [selectedManagerId, setSelectedManagerId] = useState(() => {
    return sessionStorage.getItem('selectedManagerId') || '';
  });

  useEffect(() => {
    sessionStorage.setItem('selectedManagerId', selectedManagerId);
  }, [selectedManagerId]);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, 'name', 10000),
  });

  // All active personnel who are marked as manager
  const managers = useMemo(() =>
    employees
      .filter(e => e.is_manager)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .map(e => ({ id: e.id, label: e.name, company: e.company })),
    [employees]
  );

  return {
    selectedManagerId,
    setSelectedManagerId,
    managers,
  };
}