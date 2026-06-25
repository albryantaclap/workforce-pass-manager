import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download, Maximize2, X } from 'lucide-react';

const IMAGE_URL = 'https://media.base44.com/images/public/69ce3261a82ad7bdfb8d8300/2aa4b8d4e_NEWMEDICALFORM_page-0001.jpg';

export default function QEMedicalFormTab() {
  const [fullscreen, setFullscreen] = useState(false);
  const imgRef = useRef(null);

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=900,height=1100');
    win.document.write(`<!DOCTYPE html><html><head><title>QE Medical Examination Form</title><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: white; display: flex; justify-content: center; align-items: flex-start; }
      img { width: 100%; height: auto; display: block; }
      @media print { @page { margin: 0; } body { margin: 0; } img { width: 100%; } }
    </style></head><body><img src="${IMAGE_URL}" /><script>setTimeout(()=>window.print(),400);<\/script></body></html>`);
    win.document.close();
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = IMAGE_URL;
    a.download = 'QE_Medical_Examination_Form.jpg';
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">QE Medical Examination Form (Onshore Contractor)</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Download JPG
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFullscreen(true)} className="gap-1.5">
            <Maximize2 className="w-3.5 h-3.5" /> Full Screen
          </Button>
        </div>
      </div>

      {/* Image */}
      <div className="p-4 flex justify-center bg-gray-50 overflow-y-auto">
        <img
          ref={imgRef}
          src={IMAGE_URL}
          alt="QE Medical Examination Form"
          style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
          className="shadow-md"
        />
      </div>

      {/* Fullscreen overlay */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black/50">
            <span className="text-white text-sm font-medium">QE Medical Examination Form</span>
            <button onClick={() => setFullscreen(false)} className="text-white hover:text-gray-300 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 overflow-auto flex justify-center p-4">
            <img
              src={IMAGE_URL}
              alt="QE Medical Examination Form"
              style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}