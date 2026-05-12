import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';

const TODAY = format(new Date(), 'dd-MM-yyyy');

// TR logo SVG matching the Técnicas Reunidas logo from the template
const TRLogo = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
    {/* Helmet icon - simplified version matching the template */}
    <svg width="36" height="28" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Hard hat shape */}
      <path d="M4 20 Q4 10 18 8 Q32 10 32 20 Z" fill="#1a3c6e" />
      <rect x="2" y="20" width="32" height="3" rx="1.5" fill="#1a3c6e" />
      <rect x="14" y="4" width="8" height="6" rx="2" fill="#1a3c6e" />
    </svg>
    <div style={{ fontSize: '5.5px', fontWeight: '700', color: '#1a3c6e', letterSpacing: '0.3px', lineHeight: '1.1', textAlign: 'center' }}>
      TÉCNICAS<br/>REUNIDAS
    </div>
  </div>
);

// Single passport card — exactly matching the uploaded template layout
function PassportCard({ person, craft, dateIssued, dateEmployment, isEmpty }) {
  const S = {
    card: {
      width: '92mm',
      height: '128mm',
      border: '2.5px solid #222',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '9.5px',
      boxSizing: 'border-box',
      backgroundColor: 'white',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    },
    topSection: {
      display: 'flex',
      borderBottom: '2px solid #222',
      minHeight: '52mm',
    },
    photoBox: {
      width: '38mm',
      borderRight: '2px solid #222',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '9px',
      color: '#888',
      backgroundColor: '#fff',
      flexShrink: 0,
      position: 'relative',
    },
    logoArea: {
      flex: 1,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'flex-end',
      padding: '5px 6px 4px 4px',
    },
    fieldRow: {
      display: 'flex',
      borderBottom: '1.5px solid #222',
      minHeight: '8.5mm',
      alignItems: 'stretch',
    },
    fieldLabel: {
      fontWeight: 'bold',
      fontSize: '8px',
      padding: '3px 4px',
      borderRight: '1.5px solid #222',
      width: '30mm',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      whiteSpace: 'nowrap',
      backgroundColor: '#fff',
    },
    fieldValue: {
      fontSize: '8px',
      padding: '3px 5px',
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      wordBreak: 'break-word',
      backgroundColor: '#fff',
    },
    signatureRow: {
      display: 'flex',
      flex: 1,
      borderBottom: 'none',
      minHeight: '12mm',
      alignItems: 'stretch',
    },
  };

  const fields = [
    { label: 'NAME:', value: isEmpty ? '' : (person?.name || '') },
    { label: 'ID NO:', value: isEmpty ? '' : (person?.qid_no || '') },
    { label: 'NATIONALITY:', value: isEmpty ? '' : (person?.nationality || '') },
    { label: 'MOBILE NO:', value: isEmpty ? '' : (person?.contact_details || '') },
    { label: 'COMPANY:', value: 'GSO' },
    { label: 'CRAFT:', value: isEmpty ? '' : (craft || '') },
    { label: 'POSITION:', value: isEmpty ? '' : (person?.designation_org_chart || '') },
    { label: 'DATE ISSUED:', value: isEmpty ? '' : (dateIssued || '') },
    { label: 'DATE OF EMPLOYMENT:', value: isEmpty ? '' : (dateEmployment || '') },
  ];

  return (
    <div style={S.card}>
      {/* Top: Photo + Logo */}
      <div style={S.topSection}>
        <div style={S.photoBox}>
          {person?.photo_url && !isEmpty
            ? <img src={person.photo_url} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
            : <span style={{ fontSize: '10px', color: '#aaa', letterSpacing: '1px' }}>PHOTO</span>
          }
        </div>
        <div style={S.logoArea}>
          <TRLogo />
        </div>
      </div>

      {/* Data fields */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {fields.map(({ label, value }) => (
          <div key={label} style={S.fieldRow}>
            <div style={S.fieldLabel}>{label}</div>
            <div style={S.fieldValue}>{value}</div>
          </div>
        ))}
        {/* Signature row — last, no bottom border from outer */}
        <div style={{ ...S.signatureRow, borderBottom: 'none' }}>
          <div style={{ ...S.fieldLabel, borderBottom: 'none' }}>SIGNATURE:</div>
          <div style={{ ...S.fieldValue, borderBottom: 'none' }}></div>
        </div>
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

  // Always show at least 4 cards (one full page), pad with empty cards to fill the last page
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
            padding: '10mm 8mm',
            boxSizing: 'border-box',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gap: '6mm',
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
            margin: 0 !important; padding: 10mm 8mm !important;
            border: none !important; box-shadow: none !important;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}