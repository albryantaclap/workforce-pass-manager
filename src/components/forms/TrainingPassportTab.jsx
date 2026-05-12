import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';

const TODAY = format(new Date(), 'dd-MM-yyyy');

// Single passport card — fits 4 per A4 page (2×2)
// Card total height budget: (297mm - 20mm padding - 3×6mm gaps) / 2 = ~124mm
// Top section: 38mm, 9 data rows × 6.5mm = 58.5mm, signature 12mm → ~108.5mm total ✓
function PassportCard({ person, craft, dateIssued, dateEmployment, isEmpty }) {
  const cardStyle = {
    width: '76mm',
    height: '115mm',
    border: '1px solid #000',
    fontFamily: 'Arial, Helvetica, sans-serif',
    boxSizing: 'border-box',
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const topSectionStyle = {
    backgroundColor: '#fff',
    borderBottom: '1px solid #000',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '4px 5px',
    height: '38mm',
    flexShrink: 0,
    boxSizing: 'border-box',
  };

  const photoBoxStyle = {
    width: '36mm',
    height: '34mm',
    border: '1px solid #000',
    backgroundColor: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box',
    marginBottom: '2mm',
  };

  const logoAreaStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    flex: 1,
    paddingLeft: '4px',
  };

  const AUTO_HEIGHT_ROWS = new Set(['NAME:', 'POSITION:']);

  const fieldRowStyle = {
    display: 'flex',
    borderBottom: '0.75px solid #000',
    minHeight: '6.5mm',
    alignItems: 'stretch',
    boxSizing: 'border-box',
    flexShrink: 0,
  };

  const labelStyle = {
    fontWeight: 'bold',
    fontSize: '10.8px',
    padding: '1px 3px',
    borderRight: '0.75px solid #000',
    width: '38mm',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
  };

  const valueStyle = {
    fontSize: '10.8px',
    fontWeight: 'bold',
    padding: '1px 3px',
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    boxSizing: 'border-box',
  };

  const GRAY_ROWS = new Set(['NAME:', 'NATIONALITY:', 'COMPANY:', 'POSITION:', 'DATE OF EMPLOYMENT:']);

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
    <div style={cardStyle}>
      {/* Top section: photo left, TR logo top-right */}
      <div style={topSectionStyle}>
        <div style={photoBoxStyle}>
          {person?.photo_url && !isEmpty
            ? <img src={person.photo_url} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
            : <span style={{ fontSize: '9.6px', color: '#666', fontWeight: 'bold', letterSpacing: '1px' }}>PHOTO</span>
          }
        </div>
        <div style={logoAreaStyle}>
          <img
            src="https://media.base44.com/images/public/69ce3261a82ad7bdfb8d8300/e1a744b04_image.png"
            alt="Tecnicas Reunidas Logo"
            style={{ height: '56px', objectFit: 'contain' }}
          />
        </div>
      </div>

      {/* Data fields */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {fields.map(({ label, value }) => {
          const rowBg = GRAY_ROWS.has(label) ? '#d9d9d9' : '#fff';
          const isAutoHeight = AUTO_HEIGHT_ROWS.has(label);
          return (
            <div key={label} style={{ ...fieldRowStyle, height: isAutoHeight ? 'auto' : '6.5mm', minHeight: '6.5mm' }}>
              <div style={{ ...labelStyle, backgroundColor: rowBg, alignItems: isAutoHeight ? 'flex-start' : 'center', paddingTop: isAutoHeight ? '2px' : '1px' }}>{label}</div>
              <div style={{ ...valueStyle, backgroundColor: rowBg, alignItems: isAutoHeight ? 'flex-start' : 'center', paddingTop: isAutoHeight ? '2px' : '1px', flexWrap: 'wrap' }}>{value}</div>
            </div>
          );
        })}
        {/* Signature row — taller than normal rows */}
        <div style={{ ...fieldRowStyle, borderBottom: 'none', height: '6.5mm', flex: 1 }}>
          <div style={{ ...labelStyle, backgroundColor: '#d9d9d9', alignItems: 'flex-start', paddingTop: '3px', fontSize: '10.8px', fontWeight: 'bold' }}>SIGNATURE:</div>
          <div style={{ ...valueStyle, backgroundColor: '#fff' }}></div>
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
            padding: '5mm 8mm',
            boxSizing: 'border-box',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: 'auto auto',
            gap: '6mm',
            alignContent: 'start',
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
          @page { size: A4 portrait; margin: 5mm 8mm; }
          .no-print { display: none !important; }
          body * { visibility: hidden !important; }
          .printable-area, .printable-area * { visibility: visible !important; }
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          .printable-area {
            position: relative !important;
            width: 100% !important; height: auto !important;
            margin: 0 !important; padding: 0 !important;
            border: none !important; box-shadow: none !important;
            page-break-after: always;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}