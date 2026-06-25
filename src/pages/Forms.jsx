import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import FormFilters from '@/components/forms/FormFilters';
import TransmittalFormTab from '@/components/forms/TransmittalFormTab';
import MobilizationFormTab from '@/components/forms/MobilizationFormTab';
import TrainingPassportTab from '@/components/forms/TrainingPassportTab';
import QEMedicalFormTab from '@/components/forms/QEMedicalFormTab';

export default function Forms() {
  const navigate = useNavigate();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, '-created_date', 10000),
  });

  // Shared filters
  const [search, setSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterGpDate, setFilterGpDate] = useState('');
  const [filterTrainingDate, setFilterTrainingDate] = useState('');
  const [filterPidDate, setFilterPidDate] = useState('');
  const [filterGpStatus, setFilterGpStatus] = useState('');
  const [filterTrainingStatus, setFilterTrainingStatus] = useState('');
  const [filterPidStatus, setFilterPidStatus] = useState('');
  const [filterMedicalResult, setFilterMedicalResult] = useState('');
  const [selectedPersonnel, setSelectedPersonnel] = useState([]);

  const addPersonnel = (emp) => {
    if (!selectedPersonnel.find(p => p.id === emp.id)) {
      setSelectedPersonnel(prev => [...prev, emp]);
    }
    setSearch('');
  };

  const removePersonnel = (id) => setSelectedPersonnel(prev => prev.filter(p => p.id !== id));

  const clearPersonnel = () => setSelectedPersonnel([]);

  return (
    <div className="space-y-4 pb-8">
      {/* Page header */}
      <div className="flex items-center gap-3 no-print">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xl font-bold">Forms</h2>
      </div>

      {/* Shared filters panel */}
      <FormFilters
        employees={employees}
        search={search}
        setSearch={setSearch}
        filterCompany={filterCompany}
        setFilterCompany={setFilterCompany}
        filterDepartment={filterDepartment}
        setFilterDepartment={setFilterDepartment}
        filterGpDate={filterGpDate}
        setFilterGpDate={setFilterGpDate}
        filterTrainingDate={filterTrainingDate}
        setFilterTrainingDate={setFilterTrainingDate}
        filterPidDate={filterPidDate}
        setFilterPidDate={setFilterPidDate}
        filterGpStatus={filterGpStatus}
        setFilterGpStatus={setFilterGpStatus}
        filterTrainingStatus={filterTrainingStatus}
        setFilterTrainingStatus={setFilterTrainingStatus}
        filterPidStatus={filterPidStatus}
        setFilterPidStatus={setFilterPidStatus}
        filterMedicalResult={filterMedicalResult}
        setFilterMedicalResult={setFilterMedicalResult}
        selectedPersonnel={selectedPersonnel}
        addPersonnel={addPersonnel}
        removePersonnel={removePersonnel}
        clearPersonnel={clearPersonnel}
      />

      {/* Form tabs */}
      <Tabs defaultValue="transmittal">
        <TabsList className="no-print">
          <TabsTrigger value="transmittal">Transmittal Form</TabsTrigger>
          <TabsTrigger value="mobilization">Mobilization Form</TabsTrigger>
          <TabsTrigger value="training">Training Passport</TabsTrigger>
          <TabsTrigger value="qemedical">QE Medical Examination Form</TabsTrigger>
        </TabsList>

        <TabsContent value="transmittal">
          <TransmittalFormTab selectedPersonnel={selectedPersonnel} />
        </TabsContent>

        <TabsContent value="mobilization">
          <MobilizationFormTab selectedPersonnel={selectedPersonnel} />
        </TabsContent>

        <TabsContent value="training">
          <TrainingPassportTab selectedPersonnel={selectedPersonnel} />
        </TabsContent>

        <TabsContent value="qemedical">
          <QEMedicalFormTab />
        </TabsContent>
      </Tabs>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          .no-print { display: none !important; }
          body * { visibility: hidden !important; }
          .printable-area, .printable-area * { visibility: visible !important; }
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          .printable-area {
            position: relative !important;
            top: auto !important; left: auto !important;
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 auto !important;
            padding: 5mm 8mm !important;
            border: none !important;
            box-shadow: none !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}