import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer, ArrowLeft, X, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

// Company list from Employee entity schema
const COMPANY_LIST = [
  'GSO QATAR','ITELLIGENT','ANION','SEA QUEEN','LMV E AND I','METAL WORLD','ASMA','FIT',
  'SPRAY CON','EMKAN','ENERTEC','CRYSTAL','MEGATRONICS (GSO)','ENERSERVE (GSO)',
  'ENERTEC (GSO)','NTC (GSO)','MIR (GSO)','ALTAF (GSO)','SWAN GLOBAL (GSO)',
  'SIGEL (GSO)','AL-RAMSHA (GSO)','ALTHAF (GSO)','ZEAL-IT'
];

function CompanyAutocomplete({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  const suggestions = COMPANY_LIST.filter(c =>
    value && c.toLowerCase().includes(value.toLowerCase()) && c.toLowerCase() !== value.toLowerCase()
  );

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map(c => (
            <button
              key={c}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
              onMouseDown={() => { onChange(c); setOpen(false); }}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const TODAY = format(new Date(), 'dd-MMM-yy');

export default function TransmittalForm() {
  const navigate = useNavigate();
  const printRef = useRef();

  const [fromName, setFromName] = useState('');
  const [refPrefix, setRefPrefix] = useState('NFE-TN-');
  const [refSuffix, setRefSuffix] = useState('');
  const [originator, setOriginator] = useState('');
  const [toCompany, setToCompany] = useState('');
  const [attention, setAttention] = useState('');
  const [telephone, setTelephone] = useState('');
  const [receivedByCompany, setReceivedByCompany] = useState('');
  const [forwardedByName, setForwardedByName] = useState('JHEDSON');
  const [viaHandDelivery, setViaHandDelivery] = useState(true);
  const [viaCourier, setViaCourier] = useState(false);

  // Transmitting checkboxes
  const [txDrawings, setTxDrawings] = useState(false);
  const [txMobilization, setTxMobilization] = useState(false);
  const [txSpecifications, setTxSpecifications] = useState(false);
  const [txLetter, setTxLetter] = useState(false);
  const [txRlicPass, setTxRlicPass] = useState(true);
  const [txPidPassport, setTxPidPassport] = useState(false);
  const [txOthers, setTxOthers] = useState(false);
  const [txOthersText, setTxOthersText] = useState('');
  const [txAsStated, setTxAsStated] = useState(false);

  // Personnel search & selection
  const [search, setSearch] = useState('');
  const [selectedPersonnel, setSelectedPersonnel] = useState([]);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }),
  });

  const filtered = employees.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.name?.toLowerCase().includes(q) ||
      e.qid_no?.toLowerCase().includes(q) ||
      e.company?.toLowerCase().includes(q)
    );
  }).filter(e => !selectedPersonnel.find(s => s.id === e.id));

  const addPersonnel = (emp) => {
    setSelectedPersonnel(prev => [...prev, emp]);
    setSearch('');
  };

  const removePersonnel = (id) => {
    setSelectedPersonnel(prev => prev.filter(p => p.id !== id));
  };

  const handlePrint = () => {
    window.print();
  };

  // Derive Hard Copy label from "Transmitting the following" checkboxes
  const hardCopyLabel = [
    txDrawings && 'DRAWINGS',
    txMobilization && 'MOBILIZATION',
    txSpecifications && 'SPECIFICATIONS',
    txLetter && 'LETTER',
    txRlicPass && 'RLIC PASS',
    txPidPassport && 'PID & PASSPORT',
    txOthers && txOthersText && txOthersText.toUpperCase(),
    txAsStated && 'AS STATED',
  ].filter(Boolean).join(', ') || '—';

  // Build rows: selected personnel + empty rows to fill the table (min 9 rows shown, rest blank)
  const MIN_ROWS = 9;
  const blankCount = Math.max(0, MIN_ROWS - selectedPersonnel.length);
  const blankRows = Array.from({ length: blankCount });

  return (
    <div className="space-y-4">
      {/* Controls — hidden when printing */}
      <div className="no-print space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-xl font-bold">Transmittal Form</h2>
          <div className="flex-1" />
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Print / Export PDF
          </Button>
        </div>

        {/* Header fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white border rounded-lg p-4">
          <div><label className="text-xs font-medium block mb-1">From</label><Input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="From name" /></div>
          <div><label className="text-xs font-medium block mb-1">Originator</label><Input value={originator} onChange={e => setOriginator(e.target.value)} placeholder="Originator" /></div>
          <div>
            <label className="text-xs font-medium block mb-1">Trans. Ref. No.</label>
            <div className="flex items-center gap-3 mb-1">
              {['NFE-TN-', 'RLIC-TN-'].map(p => (
                <label key={p} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" name="refPrefix" value={p} checked={refPrefix === p} onChange={() => setRefPrefix(p)} className="w-4 h-4" />
                  {p}
                </label>
              ))}
            </div>
            <Input value={refSuffix} onChange={e => setRefSuffix(e.target.value)} placeholder="26-138" />
          </div>
          <div><label className="text-xs font-medium block mb-1">To (Company)</label><CompanyAutocomplete value={toCompany} onChange={setToCompany} placeholder="Company" /></div>
          <div><label className="text-xs font-medium block mb-1">Attention</label><Input value={attention} onChange={e => setAttention(e.target.value)} placeholder="Attention" /></div>
          <div><label className="text-xs font-medium block mb-1">Telephone No.</label><Input value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="Telephone" /></div>
          <div><label className="text-xs font-medium block mb-1">Forwarded By (Name)</label><Input value={forwardedByName} onChange={e => setForwardedByName(e.target.value)} placeholder="Name" /></div>
          <div><label className="text-xs font-medium block mb-1">Received By (Company)</label><CompanyAutocomplete value={receivedByCompany} onChange={setReceivedByCompany} placeholder="Company" /></div>
          <div className="flex items-end gap-4 pb-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={viaHandDelivery} onChange={e => setViaHandDelivery(e.target.checked)} className="w-4 h-4" /> Hand Delivery
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={viaCourier} onChange={e => setViaCourier(e.target.checked)} className="w-4 h-4" /> Courier
            </label>
          </div>
          <div className="md:col-span-3">
            <label className="text-xs font-medium block mb-2">Transmitting the following</label>
            <div className="flex flex-wrap gap-3">
              {[
                ['Drawings', txDrawings, setTxDrawings],
                ['Mobilization', txMobilization, setTxMobilization],
                ['Specifications', txSpecifications, setTxSpecifications],
                ['Letter', txLetter, setTxLetter],
                ['RLIC Pass', txRlicPass, setTxRlicPass],
                ['PID & Passport', txPidPassport, setTxPidPassport],
                ['As stated', txAsStated, setTxAsStated],
              ].map(([label, checked, setter]) => (
                <label key={label} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={e => setter(e.target.checked)} className="w-4 h-4" /> {label}
                </label>
              ))}
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={txOthers} onChange={e => setTxOthers(e.target.checked)} className="w-4 h-4" /> Others:
              </label>
              {txOthers && <Input className="w-36 h-7 text-sm" value={txOthersText} onChange={e => setTxOthersText(e.target.value)} placeholder="specify..." />}
            </div>
          </div>
        </div>

        {/* Personnel search */}
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold">Select Personnel</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, QID, or company..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {search && filtered.length > 0 && (
            <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
              {filtered.slice(0, 20).map(emp => (
                <button
                  key={emp.id}
                  onClick={() => addPersonnel(emp)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-sm"
                >
                  <span className="font-medium">{emp.name}</span>
                  <span className="text-muted-foreground text-xs">{emp.qid_no} · {emp.company}</span>
                </button>
              ))}
            </div>
          )}
          {search && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">No personnel found.</p>
          )}
          {selectedPersonnel.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedPersonnel.map(p => (
                <span key={p.id} className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full font-medium">
                  {p.name}
                  <button onClick={() => removePersonnel(p.id)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== PRINTABLE TRANSMITTAL ===== */}
      <div ref={printRef} className="transmittal-page bg-white text-black" style={{ fontFamily: 'Arial, sans-serif', fontSize: '10px', width: '210mm', minHeight: '297mm', margin: '0 auto', padding: '10mm 12mm', boxSizing: 'border-box', border: '1px solid #ccc' }}>

        {/* Logo + outer border */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid black' }}>
          <tbody>
            {/* Logo row */}
            <tr>
              <td colSpan={7} style={{ padding: '6px 10px', borderBottom: '2px solid black' }}>
                <img
                  src="https://media.base44.com/images/public/69ce3261a82ad7bdfb8d8300/d1f8aeb83_Logo.png"
                  alt="GSO Qatar"
                  style={{ height: '48px', objectFit: 'contain' }}
                />
              </td>
            </tr>

            {/* TRANSMITTAL title */}
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', backgroundColor: '#1a3c6e', color: 'white', fontWeight: 'bold', fontSize: '16px', letterSpacing: '2px', padding: '6px', borderBottom: '2px solid black' }}>
                TRANSMITTAL
              </td>
            </tr>

            {/* From / Trans Ref */}
            <tr style={{ borderBottom: '1px solid black' }}>
              <td style={{ padding: '3px 6px', whiteSpace: 'nowrap', fontWeight: 'bold', width: '70px' }}>From:</td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid black', minWidth: '160px' }}>{fromName}</td>
              <td style={{ padding: '3px 6px', whiteSpace: 'nowrap', fontWeight: 'bold' }}>Trans. Ref. No.</td>
              <td colSpan={4} style={{ padding: '3px 6px', fontWeight: 'bold' }}>{refPrefix}{refSuffix}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid black' }}>
              <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>Originator:</td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid black' }}>{originator}</td>
              <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>Date Transmitted:</td>
              <td colSpan={4} style={{ padding: '3px 6px' }}>{TODAY}</td>
            </tr>

            {/* To / Telephone */}
            <tr style={{ borderBottom: '1px solid black' }}>
              <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>To:</td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid black' }}>{toCompany}</td>
              <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>Telephone No.:</td>
              <td colSpan={4} style={{ padding: '3px 6px' }}>{telephone}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid black' }}>
              <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>Attention:</td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid black' }}>{attention}</td>
              <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>Fax Number:</td>
              <td colSpan={4} style={{ padding: '3px 6px' }}></td>
            </tr>

            {/* Transmitting */}
            <tr style={{ borderBottom: '1px solid black' }}>
              <td colSpan={7} style={{ padding: '5px 6px' }}>
                <span style={{ fontWeight: 'bold' }}>Transmitting the following:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '5px', flexWrap: 'nowrap' }}>
                  {[
                    ['Drawings', txDrawings],
                    ['Mobilization', txMobilization],
                    ['Specifications', txSpecifications],
                    ['Letter', txLetter],
                    ['RLIC Pass', txRlicPass],
                    ['PID & Passport', txPidPassport],
                  ].map(([label, checked]) => (
                    <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', width: '11px', height: '11px', border: '1px solid black', textAlign: 'center', lineHeight: '10px', fontSize: '9px', flexShrink: 0 }}>{checked ? '✓' : ''}</span>
                      {label}
                    </span>
                  ))}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-block', width: '11px', height: '11px', border: '1px solid black', textAlign: 'center', lineHeight: '10px', fontSize: '9px', flexShrink: 0 }}>{txOthers ? '✓' : ''}</span>
                    Others: <span style={{ borderBottom: '1px solid black', minWidth: '60px', display: 'inline-block' }}>{txOthersText}</span>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-block', width: '11px', height: '11px', border: '1px solid black', textAlign: 'center', lineHeight: '10px', fontSize: '9px', flexShrink: 0 }}>{txAsStated ? '✓' : ''}</span>
                    As stated
                  </span>
                </div>
              </td>
            </tr>

            {/* VIA */}
            <tr style={{ borderBottom: '2px solid black' }}>
              <td colSpan={7} style={{ padding: '3px 6px' }}>
                <span style={{ fontWeight: 'bold' }}>VIA</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '12px' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '1px solid black', textAlign: 'center', lineHeight: '12px', fontSize: '10px' }}>{viaCourier ? '✓' : ''}</span> Courier
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '24px' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '1px solid black', textAlign: 'center', lineHeight: '12px', fontSize: '10px' }}>{viaHandDelivery ? '✓' : ''}</span> Hand delivery
                </span>
              </td>
            </tr>

            {/* Table header */}
            <tr style={{ backgroundColor: '#1a3c6e', color: 'white', borderBottom: '1px solid black' }}>
              <td style={{ padding: '4px 6px', textAlign: 'center', width: '30px', borderRight: '1px solid #fff', fontWeight: 'bold' }}>SI No.</td>
              <td style={{ padding: '4px 6px', textAlign: 'center', width: '90px', borderRight: '1px solid #fff', fontWeight: 'bold' }}>QID</td>
              <td style={{ padding: '4px 6px', textAlign: 'center', borderRight: '1px solid #fff', fontWeight: 'bold' }}>Description</td>
              <td style={{ padding: '4px 6px', textAlign: 'center', width: '30px', borderRight: '1px solid #fff', fontWeight: 'bold' }}>Unit</td>
              <td style={{ padding: '4px 6px', textAlign: 'center', width: '65px', borderRight: '1px solid #fff', fontWeight: 'bold' }}>Hard Copy</td>
              <td style={{ padding: '4px 6px', textAlign: 'center', width: '55px', fontWeight: 'bold' }}>Soft copy</td>
            </tr>

            {/* Personnel rows */}
            {selectedPersonnel.map((emp, i) => (
              <tr key={emp.id} style={{ borderBottom: '1px solid #999' }}>
                <td style={{ padding: '3px 6px', textAlign: 'center', borderRight: '1px solid #999' }}>{i + 1}</td>
                <td style={{ padding: '3px 6px', textAlign: 'center', borderRight: '1px solid #999', fontFamily: 'monospace' }}>{emp.qid_no || ''}</td>
                <td style={{ padding: '3px 6px', borderRight: '1px solid #999' }}>RLIC - {emp.name}</td>
                <td style={{ padding: '3px 6px', textAlign: 'center', borderRight: '1px solid #999' }}>1</td>
                <td style={{ padding: '3px 6px', textAlign: 'center', borderRight: '1px solid #999' }}>{hardCopyLabel}</td>
                <td style={{ padding: '3px 6px', textAlign: 'center' }}>-</td>
              </tr>
            ))}

            {/* NOTHING FOLLOWS row */}
            <tr style={{ borderBottom: '1px solid #999' }}>
              <td style={{ padding: '3px 6px', textAlign: 'center', borderRight: '1px solid #999' }}></td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid #999' }}></td>
              <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 'bold', borderRight: '1px solid #999' }}>NOTHING FOLLOWS</td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid #999' }}></td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid #999' }}></td>
              <td style={{ padding: '3px 6px' }}></td>
            </tr>

            {/* Blank rows */}
            {blankRows.map((_, i) => (
              <tr key={`blank-${i}`} style={{ borderBottom: '1px solid #ddd', height: '20px' }}>
                <td style={{ borderRight: '1px solid #ddd' }}></td>
                <td style={{ borderRight: '1px solid #ddd' }}></td>
                <td style={{ borderRight: '1px solid #ddd' }}></td>
                <td style={{ borderRight: '1px solid #ddd' }}></td>
                <td style={{ borderRight: '1px solid #ddd' }}></td>
                <td></td>
              </tr>
            ))}

            {/* Important notice */}
            <tr style={{ borderTop: '1px solid black', borderBottom: '1px solid black' }}>
              <td colSpan={6} style={{ padding: '4px 6px', fontSize: '8.5px', fontStyle: 'italic' }}>
                Important Notice: A fee will be charged for the <strong>replacement</strong> of lost, stolen or damaged card. The cost of replacement must be borne by the cardholder
              </td>
            </tr>

            {/* Signatures */}
            <tr>
              <td colSpan={3} style={{ padding: '6px', borderRight: '1px solid black', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Forwarded by:</div>
                <table style={{ width: '100%' }}>
                  <tbody>
                    <tr><td style={{ paddingBottom: '3px', width: '70px' }}>Name</td><td style={{ paddingBottom: '3px' }}>: {forwardedByName}</td></tr>
                    <tr><td style={{ paddingBottom: '3px' }}>Signature</td><td style={{ paddingBottom: '3px' }}>:</td></tr>
                    <tr><td>Date</td><td>: {TODAY}</td></tr>
                  </tbody>
                </table>
              </td>
              <td colSpan={4} style={{ padding: '6px', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Received by:</div>
                <table style={{ width: '100%' }}>
                  <tbody>
                    <tr><td style={{ paddingBottom: '3px', width: '70px' }}>Name</td><td style={{ paddingBottom: '3px' }}>: {receivedByCompany}</td></tr>
                    <tr><td style={{ paddingBottom: '3px' }}>Signature</td><td style={{ paddingBottom: '3px' }}>:</td></tr>
                    <tr><td>Date</td><td>:</td></tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '9px', color: '#555' }}>
          <span>Q HR Form_2025-0003</span>
          <span>Page 1 of 1</span>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }

          /* Hide everything, then show only the form */
          body * { visibility: hidden !important; }
          .transmittal-page, .transmittal-page * { visibility: visible !important; }
          .no-print { display: none !important; }

          /* Reset body & html so the form fits cleanly */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          /* Fit the form to the A4 page */
          .transmittal-page {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            font-size: 9px !important;
          }

          /* Force background colors and images to print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}