import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';

const TRAININGS = [
  ['SHES Induction','Chemical Awareness','Respiratory Protection','Bus Captain','LOTO','POSC'],
  ['Dispensing Fuel','Fire & Muster Warden','Spill Pre & Response','Heat Stress','LORO CP','PTW'],
  ['Electrical Safety','Flagman & Banksman','Tipper Truck Control','Hole Watch','CSE','DD'],
  ['Excavation Safety','Hand & Power Tools','Waste Management','PW Handling','WAH',''],
  ['Lifting & Rigging','Harness Inspection','','Tire Safety','LMRA',''],
];
const THIRD_PARTY = [
  ['Crane Operator','Equipment Operator','Scaffolder','BLS/FA/CPR','PIMT','AGT'],
  ['Rigger','Fire Watch','Others (if any)','','',''],
];
const PPE = ['Coverall','Safety Shoes','Helmet','Safety Glass (Clear & Dark)','Hand Gloves','Water Bottle'];

const TODAY = format(new Date(), 'dd-MM-yyyy');

export default function MobilizationFormTab({ selectedPersonnel }) {
  const [projectType, setProjectType] = useState('');
  const [projectIdNumber, setProjectIdNumber] = useState('');
  const [staffNo, setStaffNo] = useState('');
  const [trade, setTrade] = useState('');
  const [licenseDate, setLicenseDate] = useState('');
  const [licenseType, setLicenseType] = useState('');
  const [prevLicense, setPrevLicense] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [deptDept, setDeptDept] = useState('');
  const [deptDate, setDeptDate] = useState('');
  const [medicalDone, setMedicalDone] = useState('YES');
  const [medicalStatus, setMedicalStatus] = useState('FIT TO WORK');
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

  // Use first selected person or blank
  const emp = selectedPersonnel[0] || {};
  const firstName = emp.name ? emp.name.split(' ')[0] : '';
  const lastName = emp.name ? emp.name.split(' ').slice(1).join(' ') : '';

  const toggleTraining = (key) => setTrainings(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleThirdParty = (key) => setThirdParty(prev => ({ ...prev, [key]: !prev[key] }));
  const togglePpe = (key) => setPpe(prev => ({ ...prev, [key]: !prev[key] }));

  const handlePrint = () => window.print();

  const CB = ({ checked }) => (
    <span style={{ display: 'inline-block', width: '11px', height: '11px', border: '1px solid black', textAlign: 'center', lineHeight: '10px', fontSize: '9px', verticalAlign: 'middle', flexShrink: 0 }}>
      {checked ? '✓' : ''}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="no-print bg-white border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Mobilization Form Settings</h3>
          <Button onClick={handlePrint} className="gap-2"><Printer className="w-4 h-4" /> Print / Export PDF</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          The form auto-populates from the first selected personnel. All fields are editable below.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="text-xs font-medium block mb-1">Project Type</label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring"
              value={projectType} onChange={e => setProjectType(e.target.value)}>
              <option value="">Select...</option>
              <option>EPC3</option><option>EPC4</option><option>BOP</option>
            </select>
          </div>
          <div><label className="text-xs font-medium block mb-1">Project ID Number</label>
            <Input value={projectIdNumber} onChange={e => setProjectIdNumber(e.target.value)} placeholder={emp.pid || ''} />
          </div>
          <div><label className="text-xs font-medium block mb-1">Staff Number</label>
            <Input value={staffNo} onChange={e => setStaffNo(e.target.value)} placeholder={emp.staff_no || ''} />
          </div>
          <div><label className="text-xs font-medium block mb-1">Trade</label>
            <Input value={trade} onChange={e => setTrade(e.target.value)} placeholder={emp.designation_org_chart || ''} />
          </div>
          <div><label className="text-xs font-medium block mb-1">License Issued Date</label>
            <Input type="date" value={licenseDate} onChange={e => setLicenseDate(e.target.value)} />
          </div>
          <div><label className="text-xs font-medium block mb-1">Type of License</label>
            <Input value={licenseType} onChange={e => setLicenseType(e.target.value)} />
          </div>
          <div><label className="text-xs font-medium block mb-1">Medical Comments</label>
            <Input value={medicalComments} onChange={e => setMedicalComments(e.target.value)} placeholder={emp.ftw_remarks || ''} />
          </div>
          <div><label className="text-xs font-medium block mb-1">Prepared By</label>
            <Input value={preparedBy} onChange={e => setPreparedBy(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Printable — one page per selected person */}
      {(selectedPersonnel.length > 0 ? selectedPersonnel : [{}]).map((person, idx) => {
        const fn = person.name ? person.name.split(' ')[0] : '';
        const ln = person.name ? person.name.split(' ').slice(1).join(' ') : '';
        return (
          <div key={idx} className="printable-area bg-white text-black" style={{ fontFamily: 'Arial, sans-serif', fontSize: '9.5px', width: '210mm', minHeight: '297mm', margin: '0 auto 20px', padding: '8mm 10mm', boxSizing: 'border-box', border: '1px solid #ccc', pageBreakAfter: idx < selectedPersonnel.length - 1 ? 'always' : 'auto' }}>
            
            {/* Header */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '120px' }}>
                    <img src="https://media.base44.com/images/public/69ce3261a82ad7bdfb8d8300/d1f8aeb83_Logo.png" alt="GSO" style={{ height: '40px', objectFit: 'contain' }} />
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px', letterSpacing: '1px' }}>
                    MOBILIZATION FORM
                  </td>
                  <td style={{ textAlign: 'right', fontSize: '9px', color: '#555' }}>
                    <div>Project title: {['EPC3','EPC4','BOP'].map(p => (
                      <span key={p} style={{ marginLeft: '8px' }}>
                        <CB checked={projectType === p} /> {p}
                      </span>
                    ))}</div>
                    <div style={{ marginTop: '2px' }}>Project ID Number: {projectIdNumber || person.pid || ''}</div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ border: '1px solid black', padding: '4px 6px', fontSize: '8px', marginBottom: '6px', lineHeight: '1.4' }}>
              <em>For new request: Complete part 1 to 5, attach RLIC Security Pass copy with access code 31, QID or Passport copy. Soft copy of photo and excel sheet need to be provided to Security Badge office.</em><br/>
              <em>For renewal: Complete part 1 and 5 only including Project ID Number, attach RLIC Security Pass copy with access code 31, QID or Passport copy to Security Badge office. Expired Project ID should be returned back before collecting the new ID.</em>
            </div>

            {/* Part 1 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', marginBottom: '4px' }}>
              <tbody>
                <tr><td colSpan={6} style={{ backgroundColor: '#1a3c6e', color: 'white', fontWeight: 'bold', padding: '3px 6px', fontSize: '10px' }}>1. Personal Details:</td></tr>
                <tr style={{ borderTop: '1px solid black' }}>
                  <td style={{ padding: '3px 5px', fontWeight: 'bold', width: '80px', borderRight: '1px solid #ccc' }}>First Name:</td>
                  <td style={{ padding: '3px 5px', borderRight: '1px solid black', minWidth: '100px' }}>{fn || firstName}</td>
                  <td style={{ padding: '3px 5px', fontWeight: 'bold', width: '80px', borderRight: '1px solid #ccc' }}>Last Name:</td>
                  <td style={{ padding: '3px 5px', borderRight: '1px solid black', minWidth: '100px' }}>{ln || lastName}</td>
                  <td style={{ padding: '3px 5px', fontWeight: 'bold', width: '80px', borderRight: '1px solid #ccc' }}>Nationality:</td>
                  <td style={{ padding: '3px 5px' }}>{person.nationality || ''}</td>
                </tr>
                <tr style={{ borderTop: '1px solid black' }}>
                  <td style={{ padding: '3px 5px', fontWeight: 'bold', borderRight: '1px solid #ccc' }}>Qatar ID No:</td>
                  <td style={{ padding: '3px 5px', borderRight: '1px solid black' }}>{person.qid_no || ''}</td>
                  <td style={{ padding: '3px 5px', fontWeight: 'bold', borderRight: '1px solid #ccc' }}>Staff Number:</td>
                  <td style={{ padding: '3px 5px', borderRight: '1px solid black' }}>{staffNo || person.staff_no || ''}</td>
                  <td style={{ padding: '3px 5px', fontWeight: 'bold', borderRight: '1px solid #ccc' }}>Company:</td>
                  <td style={{ padding: '3px 5px', fontWeight: 'bold' }}>GSO QATAR</td>
                </tr>
                <tr style={{ borderTop: '1px solid black' }}>
                  <td colSpan={6} style={{ padding: '3px 5px' }}>
                    <strong>Trade</strong> (If Driver/Operator - Attach License Copy): {trade || person.designation_org_chart || ''}
                  </td>
                </tr>
                <tr style={{ borderTop: '1px solid black' }}>
                  <td style={{ padding: '3px 5px', fontWeight: 'bold', borderRight: '1px solid #ccc' }}>License Issued Date:</td>
                  <td style={{ padding: '3px 5px', borderRight: '1px solid black' }}>{licenseDate}</td>
                  <td style={{ padding: '3px 5px', fontWeight: 'bold', borderRight: '1px solid #ccc' }}>Type of License:</td>
                  <td colSpan={3} style={{ padding: '3px 5px' }}>{licenseType}</td>
                </tr>
                <tr style={{ borderTop: '1px solid black' }}>
                  <td colSpan={6} style={{ padding: '3px 5px' }}>
                    <strong>Previous License Details</strong> (Attach copy): <CB checked={prevLicense} /> Yes
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Part 2 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', marginBottom: '4px' }}>
              <tbody>
                <tr><td colSpan={4} style={{ backgroundColor: '#1a3c6e', color: 'white', fontWeight: 'bold', padding: '3px 6px', fontSize: '10px' }}>2. Concerned Department Approval (If required)</td></tr>
                <tr style={{ borderTop: '1px solid black' }}>
                  <td style={{ padding: '3px 5px', borderRight: '1px solid #ccc' }}><strong>Name:</strong> {deptName}</td>
                  <td style={{ padding: '3px 5px', borderRight: '1px solid #ccc' }}><strong>Department:</strong> {deptDept}</td>
                  <td style={{ padding: '3px 5px', borderRight: '1px solid #ccc' }}><strong>Date:</strong> {deptDate}</td>
                  <td style={{ padding: '3px 5px' }}><strong>Signature:</strong></td>
                </tr>
              </tbody>
            </table>

            {/* Part 3 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', marginBottom: '4px' }}>
              <tbody>
                <tr><td colSpan={4} style={{ backgroundColor: '#1a3c6e', color: 'white', fontWeight: 'bold', padding: '3px 6px', fontSize: '10px' }}>3. Medical</td></tr>
                <tr style={{ borderTop: '1px solid black' }}>
                  <td style={{ padding: '3px 5px', fontWeight: 'bold', borderRight: '1px solid #ccc', width: '160px' }}>Fit to Work Done (Y/N):</td>
                  <td style={{ padding: '3px 5px', borderRight: '1px solid black' }}>{person.ftw_result ? 'YES' : medicalDone}</td>
                  <td style={{ padding: '3px 5px', fontWeight: 'bold', borderRight: '1px solid #ccc', width: '160px' }}>Fit to Work Status (Fit/Unfit):</td>
                  <td style={{ padding: '3px 5px' }}>{person.ftw_result === 'ACCEPTED' ? 'FIT TO WORK' : person.ftw_result || medicalStatus}</td>
                </tr>
                <tr style={{ borderTop: '1px solid black' }}>
                  <td colSpan={4} style={{ padding: '3px 5px' }}>
                    <strong>Comments (if any):</strong> {medicalComments || person.ftw_remarks || ''}
                    {person.ftw_doctor ? <span style={{ marginLeft: '16px' }}><strong>Doctor Name:</strong> {person.ftw_doctor}</span> : null}
                    {person.ftw_approved_date ? <span style={{ marginLeft: '16px' }}><strong>Date:</strong> {person.ftw_approved_date}</span> : null}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Part 4 — Training */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', marginBottom: '4px', fontSize: '8.5px' }}>
              <tbody>
                <tr><td colSpan={12} style={{ backgroundColor: '#1a3c6e', color: 'white', fontWeight: 'bold', padding: '3px 6px', fontSize: '10px' }}>4. Training Details (Tick which are applicable as per the Trade and work scope)</td></tr>
                {TRAININGS.map((row, ri) => (
                  <tr key={ri} style={{ borderTop: '1px solid #ccc' }}>
                    {row.map((item, ci) => item ? (
                      <React.Fragment key={ci}>
                        <td style={{ padding: '2px 4px', width: '120px' }}>{item}</td>
                        <td style={{ padding: '2px 4px', width: '20px', borderRight: ci < row.length - 2 ? '1px solid #ccc' : 'none', textAlign: 'center' }}>
                          <CB checked={!!trainings[item]} />
                        </td>
                      </React.Fragment>
                    ) : (
                      <React.Fragment key={ci}><td></td><td></td></React.Fragment>
                    ))}
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid black' }}>
                  <td colSpan={12} style={{ padding: '2px 4px', fontWeight: 'bold', backgroundColor: '#f1f5f9' }}>Third Party Certificate Verification</td>
                </tr>
                {THIRD_PARTY.map((row, ri) => (
                  <tr key={ri} style={{ borderTop: '1px solid #ccc' }}>
                    {row.map((item, ci) => item ? (
                      <React.Fragment key={ci}>
                        <td style={{ padding: '2px 4px', width: '120px' }}>{item}</td>
                        <td style={{ padding: '2px 4px', width: '20px', borderRight: ci < row.length - 2 ? '1px solid #ccc' : 'none', textAlign: 'center' }}>
                          <CB checked={!!thirdParty[item]} />
                        </td>
                      </React.Fragment>
                    ) : (
                      <React.Fragment key={ci}><td></td><td></td></React.Fragment>
                    ))}
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid black' }}>
                  <td colSpan={12} style={{ padding: '2px 4px' }}>
                    <strong>New Worker Identification (NIW):</strong>&nbsp;
                    <CB checked={isFirstQatar} /> Is first in Qatar &nbsp;&nbsp;
                    <CB checked={isLessSixMonths} /> Is experience less than 6 months
                  </td>
                </tr>
                <tr style={{ borderTop: '1px solid #ccc' }}>
                  <td colSpan={3} style={{ padding: '2px 4px' }}><strong>Start Date:</strong> {niwStart}</td>
                  <td colSpan={3} style={{ padding: '2px 4px' }}><strong>End Date:</strong> {niwEnd}</td>
                  <td colSpan={3} style={{ padding: '2px 4px' }}><strong>Armband (Y/N):</strong> {niwArmband}</td>
                  <td colSpan={3} style={{ padding: '2px 4px' }}><strong>Supervisor:</strong> {niwSupervisor}</td>
                </tr>
                <tr style={{ borderTop: '1px solid black', backgroundColor: '#f8fafc' }}>
                  <td colSpan={12} style={{ padding: '2px 4px', fontWeight: 'bold', fontSize: '8px', fontStyle: 'italic' }}>PPE Verification (All PPE must be project approved and minimum 2 coveralls must be given):</td>
                </tr>
                <tr style={{ borderTop: '1px solid #ccc' }}>
                  {PPE.map((item, i) => (
                    <React.Fragment key={i}>
                      <td style={{ padding: '2px 4px' }}>{item}</td>
                      <td style={{ padding: '2px 4px', textAlign: 'center' }}><CB checked={!!ppe[item]} /></td>
                    </React.Fragment>
                  ))}
                </tr>
                <tr style={{ borderTop: '1px solid black' }}>
                  <td colSpan={12} style={{ padding: '3px 4px', fontSize: '8px' }}>
                    <strong>I confirm the below are done:</strong> 1) Required training are completed; 2) Safety Passport &amp; Helmet stickers issued; 3) Verified PPE; 4) NIW Armband (if required)<br/>
                    <strong>Name:</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>Signature:</strong>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Part 5 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', marginBottom: '4px', fontSize: '8.5px' }}>
              <tbody>
                <tr><td colSpan={2} style={{ backgroundColor: '#1a3c6e', color: 'white', fontWeight: 'bold', padding: '3px 6px', fontSize: '10px' }}>5. Employee Declaration:</td></tr>
                <tr style={{ borderTop: '1px solid black' }}>
                  <td colSpan={2} style={{ padding: '3px 5px', lineHeight: '1.5' }}>
                    I acknowledge that I have completed the above trainings and received the Safety Passport, Helmet sticker, Info cards and NIW Armband (if required). I am fully aware about the risk of my job, and I agree to comply with the rules and regulation implemented on my work location. I will be responsible for myself during my job at the project.
                  </td>
                </tr>
                <tr style={{ borderTop: '1px solid black' }}>
                  <td style={{ padding: '3px 5px', borderRight: '1px solid #ccc' }}><strong>Name:</strong> {person.name || ''}</td>
                  <td style={{ padding: '3px 5px' }}><strong>Signature:</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>Date:</strong></td>
                </tr>
              </tbody>
            </table>

            {/* Part 6 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '8.5px' }}>
              <tbody>
                <tr><td colSpan={3} style={{ backgroundColor: '#1a3c6e', color: 'white', fontWeight: 'bold', padding: '3px 6px', fontSize: '10px' }}>6. Project ID prepared by:</td></tr>
                <tr style={{ borderTop: '1px solid black' }}>
                  <td colSpan={3} style={{ padding: '3px 5px', lineHeight: '1.5' }}>
                    I hereby acknowledge that the mandatory requirements to issue Project ID for the above employee has been completed as per this form and attached documents. The Project ID has been prepared and is ready for collection.
                  </td>
                </tr>
                <tr style={{ borderTop: '1px solid black' }}>
                  <td style={{ padding: '3px 5px', borderRight: '1px solid #ccc' }}><strong>Name:</strong> {preparedBy}</td>
                  <td style={{ padding: '3px 5px', borderRight: '1px solid #ccc' }}><strong>Date:</strong> {preparedDate}</td>
                  <td style={{ padding: '3px 5px' }}><strong>Signature &amp; Stamp:</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}