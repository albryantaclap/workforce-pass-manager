import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useManagerFilter() {
  const [selectedManager, setSelectedManager] = useState(() => {
    const saved = sessionStorage.getItem('selectedManager');
    return saved || '';
  });

  useEffect(() => {
    sessionStorage.setItem('selectedManager', selectedManager);
  }, [selectedManager]);

  const { data: assignments = [] } = useQuery({
    queryKey: ['managerAssignments'],
    queryFn: () => base44.entities.ManagerAssignment.list(),
  });

  const managers = assignments.map(a => ({
    id: a.id,
    label: a.manager_name,
    companies: a.companies,
  }));

  const getManagerCompanies = (managerId) => {
    const manager = assignments.find(m => m.id === managerId);
    return manager?.companies || [];
  };

  const filteredCompanies = selectedManager 
    ? getManagerCompanies(selectedManager)
    : [];

  return {
    selectedManager,
    setSelectedManager,
    managers,
    filteredCompanies,
    getManagerCompanies,
  };
}