import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';

const TODAY = format(new Date(), 'dd-MM-yyyy');

// Renders 4 passport cards per A4 page (2x2 grid), matching the uploaded template exactly
function PassportCard({ person, craft, dateIssued, dateEmployment }) {
  return (
    <div style={{
      border: '2px solid #333',
      width: '88mm',
      height: '130mm',
      display: 'inline-flex',
      flexDirection: 'column',
      fontFamily: 'Arial, sans-serif',
      fontSize: '9px',
      boxSizing: 'border-box',
      backgroundColor: 'white',
    }}>
      {/* Top: Photo area with logo */}
      <div style={{ display: 'flex', borderBottom: '1px solid #999', padding: '6px', gap: '6px', alignItems: 'flex-start' }}>
        {/* Photo box */}
        <div style={{ border: '1px solid #aaa', width: '55px', minHeight: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#aaa', flexShrink: 0, position: 'relative', backgroundColor: '#f9f9f9' }}>
          {person?.photo_url
            ? <img src={person.photo_url} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span>PHOTO</span>
          }
        </div>
        {/* Logo top-right */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'center', fontSize: '7px', fontWeight: 'bold', color: '#1a3c6e' }}>
            <div style={{ width: '28px', height: '28px', border: '2px solid #1a3c6e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto', fontSize: '11px', color: '#1a3c6e', fontWeight: '900' }}>TR</div>
            <div style={{ marginTop: '2px', fontSize: '6px', letterSpacing: '0.5px' }}>TÉCNICAS</div>
            <div style={{ fontSize: '6px', letterSpacing: '0.5px' }}>REUNIDAS</div>
          </div>
        </div>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '0' }}>
        {[
          ['NAME', person?.name || ''],
          ['ID NO', `${person?.qid_no || ''}`],
          ['NATIONALITY', person?.nationality || ''],
          ['MOBILE NO', person?.contact_details || ''],
          ['COMPANY', 'GSO'],
          ['CRAFT', craft || ''],
          ['POSITION', person?.designation_org_chart || ''],
          ['DATE ISSUED', dateIssued || ''],
          ['DATE OF EMPLOYMENT', dateEmployment || ''],
        ].map(([label, value]) => (
          <div key={label} style={{ borderBottom: '1px solid #ddd', padding: '2px 0', display: 'flex', alignItems: 'flex-start', minHeight: '12px' }}>
            <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', width: '110px', flexShrink: 0, fontSize: '8.5px' }}>{label}:</span>
            <span style={{ fontSize: '8.5px', wordBreak: 'break-word' }}>&nbsp;{value}</span>
          </div>
        ))}
        <div style={{ borderBottom: '1px solid #ddd', padding: '2px 0', minHeight: '20px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '8.5px' }}>SIGNATURE:</span>
        </div>
      </div>
    </div>
  );
}

export default function TrainingPassportTab({ selectedPersonnel }) {
  const [craft, setCraft] = useState('');
  const [dateIssued, setDateIssued] = useState(TODAY);
  const [dateEmployment, setDateEmployment] = useState('');

  const handlePrint = () => window.print();

  // Group into pages of 4
  const people = selectedPersonnel.length > 0 ? selectedPersonnel : [{}, {}, {}, {}];
  const pages = [];
  for (let i = 0; i < people.length; i += 4) {
    pages.push(people.slice(i, i + 4));
  }

  return (
    <div className="space-y-4">
      <div className="no-print bg-white border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Training Passport Settings</h3>
          <Button onClick={handlePrint} className="gap-2"><Printer className="w-4 h-4" /> Print / Export PDF</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Prints 4 passport cards per A4 page (2×2 grid). Personnel data auto-fills from selection above.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs font-medium block mb-1">Craft (applies to all)</label>
            <Input value={craft} onChange={e => setCraft(e.target.value)} placeholder="e.g. ELECTRICIAN" />
          </div>
          <div><label className="text-xs font-medium block mb-1">Date Issued</label>
            <Input type="date" value={dateIssued} onChange={e => setDateIssued(e.target.value)} />
          </div>
          <div><label className="text-xs font-medium block mb-1">Date of Employment</label>
            <Input type="date" value={dateEmployment} onChange={e => setDateEmployment(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Preview */}
      {pages.map((pagePersons, pi) => (
        <div key={pi} className="printable-area bg-white" style={{ width: '210mm', minHeight: '297mm', margin: '0 auto 20px', padding: '10mm', boxSizing: 'border-box', border: '1px solid #ccc', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '8mm', pageBreakAfter: pi < pages.length - 1 ? 'always' : 'auto' }}>
          {Array.from({ length: 4 }).map((_, ci) => {
            const person = pagePersons[ci];
            return (
              <div key={ci} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <PassportCard
                  person={person}
                  craft={craft}
                  dateIssued={dateIssued ? format(new Date(dateIssued), 'dd-MM-yyyy') : ''}
                  dateEmployment={dateEmployment ? format(new Date(dateEmployment), 'dd-MM-yyyy') : ''}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}