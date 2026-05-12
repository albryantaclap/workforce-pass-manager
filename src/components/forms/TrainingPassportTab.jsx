import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';

// Single passport card — exactly matching the uploaded template layout
function PassportCard({ person, craft, dateIssued, dateEmployment, isEmpty }) {
  const cardW = '90mm';
  const cardH = '130mm';

  return (
    <div style={{
      width: cardW,
      height: cardH,
      border: '1.5px solid #333',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '8px',
      boxSizing: 'border-box',
      backgroundColor: 'white',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Top section: Photo + Logo area */}
      <div style={{
        display: 'flex',
        borderBottom: '1.5px solid #333',
        height: '46mm',
        flexShrink: 0,
      }}>
        {/* Photo box */}
        <div style={{
          width: '36mm',
          borderRight: '1.5px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '9px',
          color: '#999',
          backgroundColor: '#fff',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {person?.photo_url && !isEmpty
            ? <img src={person.photo_url} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
            : <span style={{ fontSize: '9px', color: '#bbb', letterSpacing: '1px', fontStyle: 'italic' }}>PHOTO</span>
          }
        </div>
        {/* Logo area — top right */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '5px 6px 4px 4px',
        }}>
          <img
            src="https://media.base44.com/images/public/69ce3261a82ad7bdfb8d8300/e48225e63_image.png"
            alt="Tecnicas Reunidas"
            style={{ height: '28px', objectFit: 'contain' }}
            onError={(e) => {
              // fallback to text if image fails
              e.target.style.display = 'none';
            }}
          />
        </div>
      </div>

      {/* Data fields */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {[
          { label: 'NAME:', value: isEmpty ? '' : (person?.name || '') },
          { label: 'ID NO:', value: isEmpty ? '' : (person?.qid_no || '') },
          { label: 'NATIONALITY:', value: isEmpty ? '' : (person?.nationality || '') },
          { label: 'MOBILE NO:', value: isEmpty ? '' : (person?.contact_details || '') },
          { label: 'COMPANY:', value: 'GSO' },
          { label: 'CRAFT:', value: isEmpty ? '' : (craft || '') },
          { label: 'POSITION:', value: isEmpty ? '' : (person?.designation_org_chart || '') },
          { label: 'DATE ISSUED:', value: isEmpty ? '' : (dateIssued || '') },
          { label: 'DATE OF EMPLOYMENT:', value: isEmpty ? '' : (dateEmployment || '') },
          { label: 'SIGNATURE:', value: '' },
        ].map(({ label, value }, i, arr) => (
          <div key={label} style={{
            display: 'flex',
            borderBottom: i < arr.length - 1 ? '1px solid #333' : 'none',
            flex: label === 'SIGNATURE:' ? 1.5 : 1,
            alignItems: 'stretch',
            minHeight: label === 'SIGNATURE:' ? '10mm' : '7mm',
          }}>
            <div style={{
              fontWeight: 'bold',
              fontSize: '7.5px',
              padding: '2px 4px',
              borderRight: '1px solid #333',
              width: '28mm',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              backgroundColor: '#fff',
            }}>
              {label}
            </div>
            <div style={{
              fontSize: '7.5px',
              padding: '2px 4px',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              wordBreak: 'break-word',
              backgroundColor: '#fff',
            }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrainingPassportTab({ selectedPersonnel }) {
  const [craft, setCraft] = useState('');
  const [dateIssued, setDateIssued] = useState('');
  const [dateEmployment, setDateEmployment] = useState('');

  const handlePrint = () => window.print();

  const fmtDate = (d) => {
    if (!d) return '';
    try { return format(new Date(d), 'dd-MM-yyyy'); } catch { return d; }
  };

  const people = selectedPersonnel.length > 0 ? selectedPersonnel : [];
  const totalCards = Math.max(4, Math.ceil(people.length / 4) * 4);
  const paddedPeople = [...people, ...Array(totalCards - people.length).fill(null)];

  const pages = [];
  for (let i = 0; i < paddedPeople.length; i += 4) {
    pages.push(paddedPeople.slice(i, i + 4));
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="no-print bg-white border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Training Passport Form</h3>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Print / Export PDF
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          4 cards per A4 page (2×2). Select personnel above — data auto-fills into each card.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">Craft (all cards)</label>
            <Input value={craft} onChange={e => setCraft(e.target.value)} placeholder="e.g. ELECTRICIAN" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Date Issued</label>
            <Input type="date" value={dateIssued} onChange={e => setDateIssued(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Date of Employment</label>
            <Input type="date" value={dateEmployment} onChange={e => setDateEmployment(e.target.value)} />
          </div>
        </div>
      </div>

      {/* One printable A4 page per group of 4 */}
      {pages.map((pagePersons, pi) => (
        <div
          key={pi}
          className="printable-area"
          style={{
            width: '210mm',
            height: '297mm',
            margin: '0 auto 12px',
            padding: '8mm 8mm',
            boxSizing: 'border-box',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gap: '5mm',
            pageBreakAfter: pi < pages.length - 1 ? 'always' : 'auto',
          }}
        >
          {pagePersons.map((person, ci) => (
            <div key={ci} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <PassportCard
                person={person}
                isEmpty={!person}
                craft={craft}
                dateIssued={fmtDate(dateIssued)}
                dateEmployment={fmtDate(dateEmployment)}
              />
            </div>
          ))}
        </div>
      ))}

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          .no-print { display: none !important; }
          body * { visibility: hidden !important; }
          .printable-area, .printable-area * { visibility: visible !important; }
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          .printable-area {
            position: absolute !important; top: 0 !important; left: 0 !important;
            width: 210mm !important; height: 297mm !important;
            margin: 0 !important; padding: 8mm 8mm !important;
            border: none !important; box-shadow: none !important;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}