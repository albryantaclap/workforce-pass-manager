import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';

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
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <Input value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={placeholder} />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map(c => (
            <button key={c} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
              onMouseDown={() => { onChange(c); setOpen(false); }}>{c}</button>
          ))}
        </div>
      )}
    </div>
  );
}

const TODAY = format(new Date(), 'dd-MMM-yy');

export default function TransmittalFormTab({ selectedPersonnel }) {
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
  const [txMF, setTxMF] = useState(false);
  const [txPP, setTxPP] = useState(false);
  const [txPID, setTxPID] = useState(false);
  const [txCRFT, setTxCRFT] = useState(false);
  const [txOthers, setTxOthers] = useState(false);
  const [txOthersText, setTxOthersText] = useState('');

  const hardCopyLabel = [
    txMF && 'MF', txPP && 'PP', txPID && 'PID', txCRFT && 'CRFT',
    txOthers && txOthersText && txOthersText.toUpperCase(),
  ].filter(Boolean).join(', ') || '—';

  const MIN_ROWS = 9;
  const blankCount = Math.max(0, MIN_ROWS - selectedPersonnel.length);

  const handlePrint = () => window.print();

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="no-print bg-white border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Transmittal Form Settings</h3>
          <Button onClick={handlePrint} className="gap-2"><Printer className="w-4 h-4" /> Print / Export PDF</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><label className="text-xs font-medium block mb-1">From</label><Input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="From name" /></div>
          <div><label className="text-xs font-medium block mb-1">Originator</label><Input value={originator} onChange={e => setOriginator(e.target.value)} placeholder="Originator" /></div>
          <div>
            <label className="text-xs font-medium block mb-1">Trans. Ref. No.</label>
            <div className="flex items-center gap-3 mb-1">
              {['NFE-TN-', 'RLIC-TN-'].map(p => (
                <label key={p} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" name="refPrefix" value={p} checked={refPrefix === p} onChange={() => setRefPrefix(p)} className="w-4 h-4" /> {p}
                </label>
              ))}
            </div>
            <Input value={refSuffix} onChange={e => setRefSuffix(e.target.value)} placeholder="26-138" />
          </div>
          <div><label className="text-xs font-medium block mb-1">To (Company)</label><CompanyAutocomplete value={toCompany} onChange={setToCompany} placeholder="Company" /></div>
          <div><label className="text-xs font-medium block mb-1">Attention</label><Input value={attention} onChange={e => setAttention(e.target.value)} placeholder="Attention" /></div>
          <div><label className="text-xs font-medium block mb-1">Telephone No.</label><Input value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="Telephone" /></div>
          <div><label className="text-xs font-medium block mb-1">Forwarded By</label><Input value={forwardedByName} onChange={e => setForwardedByName(e.target.value)} placeholder="Name" /></div>
          <div><label className="text-xs font-medium block mb-1">Received By</label><CompanyAutocomplete value={receivedByCompany} onChange={setReceivedByCompany} placeholder="Company" /></div>
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
              {[['MF', txMF, setTxMF], ['PP', txPP, setTxPP], ['PID', txPID, setTxPID], ['CRFT', txCRFT, setTxCRFT]].map(([label, checked, setter]) => (
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
      </div>

      {/* Printable form */}
      <div className="printable-area bg-white text-black" style={{ fontFamily: 'Arial, sans-serif', fontSize: '10px', width: '210mm', minHeight: '297mm', margin: '0 auto', padding: '10mm 12mm', boxSizing: 'border-box', border: '1px solid #ccc' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid black' }}>
          <tbody>
            <tr>
              <td colSpan={6} style={{ padding: '6px 10px', borderBottom: '2px solid black' }}>
                <img src="https://media.base44.com/images/public/69ce3261a82ad7bdfb8d8300/d1f8aeb83_Logo.png" alt="GSO Qatar" style={{ height: '48px', objectFit: 'contain' }} />
              </td>
            </tr>
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', backgroundColor: '#1a3c6e', color: 'white', fontWeight: 'bold', fontSize: '16px', letterSpacing: '2px', padding: '6px', borderBottom: '2px solid black' }}>
                TRANSMITTAL
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid black' }}>
              <td style={{ padding: '3px 6px', fontWeight: 'bold', width: '70px' }}>From:</td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid black', minWidth: '160px' }}>{fromName}</td>
              <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>Trans. Ref. No.</td>
              <td colSpan={3} style={{ padding: '3px 6px', fontWeight: 'bold' }}>{refPrefix}{refSuffix}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid black' }}>
              <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>Originator:</td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid black' }}>{originator}</td>
              <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>Date Transmitted:</td>
              <td colSpan={3} style={{ padding: '3px 6px' }}>{TODAY}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid black' }}>
              <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>To:</td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid black' }}>{toCompany}</td>
              <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>Telephone No.:</td>
              <td colSpan={3} style={{ padding: '3px 6px' }}>{telephone}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid black' }}>
              <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>Attention:</td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid black' }}>{attention}</td>
              <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>Fax Number:</td>
              <td colSpan={3} style={{ padding: '3px 6px' }}></td>
            </tr>
            <tr style={{ borderBottom: '1px solid black' }}>
              <td colSpan={6} style={{ padding: '5px 6px' }}>
                <span style={{ fontWeight: 'bold' }}>Transmitting the following:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '5px' }}>
                  {[['MF', txMF], ['PP', txPP], ['PID', txPID], ['CRFT', txCRFT]].map(([label, checked]) => (
                    <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <span style={{ display: 'inline-block', width: '11px', height: '11px', border: '1px solid black', textAlign: 'center', lineHeight: '10px', fontSize: '9px' }}>{checked ? '✓' : ''}</span>
                      {label}
                    </span>
                  ))}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ display: 'inline-block', width: '11px', height: '11px', border: '1px solid black', textAlign: 'center', lineHeight: '10px', fontSize: '9px' }}>{txOthers ? '✓' : ''}</span>
                    Others: <span style={{ borderBottom: '1px solid black', minWidth: '60px', display: 'inline-block' }}>{txOthersText}</span>
                  </span>
                </div>
              </td>
            </tr>
            <tr style={{ borderBottom: '2px solid black' }}>
              <td colSpan={6} style={{ padding: '3px 6px' }}>
                <span style={{ fontWeight: 'bold' }}>VIA</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '12px' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '1px solid black', textAlign: 'center', lineHeight: '12px', fontSize: '10px' }}>{viaCourier ? '✓' : ''}</span> Courier
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '24px' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '1px solid black', textAlign: 'center', lineHeight: '12px', fontSize: '10px' }}>{viaHandDelivery ? '✓' : ''}</span> Hand delivery
                </span>
              </td>
            </tr>
            <tr style={{ backgroundColor: '#1a3c6e', color: 'white', borderBottom: '1px solid black' }}>
              <td style={{ padding: '4px 6px', textAlign: 'center', width: '30px', borderRight: '1px solid #fff', fontWeight: 'bold' }}>SI No.</td>
              <td style={{ padding: '4px 6px', textAlign: 'center', width: '90px', borderRight: '1px solid #fff', fontWeight: 'bold' }}>QID</td>
              <td style={{ padding: '4px 6px', textAlign: 'center', borderRight: '1px solid #fff', fontWeight: 'bold' }}>Description</td>
              <td style={{ padding: '4px 6px', textAlign: 'center', width: '30px', borderRight: '1px solid #fff', fontWeight: 'bold' }}>Unit</td>
              <td style={{ padding: '4px 6px', textAlign: 'center', width: '65px', borderRight: '1px solid #fff', fontWeight: 'bold' }}>Hard Copy</td>
              <td style={{ padding: '4px 6px', textAlign: 'center', width: '55px', fontWeight: 'bold' }}>Soft copy</td>
            </tr>
            {selectedPersonnel.map((emp, i) => (
              <tr key={emp.id} style={{ borderBottom: '1px solid #999' }}>
                <td style={{ padding: '3px 6px', textAlign: 'center', borderRight: '1px solid #999' }}>{i + 1}</td>
                <td style={{ padding: '3px 6px', textAlign: 'center', borderRight: '1px solid #999', fontFamily: 'monospace' }}>{emp.qid_no || ''}</td>
                <td style={{ padding: '3px 6px', borderRight: '1px solid #999' }}>{emp.name}{emp.position_application ? ` - ${emp.position_application}` : ''}</td>
                <td style={{ padding: '3px 6px', textAlign: 'center', borderRight: '1px solid #999' }}>1</td>
                <td style={{ padding: '3px 6px', textAlign: 'center', borderRight: '1px solid #999' }}>{hardCopyLabel}</td>
                <td style={{ padding: '3px 6px', textAlign: 'center' }}>-</td>
              </tr>
            ))}
            <tr style={{ borderBottom: '1px solid #999' }}>
              <td style={{ padding: '3px 6px', borderRight: '1px solid #999' }}></td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid #999' }}></td>
              <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 'bold', borderRight: '1px solid #999' }}>NOTHING FOLLOWS</td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid #999' }}></td>
              <td style={{ padding: '3px 6px', borderRight: '1px solid #999' }}></td>
              <td></td>
            </tr>
            {Array.from({ length: blankCount }).map((_, i) => (
              <tr key={`blank-${i}`} style={{ borderBottom: '1px solid #ddd', height: '20px' }}>
                <td style={{ borderRight: '1px solid #ddd' }}></td>
                <td style={{ borderRight: '1px solid #ddd' }}></td>
                <td style={{ borderRight: '1px solid #ddd' }}></td>
                <td style={{ borderRight: '1px solid #ddd' }}></td>
                <td style={{ borderRight: '1px solid #ddd' }}></td>
                <td></td>
              </tr>
            ))}
            <tr style={{ borderTop: '1px solid black', borderBottom: '1px solid black' }}>
              <td colSpan={6} style={{ padding: '4px 6px', fontSize: '8.5px', fontStyle: 'italic' }}>
                Important Notice: A fee will be charged for the <strong>replacement</strong> of lost, stolen or damaged card. The cost of replacement must be borne by the cardholder
              </td>
            </tr>
            <tr>
              <td colSpan={3} style={{ padding: '6px', borderRight: '1px solid black', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Forwarded by:</div>
                <table style={{ width: '100%' }}><tbody>
                  <tr><td style={{ paddingBottom: '3px', width: '70px' }}>Name</td><td>: {forwardedByName}</td></tr>
                  <tr><td style={{ paddingBottom: '3px' }}>Signature</td><td>:</td></tr>
                  <tr><td>Date</td><td>: {TODAY}</td></tr>
                </tbody></table>
              </td>
              <td colSpan={3} style={{ padding: '6px', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Received by:</div>
                <table style={{ width: '100%' }}><tbody>
                  <tr><td style={{ paddingBottom: '3px', width: '70px' }}>Name</td><td>: {receivedByCompany}</td></tr>
                  <tr><td style={{ paddingBottom: '3px' }}>Signature</td><td>:</td></tr>
                  <tr><td>Date</td><td>:</td></tr>
                </tbody></table>
              </td>
            </tr>
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '9px', color: '#555' }}>
          <span>Q HR Form_2025-0003</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  );
}