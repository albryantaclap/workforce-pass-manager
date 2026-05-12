import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';

const TODAY = format(new Date(), 'dd-MM-yyyy');

const SectionHeader = ({ number, title, colSpan = 12 }) => (
  <tr>
    <td colSpan={colSpan} style={{
      backgroundColor: '#1e3a5f',
      color: 'white',
      fontWeight: 'bold',
      fontSize: '8.5px',
      padding: '2.5px 6px',
      letterSpacing: '0.2px',
    }}>
      {number}. {title}
    </td>
  </tr>
);

const CB = ({ checked }) => (
  <span style={{
    display: 'inline-block',
    width: '9px', height: '9px',
    border: '1px solid #333',
    textAlign: 'center',
    lineHeight: '8px',
    fontSize: '7px',
    verticalAlign: 'middle',
    marginRight: '2px',
    backgroundColor: 'white',
    flexShrink: 0,
  }}>
    {checked ? '✓' : ''}
  </span>
);

const StampCircle = () => (
  <div style={{
    position: 'absolute',
    right: '6px',
    bottom: '4px',
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    border: '1px solid #aaa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '6.5px',
    color: '#888',
    backgroundColor: 'white',
  }}>Stamp</div>
);

const TRAINING_ITEMS = [
  ['SHES Induction', 'Chemical Awareness', 'Respiratory Protection', 'Bus Captain', 'LOTO', 'POSC'],
  ['Dispensing Fuel', 'Fire & Muster Warden', 'Spill Pre & Response', 'Heat Stress', 'LORO CP', 'PTW'],
  ['Electrical Safety', 'Flagman & Banksman', 'Tipper Truck Control', 'Hole Watch', 'CSE', 'DD'],
  ['Excavation Safety', 'Hand & Power Tools', 'Waste Management', 'PW Handling', 'WAH', null],
  ['Lifting & Rigging', 'Harness Inspection', null, 'Tire Safety', 'LMRA', null],
];
const THIRD_PARTY_ITEMS = [
  ['Crane Operator', 'Equipment Operator', 'Scaffolder', 'BLS/FA/CPR', 'PIMT', 'AGT'],
  ['Rigger', 'Fire Watch', 'Others (if any)', null, null, null],
];
const PPE_ITEMS = ['Coverall', 'Safety Shoes', 'Helmet', 'Safety Glass (Clear & Dark)', 'Hand Gloves', 'Water Bottle'];

const B = '0.75px solid #aaa';
const BB = '1px solid #333';

