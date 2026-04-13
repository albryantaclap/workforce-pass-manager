import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, ChevronDown } from 'lucide-react';
import { exportData } from '@/utils/constants';

export default function ExportButton({ getData, filename, label = 'Export' }) {
  const [open, setOpen] = useState(false);

  const handleExport = (format) => {
    const data = getData();
    if (!data || data.length === 0) return;
    exportData(data, filename, format);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Button variant="outline" onClick={() => setOpen(v => !v)}>
        <Download className="w-4 h-4 mr-2" /> {label} <ChevronDown className="w-3 h-3 ml-1" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-md shadow-md min-w-[140px]">
          {['csv', 'excel', 'iqy'].map(fmt => (
            <button
              key={fmt}
              className="w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors"
              onClick={() => handleExport(fmt)}
            >
              {fmt === 'csv' ? 'CSV (.csv)' : fmt === 'excel' ? 'Excel (.xls)' : 'IQY (.iqy)'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}