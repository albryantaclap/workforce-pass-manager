import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import MultiSelect from '@/components/common/MultiSelect';
import { toast } from 'sonner';

const BUILT_IN_COMPANIES = [
  'GSO QATAR', 'ITELLIGENT', 'ANION', 'SEA QUEEN', 'LMV E AND I',
  'METAL WORLD', 'ASMA', 'FIT', 'SPRAY CON', 'EMKAN', 'ENERTEC',
  'CRYSTAL', 'MEGATRONICS (GSO)', 'ENERSERVE (GSO)', 'ENERTEC (GSO)',
  'NTC (GSO)', 'MIR (GSO)', 'ALTAF (GSO)', 'SWAN GLOBAL (GSO)',
  'SIGEL (GSO)', 'AL-RAMSHA (GSO)', 'ALTHAF (GSO)', 'ZEAL-IT'
];

const getCompanyOptions = (lookups) => {
  const customCompanies = lookups
    .filter(l => l.type === 'company')
    .map(l => l.value)
    .filter(v => !BUILT_IN_COMPANIES.includes(v));

  return [
    ...BUILT_IN_COMPANIES.map(c => ({ label: c, value: c, category: 'Built-in' })),
    ...customCompanies.map(c => ({ label: c, value: c, category: 'Custom' }))
  ];
};

export default function ManagerAssignmentManager() {
  const [newManager, setNewManager] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const queryClient = useQueryClient();

  const { data: assignments = [] } = useQuery({
    queryKey: ['managerAssignments'],
    queryFn: () => base44.entities.ManagerAssignment.list(),
  });

  const { data: lookups = [] } = useQuery({
    queryKey: ['lookups'],
    queryFn: () => base44.entities.Lookup.list(),
  });

  const companyOptions = getCompanyOptions(lookups);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ManagerAssignment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managerAssignments'] });
      setNewManager('');
      setNewEmail('');
      setSelectedCompanies([]);
      toast.success('Manager assignment created');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ManagerAssignment.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managerAssignments'] });
      toast.success('Manager assignment updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ManagerAssignment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managerAssignments'] });
      toast.success('Manager assignment deleted');
    },
  });

  const handleCreate = () => {
    if (!newManager.trim() || selectedCompanies.length === 0) {
      toast.error('Manager name and at least one company are required');
      return;
    }
    createMutation.mutate({
      manager_name: newManager,
      manager_email: newEmail,
      companies: selectedCompanies,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Manager Assignment</h3>
        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Manager Name</label>
              <Input
                value={newManager}
                onChange={(e) => setNewManager(e.target.value)}
                placeholder="Enter manager name"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Manager Email (Optional)</label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="manager@example.com"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Assign Companies</label>
            <MultiSelect
              options={companyOptions}
              value={selectedCompanies}
              onChange={setSelectedCompanies}
              placeholder="Select companies..."
              className="mt-1"
            />
          </div>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            <Plus className="w-4 h-4 mr-2" />
            Create Assignment
          </Button>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Current Assignments</h3>
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <Card key={assignment.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-semibold">{assignment.manager_name}</h4>
                  {assignment.manager_email && (
                    <p className="text-sm text-muted-foreground">{assignment.manager_email}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {assignment.companies.map((company) => (
                      <span key={company} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        {company}
                      </span>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(assignment.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}