import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download, Save, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const IMAGE_URL = 'https://media.base44.com/images/public/69ce3261a82ad7bdfb8d8300/2aa4b8d4e_NEWMEDICALFORM_page-0001.jpg';

// Form natural dimensions (the image aspect ratio reference)
const FORM_W = 794;
const FORM_H = 1123;

function pct(x, y) {
  return { left: `${(x / FORM_W) * 100}%`, top: `${(y / FORM_H) * 100}%` };
}
function pctSize(w, h) {
  return { width: `${(w / FORM_W) * 100}%`, height: `${(h / FORM_H) * 100}%` };
}

const inputStyle = {
  position: 'absolute',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  fontSize: '1.1vw',
  fontFamily: 'Arial, sans-serif',
  color: '#000',
  padding: '0 2px',
  lineHeight: 1.2,
};

function Overlay({ formData, setFormData }) {
  const cb = (key) => (
    <input
      type="checkbox"
      checked={!!formData[key]}
      onChange={e => setFormData(p => ({ ...p, [key]: e.target.checked }))}
      style={{ position: 'absolute', cursor: 'pointer', accentColor: '#000', width: '1.4vw', height: '1.4vw' }}
    />
  );

  const txt = (key, x, y, w, h, placeholder = '') => (
    <input
      type="text"
      value={formData[key] || ''}
      onChange={e => setFormData(p => ({ ...p, [key]: e.target.value }))}
      placeholder={placeholder}
      style={{
        ...inputStyle,
        ...pct(x, y),
        ...pctSize(w, h),
      }}
    />
  );

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* ── Section A Fields ── */}

      {/* Photo box */}
      {formData._photoUrl && (
        <img
          src={formData._photoUrl}
          alt="photo"
          style={{ position: 'absolute', objectFit: 'cover', ...pct(14, 91), ...pctSize(94, 108), pointerEvents: 'none' }}
        />
      )}

      {/* First Name */}
      <input type="text" value={formData.firstName || ''} onChange={e => setFormData(p => ({ ...p, firstName: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(158, 88), ...pctSize(230, 16) }} />

      {/* Family Name */}
      <input type="text" value={formData.familyName || ''} onChange={e => setFormData(p => ({ ...p, familyName: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(470, 88), ...pctSize(180, 16) }} />

      {/* Staff No */}
      <input type="text" value={formData.staffNo || ''} onChange={e => setFormData(p => ({ ...p, staffNo: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(690, 88), ...pctSize(90, 16) }} />

      {/* DOB */}
      <input type="text" value={formData.dob || ''} onChange={e => setFormData(p => ({ ...p, dob: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(158, 108), ...pctSize(100, 16) }} />

      {/* Nationality */}
      <input type="text" value={formData.nationality || ''} onChange={e => setFormData(p => ({ ...p, nationality: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(335, 108), ...pctSize(110, 16) }} />

      {/* QID/Passport */}
      <input type="text" value={formData.qid || ''} onChange={e => setFormData(p => ({ ...p, qid: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(620, 108), ...pctSize(165, 16) }} />

      {/* Gender checkboxes */}
      <div style={{ position: 'absolute', pointerEvents: 'all', ...pct(207, 126), ...pctSize(14, 12) }}>
        <input type="checkbox" checked={formData.genderMale || false} onChange={e => setFormData(p => ({ ...p, genderMale: e.target.checked, genderFemale: false }))}
          style={{ cursor: 'pointer', accentColor: '#000', width: '100%', height: '100%' }} />
      </div>
      <div style={{ position: 'absolute', pointerEvents: 'all', ...pct(248, 126), ...pctSize(14, 12) }}>
        <input type="checkbox" checked={formData.genderFemale || false} onChange={e => setFormData(p => ({ ...p, genderFemale: e.target.checked, genderMale: false }))}
          style={{ cursor: 'pointer', accentColor: '#000', width: '100%', height: '100%' }} />
      </div>

      {/* Occupation/Position */}
      <input type="text" value={formData.occupation || ''} onChange={e => setFormData(p => ({ ...p, occupation: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(340, 126), ...pctSize(200, 16) }} />

      {/* Department */}
      <input type="text" value={formData.department || ''} onChange={e => setFormData(p => ({ ...p, department: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(600, 126), ...pctSize(185, 16) }} />

      {/* Work Location checkboxes: North, South, Barzan, LR, RLTO, RGA, NFB, EPC-3 */}
      {[
        { key: 'wlNorth',  x: 190, y: 144 },
        { key: 'wlSouth',  x: 234, y: 144 },
        { key: 'wlBarzan', x: 284, y: 144 },
        { key: 'wlLR',     x: 322, y: 144 },
        { key: 'wlRLTO',   x: 354, y: 144 },
        { key: 'wlRGA',    x: 394, y: 144 },
        { key: 'wlNFB',    x: 432, y: 144 },
        { key: 'wlEPC3',   x: 474, y: 144 },
      ].map(({ key, x, y }) => (
        <div key={key} style={{ position: 'absolute', pointerEvents: 'all', ...pct(x, y), width: '1.6vw', height: '1.6vw' }}>
          <input type="checkbox" checked={formData[key] || false} onChange={e => setFormData(p => ({ ...p, [key]: e.target.checked }))}
            style={{ cursor: 'pointer', accentColor: '#000', width: '100%', height: '100%' }} />
        </div>
      ))}

      {/* Work Location row 2: HQ, QNT, NFE, NFS, NFW */}
      {[
        { key: 'wlHQ',  x: 164, y: 161 },
        { key: 'wlQNT', x: 206, y: 161 },
        { key: 'wlNFE', x: 248, y: 161 },
        { key: 'wlNFS', x: 290, y: 161 },
        { key: 'wlNFW', x: 332, y: 161 },
      ].map(({ key, x, y }) => (
        <div key={key} style={{ position: 'absolute', pointerEvents: 'all', ...pct(x, y), width: '1.6vw', height: '1.6vw' }}>
          <input type="checkbox" checked={formData[key] || false} onChange={e => setFormData(p => ({ ...p, [key]: e.target.checked }))}
            style={{ cursor: 'pointer', accentColor: '#000', width: '100%', height: '100%' }} />
        </div>
      ))}

      {/* Work Area: Plant / Non-Plant */}
      <div style={{ position: 'absolute', pointerEvents: 'all', ...pct(530, 161), width: '1.6vw', height: '1.6vw' }}>
        <input type="checkbox" checked={formData.waPlant || false} onChange={e => setFormData(p => ({ ...p, waPlant: e.target.checked, waNonPlant: false }))}
          style={{ cursor: 'pointer', accentColor: '#000', width: '100%', height: '100%' }} />
      </div>
      <div style={{ position: 'absolute', pointerEvents: 'all', ...pct(602, 161), width: '1.6vw', height: '1.6vw' }}>
        <input type="checkbox" checked={formData.waNonPlant || false} onChange={e => setFormData(p => ({ ...p, waNonPlant: e.target.checked, waPlant: false }))}
          style={{ cursor: 'pointer', accentColor: '#000', width: '100%', height: '100%' }} />
      </div>

      {/* Present Address */}
      <input type="text" value={formData.address || ''} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(190, 179), ...pctSize(200, 14) }} />

      {/* Contact Number */}
      <input type="text" value={formData.contact || ''} onChange={e => setFormData(p => ({ ...p, contact: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(500, 179), ...pctSize(110, 14) }} />

      {/* ── Nature of Work ── */}
      {[
        { key: 'nowConfined',  x: 109, y: 204 },
        { key: 'nowHeight',    x: 109, y: 218 },
        { key: 'nowHanging',   x: 109, y: 232 },
        { key: 'nowOffice',    x: 248, y: 204 },
        { key: 'nowDiving',    x: 248, y: 218 },
        { key: 'nowDriving',   x: 248, y: 232 },
        { key: 'nowSewage',    x: 418, y: 204 },
        { key: 'nowFood',      x: 418, y: 218 },
        { key: 'nowEmergency', x: 570, y: 204 },
        { key: 'nowIonizing',  x: 570, y: 218 },
        { key: 'nowOthers',    x: 570, y: 232 },
      ].map(({ key, x, y }) => (
        <div key={key} style={{ position: 'absolute', pointerEvents: 'all', ...pct(x, y), width: '1.5vw', height: '1.5vw' }}>
          <input type="checkbox" checked={formData[key] || false} onChange={e => setFormData(p => ({ ...p, [key]: e.target.checked }))}
            style={{ cursor: 'pointer', accentColor: '#000', width: '100%', height: '100%' }} />
        </div>
      ))}
      {/* Driving sub-options: light vehicle, Bus, Truck, Crane */}
      {[
        { key: 'drivLight', x: 280, y: 232 },
        { key: 'drivBus',   x: 340, y: 232 },
        { key: 'drivTruck', x: 372, y: 232 },
        { key: 'drivCrane', x: 404, y: 232 },
      ].map(({ key, x, y }) => (
        <div key={key} style={{ position: 'absolute', pointerEvents: 'all', ...pct(x, y), width: '1.5vw', height: '1.5vw' }}>
          <input type="checkbox" checked={formData[key] || false} onChange={e => setFormData(p => ({ ...p, [key]: e.target.checked }))}
            style={{ cursor: 'pointer', accentColor: '#000', width: '100%', height: '100%' }} />
        </div>
      ))}

      {/* ── Vaccination History ── */}
      {[
        { key: 'vacHepA',    x: 109, y: 258 },
        { key: 'vacHepB',    x: 330, y: 258 },
        { key: 'vacTetanus', x: 555, y: 258 },
      ].map(({ key, x, y }) => (
        <div key={key} style={{ position: 'absolute', pointerEvents: 'all', ...pct(x, y), width: '1.5vw', height: '1.5vw' }}>
          <input type="checkbox" checked={formData[key] || false} onChange={e => setFormData(p => ({ ...p, [key]: e.target.checked }))}
            style={{ cursor: 'pointer', accentColor: '#000', width: '100%', height: '100%' }} />
        </div>
      ))}
      {/* Covid brand name */}
      <input type="text" value={formData.covidBrand || ''} onChange={e => setFormData(p => ({ ...p, covidBrand: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(185, 272), ...pctSize(100, 14) }} />

      {/* ── Medical History ── */}
      {[
        { key: 'mhBlood',      x: 109, y: 310 },
        { key: 'mhPeptic',     x: 109, y: 324 },
        { key: 'mhEpilepsy',   x: 109, y: 338 },
        { key: 'mhWork',       x: 109, y: 352 },
        { key: 'mhEar',        x: 109, y: 366 },
        { key: 'mhHeadache',   x: 109, y: 380 },
        { key: 'mhAbdominal',  x: 109, y: 394 },
        { key: 'mhSkin',       x: 109, y: 408 },
        { key: 'mhMusculo',    x: 109, y: 422 },
        { key: 'mhMental',     x: 109, y: 436 },
        { key: 'mhCNS',        x: 284, y: 310 },
        { key: 'mhHeart',      x: 284, y: 324 },
        { key: 'mhHBP',        x: 284, y: 338 },
        { key: 'mhDiabetes',   x: 284, y: 352 },
        { key: 'mhKidney',     x: 284, y: 366 },
        { key: 'mhRheum',      x: 284, y: 380 },
        { key: 'mhFainting',   x: 284, y: 394 },
        { key: 'mhVascular',   x: 284, y: 408 },
        { key: 'mhHepatitis',  x: 284, y: 422 },
        { key: 'mhEye',        x: 284, y: 436 },
        { key: 'mhChest',      x: 462, y: 310 },
        { key: 'mhSexual',     x: 462, y: 324 },
        { key: 'mhCancer',     x: 462, y: 338 },
        { key: 'mhMajor',      x: 462, y: 352 },
        { key: 'mhThyroid',    x: 462, y: 366 },
        { key: 'mhPregnancy',  x: 462, y: 380 },
        { key: 'mhDrug',       x: 462, y: 394 },
        { key: 'mhTobacco',    x: 462, y: 408 },
        { key: 'mhHospital',   x: 462, y: 422 },
        { key: 'mhOthers',     x: 462, y: 436 },
      ].map(({ key, x, y }) => (
        <div key={key} style={{ position: 'absolute', pointerEvents: 'all', ...pct(x, y), width: '1.5vw', height: '1.5vw' }}>
          <input type="checkbox" checked={formData[key] || false} onChange={e => setFormData(p => ({ ...p, [key]: e.target.checked }))}
            style={{ cursor: 'pointer', accentColor: '#000', width: '100%', height: '100%' }} />
        </div>
      ))}

      {/* ── Section B – Biometrics ── */}
      {[
        { key: 'colorNormal', x: 539, y: 518 },
        { key: 'colorPartial', x: 612, y: 518 },
        { key: 'colorTotal',   x: 676, y: 518 },
      ].map(({ key, x, y }) => (
        <div key={key} style={{ position: 'absolute', pointerEvents: 'all', ...pct(x, y), width: '1.5vw', height: '1.5vw' }}>
          <input type="checkbox" checked={formData[key] || false} onChange={e => setFormData(p => ({ ...p, [key]: e.target.checked }))}
            style={{ cursor: 'pointer', accentColor: '#000', width: '100%', height: '100%' }} />
        </div>
      ))}
      <input type="text" value={formData.bp || ''} onChange={e => setFormData(p => ({ ...p, bp: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(168, 518), ...pctSize(60, 14) }} />
      <input type="text" value={formData.height || ''} onChange={e => setFormData(p => ({ ...p, height: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(305, 518), ...pctSize(50, 14) }} />
      <input type="text" value={formData.pr || ''} onChange={e => setFormData(p => ({ ...p, pr: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(168, 534), ...pctSize(60, 14) }} />
      <input type="text" value={formData.weight || ''} onChange={e => setFormData(p => ({ ...p, weight: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(305, 534), ...pctSize(50, 14) }} />

      {/* ── Test Results ── */}
      {[
        { key: 'vaUncorrected', x: 536, y: 537 },
        { key: 'vaCorrected',   x: 536, y: 551 },
        { key: 'ecoNormal',     x: 702, y: 567 },
        { key: 'ecoAbnormal',   x: 742, y: 567 },
        { key: 'spirNormal',    x: 304, y: 567 },
        { key: 'spirAbnormal',  x: 344, y: 567 },
      ].map(({ key, x, y }) => (
        <div key={key} style={{ position: 'absolute', pointerEvents: 'all', ...pct(x, y), width: '1.5vw', height: '1.5vw' }}>
          <input type="checkbox" checked={formData[key] || false} onChange={e => setFormData(p => ({ ...p, [key]: e.target.checked }))}
            style={{ cursor: 'pointer', accentColor: '#000', width: '100%', height: '100%' }} />
        </div>
      ))}
      <input type="text" value={formData.rbs || ''} onChange={e => setFormData(p => ({ ...p, rbs: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(168, 551), ...pctSize(60, 14) }} />
      <input type="text" value={formData.bloodGroup || ''} onChange={e => setFormData(p => ({ ...p, bloodGroup: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(168, 567), ...pctSize(60, 14) }} />
      <input type="text" value={formData.bmi || ''} onChange={e => setFormData(p => ({ ...p, bmi: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(290, 551), ...pctSize(50, 14) }} />

      {/* ── Physical Examination ── */}
      {/* Left column */}
      {[
        { kN: 'peEyesN', kA: 'peEyesA', y: 621 },
        { kN: 'peENTN',  kA: 'peENTA',  y: 635 },
        { kN: 'peOralN', kA: 'peOralA', y: 649 },
        { kN: 'peHeadN', kA: 'peHeadA', y: 663 },
        { kN: 'peLungsN',kA: 'peLungsA', y: 677 },
        { kN: 'peCardN', kA: 'peCardA',  y: 691 },
        { kN: 'peAbdN',  kA: 'peAbdA',   y: 705 },
      ].map(({ kN, kA, y }) => (
        <React.Fragment key={kN}>
          <div style={{ position: 'absolute', pointerEvents: 'all', ...pct(237, y), width: '1.5vw', height: '1.5vw' }}>
            <input type="checkbox" checked={formData[kN] || false} onChange={e => setFormData(p => ({ ...p, [kN]: e.target.checked, [kA]: false }))}
              style={{ cursor: 'pointer', accentColor: '#000', width: '100%', height: '100%' }} />
          </div>
          <div style={{ position: 'absolute', pointerEvents: 'all', ...pct(275, y), width: '1.5vw', height: '1.5vw' }}>
            <input type="checkbox" checked={formData[kA] || false} onChange={e => setFormData(p => ({ ...p, [kA]: e.target.checked, [kN]: false }))}
              style={{ cursor: 'pointer', accentColor: '#000', width: '100%', height: '100%' }} />
          </div>
        </React.Fragment>
      ))}
      {/* Right column */}
      {[
        { kN: 'peHernN', kA: 'peHernA', y: 621 },
        { kN: 'peNeurN', kA: 'peNeurA', y: 635 },
        { kN: 'peExtrN', kA: 'peExtrA', y: 649 },
        { kN: 'peMuscN', kA: 'peMuscA', y: 663 },
        { kN: 'peSkinN', kA: 'peSkinA', y: 677 },
        { kN: 'peMentN', kA: 'peMentA', y: 691 },
        { kN: 'peOthN',  kA: 'peOthA',  y: 705 },
      ].map(({ kN, kA, y }) => (
        <React.Fragment key={kN}>
          <div style={{ position: 'absolute', pointerEvents: 'all', ...pct(622, y), width: '1.5vw', height: '1.5vw' }}>
            <input type="checkbox" checked={formData[kN] || false} onChange={e => setFormData(p => ({ ...p, [kN]: e.target.checked, [kA]: false }))}
              style={{ cursor: 'pointer', accentColor: '#000', width: '100%', height: '100%' }} />
          </div>
          <div style={{ position: 'absolute', pointerEvents: 'all', ...pct(660, y), width: '1.5vw', height: '1.5vw' }}>
            <input type="checkbox" checked={formData[kA] || false} onChange={e => setFormData(p => ({ ...p, [kA]: e.target.checked, [kN]: false }))}
              style={{ cursor: 'pointer', accentColor: '#000', width: '100%', height: '100%' }} />
          </div>
        </React.Fragment>
      ))}

      {/* ── Section C – Fitness Assessment ── */}
      {[
        { key: 'fitAssigned',     y: 769 },
        { key: 'fitConditions',   y: 783 },
        { key: 'fitUnfit',        y: 797 },
        { key: 'fitReassess',     y: 811 },
      ].map(({ key, y }) => (
        <div key={key} style={{ position: 'absolute', pointerEvents: 'all', ...pct(109, y), width: '1.5vw', height: '1.5vw' }}>
          <input type="checkbox" checked={formData[key] || false}
            onChange={e => {
              const keys = ['fitAssigned', 'fitConditions', 'fitUnfit', 'fitReassess'];
              setFormData(p => {
                const next = { ...p };
                keys.forEach(k => next[k] = false);
                next[key] = e.target.checked;
                return next;
              });
            }}
            style={{ cursor: 'pointer', accentColor: '#000', width: '100%', height: '100%' }} />
        </div>
      ))}

      {/* Remarks */}
      <textarea value={formData.remarks || ''} onChange={e => setFormData(p => ({ ...p, remarks: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(222, 766), ...pctSize(250, 60), resize: 'none', fontSize: '0.9vw', lineHeight: 1.4 }} />

      {/* Medication */}
      <textarea value={formData.medication || ''} onChange={e => setFormData(p => ({ ...p, medication: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(548, 766), ...pctSize(235, 60), resize: 'none', fontSize: '0.9vw', lineHeight: 1.4 }} />

      {/* Certified by / Date */}
      <input type="text" value={formData.certifiedBy || ''} onChange={e => setFormData(p => ({ ...p, certifiedBy: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(110, 837), ...pctSize(120, 14) }} />
      <input type="text" value={formData.certDate || ''} onChange={e => setFormData(p => ({ ...p, certDate: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(700, 837), ...pctSize(80, 14) }} />

      {/* Declaration date / signature */}
      <input type="text" value={formData.declDate || ''} onChange={e => setFormData(p => ({ ...p, declDate: e.target.value }))}
        style={{ ...inputStyle, pointerEvents: 'all', ...pct(110, 474), ...pctSize(100, 14) }} />
    </div>
  );
}

export default function QEMedicalFormTab({ employees: propEmployees = [], selectedPersonnel = [] }) {
  const formRef = useRef(null);
  const [selectedId, setSelectedId] = useState('');
  const [formData, setFormData] = useState({});
  const [saved, setSaved] = useState(false);

  const { data: fetchedEmployees = [] } = useQuery({
    queryKey: ['employees-active-medical'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, 'name', 10000),
    enabled: propEmployees.length === 0,
  });

  const employees = propEmployees.length > 0 ? propEmployees : fetchedEmployees;

  // Auto-select first from selectedPersonnel if available
  useEffect(() => {
    if (selectedPersonnel.length > 0 && !selectedId) {
      setSelectedId(selectedPersonnel[0].id);
    }
  }, [selectedPersonnel]);

  // Auto-fill when employee selected
  useEffect(() => {
    if (!selectedId) { setFormData({}); return; }
    const emp = employees.find(e => e.id === selectedId);
    if (!emp) return;

    const nameParts = (emp.name || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const familyName = nameParts.slice(1).join(' ') || '';

    setFormData({
      firstName,
      familyName,
      staffNo: emp.staff_no || emp.qid_no || '',
      dob: emp.dob || '',
      nationality: emp.nationality || '',
      qid: emp.qid_no || emp.pp_no || '',
      occupation: emp.position_application || emp.designation_org_chart || '',
      department: emp.department || '',
      contact: emp.contact_details || '',
      address: emp.current_location === 'QATAR' ? 'DOHA, QATAR' : emp.current_location || '',
      _photoUrl: emp.photo_url || '',
    });
  }, [selectedId, employees]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const buildPrintHTML = () => {
    const fd = formData;

    // Helper to build checkbox mark
    const chk = (val) => val ? '✓' : '';

    // We'll print the image as background and overlay text/checkmarks using absolute positioning
    return `<!DOCTYPE html>
<html>
<head>
<title>QE Medical Examination Form</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: white; }
  .page { position: relative; width: 794px; margin: 0 auto; }
  .page img { width: 794px; height: auto; display: block; }
  .field { position: absolute; font-family: Arial, sans-serif; font-size: 10px; color: #000; white-space: nowrap; overflow: hidden; }
  .chk { position: absolute; font-size: 11px; font-weight: bold; color: #000; }
  @media print {
    @page { margin: 0; size: A4 portrait; }
    body { margin: 0; }
    .page { width: 100%; }
    .page img { width: 100%; }
  }
</style>
</head>
<body>
<div class="page">
  <img src="${IMAGE_URL}" />
  ${fd._photoUrl ? `<img src="${fd._photoUrl}" style="position:absolute;left:1.8%;top:8.1%;width:11.8%;height:9.6%;object-fit:cover;" />` : ''}
  <span class="field" style="left:19.8%;top:7.8%;width:29%">${fd.firstName || ''}</span>
  <span class="field" style="left:59%;top:7.8%;width:22%">${fd.familyName || ''}</span>
  <span class="field" style="left:86.7%;top:7.8%;width:12%">${fd.staffNo || ''}</span>
  <span class="field" style="left:19.8%;top:9.6%;width:13%">${fd.dob || ''}</span>
  <span class="field" style="left:42%;top:9.6%;width:14%">${fd.nationality || ''}</span>
  <span class="field" style="left:77.9%;top:9.6%;width:21%">${fd.qid || ''}</span>
  <span class="chk" style="left:26%;top:11.2%">${chk(fd.genderMale)}</span>
  <span class="chk" style="left:31.2%;top:11.2%">${chk(fd.genderFemale)}</span>
  <span class="field" style="left:42.8%;top:11.2%;width:25%">${fd.occupation || ''}</span>
  <span class="field" style="left:75.5%;top:11.2%;width:24%">${fd.department || ''}</span>
  <span class="chk" style="left:23.9%;top:12.8%">${chk(fd.wlNorth)}</span>
  <span class="chk" style="left:29.5%;top:12.8%">${chk(fd.wlSouth)}</span>
  <span class="chk" style="left:35.7%;top:12.8%">${chk(fd.wlBarzan)}</span>
  <span class="chk" style="left:40.5%;top:12.8%">${chk(fd.wlLR)}</span>
  <span class="chk" style="left:44.5%;top:12.8%">${chk(fd.wlRLTO)}</span>
  <span class="chk" style="left:49.6%;top:12.8%">${chk(fd.wlRGA)}</span>
  <span class="chk" style="left:54.4%;top:12.8%">${chk(fd.wlNFB)}</span>
  <span class="chk" style="left:59.6%;top:12.8%">${chk(fd.wlEPC3)}</span>
  <span class="chk" style="left:20.7%;top:14.3%">${chk(fd.wlHQ)}</span>
  <span class="chk" style="left:25.9%;top:14.3%">${chk(fd.wlQNT)}</span>
  <span class="chk" style="left:31.2%;top:14.3%">${chk(fd.wlNFE)}</span>
  <span class="chk" style="left:36.5%;top:14.3%">${chk(fd.wlNFS)}</span>
  <span class="chk" style="left:41.8%;top:14.3%">${chk(fd.wlNFW)}</span>
  <span class="chk" style="left:66.7%;top:14.3%">${chk(fd.waPlant)}</span>
  <span class="chk" style="left:75.7%;top:14.3%">${chk(fd.waNonPlant)}</span>
  <span class="field" style="left:23.9%;top:15.9%;width:25%">${fd.address || ''}</span>
  <span class="field" style="left:63%;top:15.9%;width:14%">${fd.contact || ''}</span>
  <span class="chk" style="left:13.7%;top:18.1%">${chk(fd.nowConfined)}</span>
  <span class="chk" style="left:13.7%;top:19.4%">${chk(fd.nowHeight)}</span>
  <span class="chk" style="left:13.7%;top:20.7%">${chk(fd.nowHanging)}</span>
  <span class="chk" style="left:31.2%;top:18.1%">${chk(fd.nowOffice)}</span>
  <span class="chk" style="left:31.2%;top:19.4%">${chk(fd.nowDiving)}</span>
  <span class="chk" style="left:31.2%;top:20.7%">${chk(fd.nowDriving)}</span>
  <span class="chk" style="left:52.6%;top:18.1%">${chk(fd.nowSewage)}</span>
  <span class="chk" style="left:52.6%;top:19.4%">${chk(fd.nowFood)}</span>
  <span class="chk" style="left:71.7%;top:18.1%">${chk(fd.nowEmergency)}</span>
  <span class="chk" style="left:71.7%;top:19.4%">${chk(fd.nowIonizing)}</span>
  <span class="chk" style="left:71.7%;top:20.7%">${chk(fd.nowOthers)}</span>
  <span class="chk" style="left:13.7%;top:22.9%">${chk(fd.vacHepA)}</span>
  <span class="chk" style="left:41.5%;top:22.9%">${chk(fd.vacHepB)}</span>
  <span class="chk" style="left:69.9%;top:22.9%">${chk(fd.vacTetanus)}</span>
  <span class="field" style="left:23.3%;top:24.2%;width:13%">${fd.covidBrand || ''}</span>
  ${['mhBlood','mhPeptic','mhEpilepsy','mhWork','mhEar','mhHeadache','mhAbdominal','mhSkin','mhMusculo','mhMental'].map((k, i) =>
    `<span class="chk" style="left:13.7%;top:${27.6 + i * 1.26}%">${chk(fd[k])}</span>`).join('')}
  ${['mhCNS','mhHeart','mhHBP','mhDiabetes','mhKidney','mhRheum','mhFainting','mhVascular','mhHepatitis','mhEye'].map((k, i) =>
    `<span class="chk" style="left:35.8%;top:${27.6 + i * 1.26}%">${chk(fd[k])}</span>`).join('')}
  ${['mhChest','mhSexual','mhCancer','mhMajor','mhThyroid','mhPregnancy','mhDrug','mhTobacco','mhHospital','mhOthers'].map((k, i) =>
    `<span class="chk" style="left:58.2%;top:${27.6 + i * 1.26}%">${chk(fd[k])}</span>`).join('')}
  <span class="field" style="left:21.2%;top:46.1%;width:7.5%">${fd.bp || ''}</span>
  <span class="field" style="left:38.4%;top:46.1%;width:6.3%">${fd.height || ''}</span>
  <span class="field" style="left:21.2%;top:47.5%;width:7.5%">${fd.pr || ''}</span>
  <span class="field" style="left:38.4%;top:47.5%;width:6.3%">${fd.weight || ''}</span>
  <span class="field" style="left:21.2%;top:48.9%;width:7.5%">${fd.rbs || ''}</span>
  <span class="field" style="left:36.5%;top:48.9%;width:6.3%">${fd.bmi || ''}</span>
  <span class="field" style="left:21.2%;top:50.3%;width:7.5%">${fd.bloodGroup || ''}</span>
  <span class="chk" style="left:67.9%;top:46.1%">${chk(fd.colorNormal)}</span>
  <span class="chk" style="left:77%;top:46.1%">${chk(fd.colorPartial)}</span>
  <span class="chk" style="left:85.1%;top:46.1%">${chk(fd.colorTotal)}</span>
  <span class="chk" style="left:67.5%;top:47.7%">${chk(fd.vaUncorrected)}</span>
  <span class="chk" style="left:67.5%;top:49%">${chk(fd.vaCorrected)}</span>
  <span class="chk" style="left:38.3%;top:50.4%">${chk(fd.spirNormal)}</span>
  <span class="chk" style="left:43.3%;top:50.4%">${chk(fd.spirAbnormal)}</span>
  <span class="chk" style="left:88.4%;top:50.4%">${chk(fd.ecoNormal)}</span>
  <span class="chk" style="left:93.4%;top:50.4%">${chk(fd.ecoAbnormal)}</span>
  ${[['peEyesN','peEyesA'],['peENTN','peENTA'],['peOralN','peOralA'],['peHeadN','peHeadA'],['peLungsN','peLungsA'],['peCardN','peCardA'],['peAbdN','peAbdA']].map(([kN,kA], i) =>
    `<span class="chk" style="left:29.8%;top:${55.3 + i * 1.26}%">${chk(fd[kN])}</span><span class="chk" style="left:34.6%;top:${55.3 + i * 1.26}%">${chk(fd[kA])}</span>`).join('')}
  ${[['peHernN','peHernA'],['peNeurN','peNeurA'],['peExtrN','peExtrA'],['peMuscN','peMuscA'],['peSkinN','peSkinA'],['peMentN','peMentA'],['peOthN','peOthA']].map(([kN,kA], i) =>
    `<span class="chk" style="left:78.4%;top:${55.3 + i * 1.26}%">${chk(fd[kN])}</span><span class="chk" style="left:83.1%;top:${55.3 + i * 1.26}%">${chk(fd[kA])}</span>`).join('')}
  <span class="chk" style="left:13.7%;top:68.4%">${chk(fd.fitAssigned)}</span>
  <span class="chk" style="left:13.7%;top:69.7%">${chk(fd.fitConditions)}</span>
  <span class="chk" style="left:13.7%;top:71%">${chk(fd.fitUnfit)}</span>
  <span class="chk" style="left:13.7%;top:72.2%">${chk(fd.fitReassess)}</span>
  <div style="position:absolute;left:28%;top:68%;width:31.4%;height:5.5%;font-family:Arial,sans-serif;font-size:9px;color:#000;white-space:pre-wrap;overflow:hidden">${(fd.remarks||'').replace(/</g,'&lt;')}</div>
  <div style="position:absolute;left:69%;top:68%;width:29.6%;height:5.5%;font-family:Arial,sans-serif;font-size:9px;color:#000;white-space:pre-wrap;overflow:hidden">${(fd.medication||'').replace(/</g,'&lt;')}</div>
  <span class="field" style="left:13.8%;top:74.5%;width:15%">${fd.certifiedBy || ''}</span>
  <span class="field" style="left:88%;top:74.5%;width:11%">${fd.certDate || ''}</span>
  <span class="field" style="left:13.8%;top:42.2%;width:12.6%">${fd.declDate || ''}</span>
</div>
<script>
  var img = document.querySelector('.page > img');
  if (img.complete) { setTimeout(function(){ window.print(); }, 300); }
  else { img.onload = function(){ setTimeout(function(){ window.print(); }, 300); }; }
<\/script>
</body></html>`;
  };

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=900,height=1200');
    win.document.write(buildPrintHTML());
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground">QE Medical Examination Form (Onshore Contractor)</h3>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="text-xs border border-border rounded-md px-2 py-1.5 bg-background max-w-xs"
          >
            <option value="">— Select Personnel to Auto-Fill —</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name} {emp.company ? `(${emp.company})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} className="gap-1.5">
            <Save className="w-3.5 h-3.5" /> {saved ? 'Saved!' : 'Save'}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Download
          </Button>
        </div>
      </div>

      {/* Form with overlay */}
      <div className="p-4 bg-gray-50 overflow-auto flex justify-center">
        <div
          ref={formRef}
          style={{ position: 'relative', width: '100%', maxWidth: '900px' }}
        >
          <img
            src={IMAGE_URL}
            alt="QE Medical Examination Form"
            style={{ width: '100%', height: 'auto', display: 'block' }}
            draggable={false}
          />
          <Overlay formData={formData} setFormData={setFormData} />
        </div>
      </div>
    </div>
  );
}