export default function MobilizationFormTab({ selectedPersonnel }) {
  const [projectType, setProjectType] = useState('');
  const [projectIdNumber, setProjectIdNumber] = useState('');
  const [staffNo, setStaffNo] = useState('');
  const [trade, setTrade] = useState('');
  const [licenseDate, setLicenseDate] = useState('');
  const [licenseType, setLicenseType] = useState('');
  const [prevLicense, setPrevLicense] = useState(false);
  const [medicalComments, setMedicalComments] = useState('');
  const [trainings, setTrainings] = useState({});
  const [thirdParty, setThirdParty] = useState({});
  const [isFirstQatar, setIsFirstQatar] = useState(false);
  const [isLessSixMonths, setIsLessSixMonths] = useState(false);
  const [niwStart, setNiwStart] = useState('');
  const [niwEnd, setNiwEnd] = useState('');
  const [niwArmband, setNiwArmband] = useState('');
  const [niwSupervisor, setNiwSupervisor] = useState('');
  const [ppe, setPpe] = useState({});
  const [preparedBy, setPreparedBy] = useState('Madan Sharma');
  const [preparedDate, setPreparedDate] = useState(TODAY);

  const toggleT = (key) => setTrainings(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleTP = (key) => setThirdParty(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleP = (key) => setPpe(prev => ({ ...prev, [key]: !prev[key] }));

  const fmtDate = (d) => {
    if (!d) return '';
    try { return format(new Date(d), 'dd-MM-yyyy'); } catch { return d; }
  };

  const handlePrint = () => window.print();

  const people = selectedPersonnel.length > 0 ? selectedPersonnel : [{}];

  const tdH = { padding: '2px 5px', fontSize: '8.5px', verticalAlign: 'middle' };
  const tdB = { ...tdH, fontWeight: 'bold' };

  return (
    <div className="space-y-4">
      {/* ── CONTROLS (no-print) ── */}
      <div className="no-print bg-white border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Mobilization Form</h3>
          <Button onClick={handlePrint} className="gap-2"><Printer className="w-4 h-4" /> Print / Export PDF</Button>
        </div>
        <p className="text-xs text-muted-foreground">One A4 page per selected person. Personnel data auto-populates from the filters above.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">Project Type</label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring"
              value={projectType} onChange={e => setProjectType(e.target.value)}>
              <option value="">None</option>
              <option>EPC3</option><option>EPC4</option><option>BOP</option>
            </select>
          </div>
          <div><label className="text-xs font-medium block mb-1">Project ID Number</label>
            <Input value={projectIdNumber} onChange={e => setProjectIdNumber(e.target.value)} placeholder="Override PID…" /></div>
          <div><label className="text-xs font-medium block mb-1">Staff Number</label>
            <Input value={staffNo} onChange={e => setStaffNo(e.target.value)} placeholder="Override staff no…" /></div>
          <div><label className="text-xs font-medium block mb-1">Trade</label>
            <Input value={trade} onChange={e => setTrade(e.target.value)} placeholder="e.g. Electrician" /></div>
          <div><label className="text-xs font-medium block mb-1">License Issued Date</label>
            <Input type="date" value={licenseDate} onChange={e => setLicenseDate(e.target.value)} /></div>
          <div><label className="text-xs font-medium block mb-1">Type of License</label>
            <Input value={licenseType} onChange={e => setLicenseType(e.target.value)} /></div>
          <div><label className="text-xs font-medium block mb-1">Medical Comments</label>
            <Input value={medicalComments} onChange={e => setMedicalComments(e.target.value)} /></div>
          <div><label className="text-xs font-medium block mb-1">Prepared By (Part 6)</label>
            <Input value={preparedBy} onChange={e => setPreparedBy(e.target.value)} /></div>
        </div>
        <div>
          <p className="text-xs font-medium mb-1">Training Ticks (applies to all forms)</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-1">
            {TRAINING_ITEMS.flat().filter(Boolean).map(item => (
              <label key={item} className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" checked={!!trainings[item]} onChange={() => toggleT(item)} className="w-3 h-3" />
                <span className="truncate">{item}</span>
              </label>
            ))}
          </div>
          <p className="text-xs font-medium mt-2 mb-1">Third Party Certificate Verification</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-1">
            {THIRD_PARTY_ITEMS.flat().filter(Boolean).map(item => (
              <label key={item} className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" checked={!!thirdParty[item]} onChange={() => toggleTP(item)} className="w-3 h-3" />
                <span className="truncate">{item}</span>
              </label>
            ))}
          </div>
          <p className="text-xs font-medium mt-2 mb-1">PPE</p>
          <div className="flex flex-wrap gap-3">
            {PPE_ITEMS.map(item => (
              <label key={item} className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" checked={!!ppe[item]} onChange={() => toggleP(item)} className="w-3 h-3" />
                <span>{item}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 mt-2">
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input type="checkbox" checked={isFirstQatar} onChange={e => setIsFirstQatar(e.target.checked)} className="w-3 h-3" />
              Is first in Qatar
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input type="checkbox" checked={isLessSixMonths} onChange={e => setIsLessSixMonths(e.target.checked)} className="w-3 h-3" />
              Is experience less than 6 months
            </label>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
            <div><label className="text-xs font-medium block mb-1">NIW Start Date</label>
              <Input type="date" value={niwStart} onChange={e => setNiwStart(e.target.value)} /></div>
            <div><label className="text-xs font-medium block mb-1">NIW End Date</label>
              <Input type="date" value={niwEnd} onChange={e => setNiwEnd(e.target.value)} /></div>
            <div><label className="text-xs font-medium block mb-1">Armband (Y/N)</label>
              <Input value={niwArmband} onChange={e => setNiwArmband(e.target.value)} /></div>
            <div><label className="text-xs font-medium block mb-1">Name of Supervisor</label>
              <Input value={niwSupervisor} onChange={e => setNiwSupervisor(e.target.value)} /></div>
          </div>
        </div>
      </div>

      {/* ── PRINTABLE FORMS — one per person ── */}
      {people.map((person, idx) => {
        const firstName = person.name ? person.name.split(' ')[0] : '<Personnel First Name>';
        const lastName = person.name ? person.name.split(' ').slice(1).join(' ') : '<Personnel Last Name>';
        const pid = projectIdNumber || person.pid || '';
        const sNo = staffNo || person.staff_no || '';
        const tradeVal = trade || person.designation_org_chart || '';
        const medComment = medicalComments || person.ftw_remarks || '';
        const doctorName = person.ftw_doctor || '<Doctor Name>';
        const medDate = person.ftw_approved_date ? fmtDate(person.ftw_approved_date) : '';
        const nationality = person.nationality || '<Nationality>';

        return (
          <div
            key={idx}
            className="printable-area"
            style={{
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: '8.5px',
              color: '#000',
              backgroundColor: '#fff',
              width: '210mm',
              height: '297mm',
              margin: '0 auto 20px',
              padding: '6mm 8mm 4mm',
              boxSizing: 'border-box',
              border: '1px solid #ccc',
              pageBreakAfter: idx < people.length - 1 ? 'always' : 'auto',
              breakAfter: idx < people.length - 1 ? 'page' : 'auto',
              overflow: 'hidden',
            }}
          >

            {/* ── HEADER ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #333', marginBottom: '3px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '85px', padding: '3px 5px', verticalAlign: 'middle', borderRight: '1.5px solid #333', textAlign: 'center' }}>
                    <img
                      src="https://media.base44.com/images/public/69ce3261a82ad7bdfb8d8300/5c7e00d8a_image.png"
                      alt="QatarEnergy LNG"
                      style={{ height: '48px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                    />
                  </td>
                  <td style={{ textAlign: 'center', verticalAlign: 'middle', borderRight: '1.5px solid #333', padding: '0' }}>
                    <div style={{ padding: '4px 8px 2px', lineHeight: '1.4' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '10.5px', color: '#1e3a5f', letterSpacing: '0.3px' }}>
                        EPCC FOR THE NORTH FIELD EXPANSION PROJECT (NFXP)
                      </div>
                      <div style={{ fontWeight: 'bold', fontSize: '9.5px', color: '#1e3a5f' }}>
                        EPC 3, 4 &amp; BOP
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#c0000c', color: 'white', fontWeight: 'bold', fontSize: '10.5px', padding: '3px 8px', letterSpacing: '0.5px' }}>
                      EMPLOYEE MOBILIZATION FORM
                    </div>
                  </td>
                  <td style={{ width: '110px', padding: '3px 5px', verticalAlign: 'middle', textAlign: 'center' }}>
                    <img
                      src="https://media.base44.com/images/public/69ce3261a82ad7bdfb8d8300/501aa6495_image.png"
                      alt="Tecnicas Reunidas TEAM"
                      style={{ height: '48px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── PROJECT TITLE ROW ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: BB, marginBottom: '2px' }}>
              <tbody>
                <tr>
                  <td style={{ ...tdH, borderRight: B }}>
                    <strong>Project title:</strong>&nbsp;
                    {['EPC3', 'EPC4', 'BOP'].map(p => (
                      <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginRight: '8px' }}>
                        <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', border: '1px solid #333', backgroundColor: projectType === p ? '#333' : 'white', verticalAlign: 'middle' }} />
                        &nbsp;{p}&nbsp;<span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', border: '1px solid #333', backgroundColor: 'white', verticalAlign: 'middle', visibility: 'hidden' }} />
                      </span>
                    ))}
                  </td>
                  <td style={{ ...tdH, width: '38%' }}>
                    <strong>(Project ID Number:</strong>&nbsp;{pid}&nbsp;<strong>)</strong>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── INSTRUCTIONS BOX ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: BB, marginBottom: '2px' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '3px 6px', fontSize: '7.2px', lineHeight: '1.55', color: '#222' }}>
                    <span style={{ textDecoration: 'underline' }}><em><strong>For new request:</strong> Complete part 1 to 5, attach RLIC Security Pass copy with access code 31, QID or Passport copy. Soft copy of photo and excel sheet need to be provided to Security Badge office.</em></span><br />
                    <span style={{ textDecoration: 'underline' }}><em><strong>For renewal:</strong> Complete part 1 and 5 only including Project ID Number, attach RLIC Security Pass copy with access code 31, QID or Passport copy to Security Badge office. Expired Project ID should be returned back before collecting the new ID.</em></span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── PART 1: PERSONAL DETAILS ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: BB, marginBottom: '2px' }}>
              <tbody>
                <SectionHeader number="1" title="Personal Details:" colSpan={6} />
                <tr style={{ borderBottom: B }}>
                  <td style={{ ...tdB, width: '14%', borderRight: B }}>First Name:</td>
                  <td style={{ ...tdH, width: '19%', borderRight: BB, backgroundColor: '#ffff00', fontWeight: 'bold' }}>{firstName}</td>
                  <td style={{ ...tdB, width: '12%', borderRight: B }}>Last Name:</td>
                  <td style={{ ...tdH, width: '19%', borderRight: BB, backgroundColor: '#ffff00', fontWeight: 'bold' }}>{lastName}</td>
                  <td style={{ ...tdB, width: '14%', borderRight: B }}>Nationality:</td>
                  <td style={{ ...tdH, backgroundColor: '#ffff00', fontWeight: 'bold' }}>{nationality}</td>
                </tr>
                <tr style={{ borderBottom: B }}>
                  <td style={{ ...tdB, borderRight: B }}>Qatar ID No:</td>
                  <td style={{ ...tdH, borderRight: BB }}>{person.qid_no || ''}</td>
                  <td style={{ ...tdB, borderRight: B }}>Staff Number:</td>
                  <td style={{ ...tdH, borderRight: BB }}>{sNo}</td>
                  <td style={{ ...tdB, borderRight: B }}>Company:</td>
                  <td style={{ ...tdB }}>GSO QATAR</td>
                </tr>
                <tr style={{ borderBottom: B }}>
                  <td colSpan={6} style={{ ...tdH }}>
                    <strong>Trade</strong> <em>(If Driver/Operator - Attach License Copy):</em> {tradeVal}
                  </td>
                </tr>
                <tr style={{ borderBottom: B }}>
                  <td style={{ ...tdB, borderRight: B }}>License Issued Date:</td>
                  <td style={{ ...tdH, borderRight: BB }}>{fmtDate(licenseDate)}</td>
                  <td colSpan={2} style={{ ...tdB, borderRight: BB }}>Type of License:&nbsp;<span style={{ fontWeight: 'normal' }}>{licenseType}</span></td>
                  <td colSpan={2} style={{ ...tdH }}></td>
                </tr>
                <tr>
                  <td colSpan={6} style={{ ...tdH }}>
                    <strong>Previous License Details</strong> <em>(Attach copy):</em>&nbsp;
                    <span style={{ marginLeft: '4px' }}><CB checked={prevLicense} /> yes</span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── PART 2: DEPT APPROVAL ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: BB, marginBottom: '2px' }}>
              <tbody>
                <SectionHeader number="2" title="Concerned Department approval (If required)" colSpan={4} />
                <tr>
                  <td style={{ ...tdH, width: '25%', borderRight: B }}><strong>Name:</strong></td>
                  <td style={{ ...tdH, width: '25%', borderRight: B }}><strong>Department:</strong></td>
                  <td style={{ ...tdH, width: '25%', borderRight: B }}><strong>Date:</strong></td>
                  <td style={{ ...tdH, width: '25%' }}><strong>Signature:</strong></td>
                </tr>
              </tbody>
            </table>

            {/* ── PART 3: MEDICAL ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: BB, marginBottom: '2px' }}>
              <tbody>
                <SectionHeader number="3" title="Medical" colSpan={4} />
                <tr style={{ borderBottom: B }}>
                  <td style={{ ...tdB, width: '22%', borderRight: B }}>Fit to Work Done (Y/N):</td>
                  <td style={{ ...tdH, width: '15%', borderRight: BB, fontWeight: 'bold' }}>YES</td>
                  <td style={{ ...tdB, width: '30%', borderRight: B }}>Fit to Work Status (Fit / Unfit):</td>
                  <td style={{ ...tdH, fontWeight: 'bold' }}>
                    {person.ftw_result === 'ACCEPTED' ? 'FIT TO WORK' : (person.ftw_result || 'FIT TO WORK')}
                  </td>
                </tr>
                <tr style={{ borderBottom: B, position: 'relative' }}>
                  <td colSpan={4} style={{ ...tdH, lineHeight: '1.7', paddingRight: '50px', position: 'relative', minHeight: '22px' }}>
                    <strong>Comments (if any):</strong> {medComment}
                    <div style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #aaa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6px', color: '#888', backgroundColor: 'white' }}>Stamp</div>
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ ...tdH, lineHeight: '1.7' }}>
                    <strong>Doctor Name:</strong> {doctorName}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    <strong>Date:</strong> {medDate}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    <strong>Signature &amp; Stamp:</strong>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── PART 4: TRAINING ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: BB, marginBottom: '2px', fontSize: '8px' }}>
              <colgroup>
                {[...Array(6)].map((_, i) => <col key={i} style={{ width: '16.66%' }} />)}
              </colgroup>
              <tbody>
                <SectionHeader number="4" title="Training Details (Tick which are applicable as per the Trade and work scope)" colSpan={6} />
                {TRAINING_ITEMS.map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: B }}>
                    {row.map((item, ci) => (
                      <td key={ci} style={{ padding: '2px 3px', borderRight: ci < 5 ? B : 'none', fontSize: '7.8px' }}>
                        {item ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <CB checked={!!trainings[item]} />{item}
                          </span>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Third Party header */}
                <tr>
                  <td colSpan={6} style={{ padding: '2px 5px', fontWeight: 'bold', fontSize: '8px', backgroundColor: '#f0f0f0', borderTop: BB, borderBottom: B }}>
                    Third Party Certificate Verification
                  </td>
                </tr>
                {THIRD_PARTY_ITEMS.map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: B }}>
                    {row.map((item, ci) => (
                      <td key={ci} style={{ padding: '2px 3px', borderRight: ci < 5 ? B : 'none', fontSize: '7.8px' }}>
                        {item ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <CB checked={!!thirdParty[item]} />{item}
                          </span>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* NIW */}
                <tr style={{ borderTop: BB, borderBottom: B }}>
                  <td colSpan={3} style={{ padding: '2px 5px', fontSize: '8px', borderRight: B }}>
                    <strong>New Worker Identification (NIW)</strong>&nbsp;&nbsp;
                    <CB checked={isFirstQatar} /> Is first in Qatar
                  </td>
                  <td colSpan={3} style={{ padding: '2px 5px', fontSize: '8px' }}>
                    <CB checked={isLessSixMonths} /> Is experience less than 6 months
                  </td>
                </tr>
                <tr style={{ borderBottom: BB }}>
                  <td style={{ padding: '2px 5px', borderRight: B, fontSize: '8px' }}><strong>Start Date:</strong> {fmtDate(niwStart)}</td>
                  <td style={{ padding: '2px 5px', borderRight: B, fontSize: '8px' }}><strong>End Date:</strong> {fmtDate(niwEnd)}</td>
                  <td style={{ padding: '2px 5px', borderRight: B, fontSize: '8px' }}><strong>Armband (Y/N):</strong> {niwArmband}</td>
                  <td colSpan={3} style={{ padding: '2px 5px', fontSize: '8px' }}><strong>Name of Supervisor:</strong> {niwSupervisor}</td>
                </tr>

                {/* PPE */}
                <tr style={{ borderBottom: B }}>
                  <td colSpan={6} style={{ padding: '2px 5px', fontStyle: 'italic', fontSize: '7.5px', fontWeight: 'bold' }}>
                    PPE Verification (All PPE must be project approved and minimum 2 coveralls must be given):
                  </td>
                </tr>
                <tr style={{ borderBottom: B }}>
                  {PPE_ITEMS.map((item, i) => (
                    <td key={i} style={{ padding: '2px 3px', borderRight: i < PPE_ITEMS.length - 1 ? B : 'none', fontSize: '7.8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <CB checked={!!ppe[item]} />{item}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Confirm row */}
                <tr style={{ borderBottom: B }}>
                  <td colSpan={6} style={{ padding: '2px 5px', lineHeight: '1.5', fontSize: '7.5px', paddingRight: '50px', position: 'relative' }}>
                    <strong>I confirm the below are done:</strong><br />
                    1) Required training are completed; 2) Safety Passport &amp; Helmet stickers issued; 3) Verified PPE; 4) NIW Armband <em>(if required)</em>
                    <div style={{ position: 'absolute', right: '6px', top: '4px', width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #aaa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6px', color: '#888', backgroundColor: 'white' }}>Stamp</div>
                  </td>
                </tr>
                <tr>
                  <td colSpan={6} style={{ padding: '2px 5px', fontSize: '8.5px' }}>
                    <strong>Name:</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    <strong>Date:</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    <strong>Signature &amp; Stamp:</strong>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── PART 5: EMPLOYEE DECLARATION ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: BB, marginBottom: '2px' }}>
              <tbody>
                <SectionHeader number="5" title="Employee declaration: (Training department need to ensure that it is signed in their presence)" colSpan={3} />
                <tr style={{ borderBottom: B }}>
                  <td colSpan={3} style={{ ...tdH, fontSize: '7.8px', lineHeight: '1.55', paddingRight: '50px', position: 'relative' }}>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;I acknowledge that I have completed the above trainings and received the Safety Passport, Helmet sticker, Info cards and NIW Armband (if required). I am fully aware about the risk of my job, and I agree to comply with the rules and regulation implemented on my work location. I will be responsible for myself during my job at the project.
                    <div style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #aaa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6px', color: '#888', backgroundColor: 'white' }}>Stamp</div>
                  </td>
                </tr>
                <tr>
                  <td style={{ ...tdH, borderRight: B, width: '40%' }}><strong>Name:</strong> {person.name || ''}</td>
                  <td style={{ ...tdH, borderRight: B, width: '30%' }}><strong>Date:</strong></td>
                  <td style={{ ...tdH, width: '30%' }}><strong>Signature:</strong></td>
                </tr>
              </tbody>
            </table>

            {/* ── PART 6: PROJECT ID PREPARED BY ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: BB, marginBottom: '3px' }}>
              <tbody>
                <SectionHeader number="6" title="Project ID prepared by:" colSpan={3} />
                <tr style={{ borderBottom: B }}>
                  <td colSpan={3} style={{ ...tdH, fontSize: '7.8px', lineHeight: '1.55', paddingRight: '50px', position: 'relative' }}>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;I hereby acknowledge that the mandatory requirements to issue Project ID for the above employee has been completed as per this form and attached documents. The Project ID has been prepared and is ready for collection.
                    <div style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #aaa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6px', color: '#888', backgroundColor: 'white' }}>Stamp</div>
                  </td>
                </tr>
                <tr>
                  <td style={{ ...tdH, borderRight: B, width: '34%' }}><strong>Name:</strong> {preparedBy}</td>
                  <td style={{ ...tdH, borderRight: B, width: '33%' }}><strong>Date:</strong> {preparedDate}</td>
                  <td style={{ ...tdH, width: '33%' }}><strong>Signature &amp; Stamp:</strong></td>
                </tr>
              </tbody>
            </table>

            {/* ── FOOTER DOCUMENT REFERENCE ── */}
            <div style={{ fontSize: '6.5px', color: '#333', lineHeight: '1.5', borderTop: '0.5px solid #aaa', paddingTop: '2px' }}>
              Document Reference: NFXP3-TRSA-SH-PRC-00006-ATT27, NFXP4-TWJV-SH-PRC-00006-ATT27, NFXP4-TWJV-SH-PRC-00025-TMP07, NFXP3-TRSA-SH-PRC-00025-TMP07, NFXP4-TWJV-SH-PRC-00076-TMP01, NFXP3-TRSA-SH-PRC-00076-TMP01<br />
              <strong>Doc. No: NFXP-TR-SHES-433</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <strong>Rev.:01</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <strong>Date: 21/12/2025</strong>
            </div>

          </div>
        );
      })}

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
            padding: 6mm 8mm 4mm !important;
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