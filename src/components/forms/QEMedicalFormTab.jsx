import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download, Save, CheckCircle, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const IMAGE_URL = 'https://media.base44.com/images/public/69ce3261a82ad7bdfb8d8300/67bda378c_NEWMEDICALFORM_page-0001.jpg';

// Reference dimensions of the form image
const FW = 794;
const FH = 1123;

const pct = (x, y) => ({ left: `${(x / FW) * 100}%`, top: `${(y / FH) * 100}%` });
const sz = (w, h) => ({ width: `${(w / FW) * 100}%`, height: `${(h / FH) * 100}%` });

const baseInput = {
  position: 'absolute',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  fontFamily: 'Arial, sans-serif',
  color: '#000',
  padding: '0 2px',
  lineHeight: 1.2,
};

function TextField({ name, x, y, w, h, value, onChange, readOnly, fontSize = '1vw' }) {
  return (
    <input
      type="text"
      value={value || ''}
      onChange={e => onChange(name, e.target.value)}
      readOnly={readOnly}
      style={{
        ...baseInput,
        ...pct(x, y),
        ...sz(w, h),
        fontSize,
        cursor: readOnly ? 'default' : 'text',
        pointerEvents: 'all',
      }}
    />
  );
}

function CBField({ name, x, y, value, onChange }) {
  return (
    <div style={{ position: 'absolute', ...pct(x, y), width: '1.7vw', height: '1.7vw', pointerEvents: 'all' }}>
      <input
        type="checkbox"
        checked={!!value}
        onChange={e => onChange(name, e.target.checked)}
        style={{ cursor: 'pointer', accentColor: '#000', width: '100%', height: '100%' }}
      />
    </div>
  );
}

function TextArea({ name, x, y, w, h, value, onChange, fontSize = '0.8vw' }) {
  return (
    <textarea
      value={value || ''}
      onChange={e => onChange(name, e.target.value)}
      style={{
        ...baseInput,
        ...pct(x, y),
        ...sz(w, h),
        fontSize,
        resize: 'none',
        overflow: 'hidden',
        pointerEvents: 'all',
      }}
    />
  );
}

function Overlay({ fd, set, readOnly }) {
  const f = (name, x, y, w, h, fs) => (
    <TextField key={name} name={name} x={x} y={y} w={w} h={h} value={fd[name]} onChange={set} readOnly={readOnly[name]} fontSize={fs} />
  );
  const cb = (name, x, y) => (
    <CBField key={name} name={name} x={x} y={y} value={fd[name]} onChange={set} />
  );

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* Photo */}
      {fd._photoUrl && (
        <img src={fd._photoUrl} alt="" style={{ position: 'absolute', objectFit: 'cover', ...pct(14, 90), ...sz(93, 110), pointerEvents: 'none', borderRadius: 2 }} />
      )}

      {/* Row 1: First Name, Family Name, Staff No */}
      {f('firstName',  157, 88, 228, 16, '1vw')}
      {f('familyName', 468, 88, 178, 16, '1vw')}
      {f('staffNo',    690, 88, 95,  16, '1vw')}

      {/* Row 2: DOB, Nationality, QID */}
      {f('dob',         157, 106, 100, 16, '0.95vw')}
      {f('nationality', 330, 106, 115, 16, '0.95vw')}
      {f('qid',         618, 106, 168, 16, '0.95vw')}

      {/* Row 3: Gender, Occupation, Department */}
      {cb('genderMale',   204, 124)}
      {cb('genderFemale', 245, 124)}
      {f('occupation', 338, 124, 200, 16, '0.9vw')}
      {f('department', 595, 124, 192, 16, '0.9vw')}

      {/* Work Location row 1 */}
      {cb('wlNorth',  188, 141)}
      {cb('wlSouth',  233, 141)}
      {cb('wlBarzan', 281, 141)}
      {cb('wlLR',     321, 141)}
      {cb('wlRLTO',   352, 141)}
      {cb('wlRGA',    393, 141)}
      {cb('wlNFB',    430, 141)}
      {cb('wlEPC3',   472, 141)}

      {/* Work Location row 2 */}
      {cb('wlHQ',  162, 158)}
      {cb('wlQNT', 203, 158)}
      {cb('wlNFE', 246, 158)}
      {cb('wlNFS', 288, 158)}
      {cb('wlNFW', 330, 158)}

      {/* Work Area */}
      {cb('waPlant',    530, 158)}
      {cb('waNonPlant', 600, 158)}

      {/* Present Address, Contact */}
      {f('address', 188, 176, 206, 14, '0.85vw')}
      {f('contact', 496, 176, 116, 14, '0.85vw')}

      {/* Nature of Work */}
      {cb('nowConfined',   107, 202)} {cb('nowOffice',    246, 202)} {cb('nowSewage',  416, 202)} {cb('nowEmergency', 569, 202)}
      {cb('nowHeight',     107, 216)} {cb('nowDiving',    246, 216)} {cb('nowFood',    416, 216)} {cb('nowIonizing',  569, 216)}
      {cb('nowHanging',    107, 230)} {cb('nowDriving',   246, 230)}                              {cb('nowOthers',    569, 230)}
      {cb('drivLight', 278, 230)} {cb('drivBus', 336, 230)} {cb('drivTruck', 368, 230)} {cb('drivCrane', 402, 230)}

      {/* Vaccination */}
      {cb('vacHepA',    107, 256)}
      {cb('vacHepB',    328, 256)}
      {cb('vacTetanus', 554, 256)}
      {f('covidBrand', 183, 270, 100, 14, '0.8vw')}
      {f('dose1Date',  360, 270, 80,  14, '0.8vw')}
      {f('dose2Date',  496, 270, 80,  14, '0.8vw')}
      {f('dose3Date',  640, 270, 80,  14, '0.8vw')}

      {/* Medical History – left col */}
      {[['mhBlood',107,308],['mhPeptic',107,322],['mhEpilepsy',107,336],['mhWork',107,350],['mhEar',107,364],
        ['mhHeadache',107,378],['mhAbdominal',107,392],['mhSkin',107,406],['mhMusculo',107,420],['mhMental',107,434]
      ].map(([n,x,y]) => cb(n,x,y))}

      {/* Medical History – mid col */}
      {[['mhCNS',282,308],['mhHeart',282,322],['mhHBP',282,336],['mhDiabetes',282,350],['mhKidney',282,364],
        ['mhRheum',282,378],['mhFainting',282,392],['mhVascular',282,406],['mhHepatitis',282,420],['mhEye',282,434]
      ].map(([n,x,y]) => cb(n,x,y))}

      {/* Medical History – right col */}
      {[['mhChest',459,308],['mhSexual',459,322],['mhCancer',459,336],['mhMajor',459,350],['mhThyroid',459,364],
        ['mhPregnancy',459,378],['mhDrug',459,392],['mhTobacco',459,406],['mhHospital',459,420],['mhOthers',459,434]
      ].map(([n,x,y]) => cb(n,x,y))}

      {/* Declaration Date */}
      {f('declDate', 107, 473, 110, 14, '0.9vw')}

      {/* Section B – Biometrics */}
      {f('bp',     162, 514, 62, 14, '0.9vw')}
      {f('height', 300, 514, 52, 14, '0.9vw')}
      {f('pr',     162, 530, 62, 14, '0.9vw')}
      {f('weight', 300, 530, 52, 14, '0.9vw')}
      {f('rbs',    162, 546, 62, 14, '0.9vw')}
      {f('bmi',    287, 546, 52, 14, '0.9vw')}
      {f('bloodGroup', 162, 562, 62, 14, '0.9vw')}

      {/* Color Vision */}
      {cb('colorNormal',  536, 514)}
      {cb('colorPartial', 608, 514)}
      {cb('colorTotal',   674, 514)}

      {/* Visual Acuity */}
      {cb('vaUncorrected', 533, 533)}
      {cb('vaCorrected',   533, 547)}

      {/* Spirometry / ECG */}
      {cb('spirNormal',   300, 563)} {cb('spirAbnormal', 340, 563)}
      {cb('ecoNormal',    700, 563)} {cb('ecoAbnormal',  740, 563)}

      {/* Physical Exam – left */}
      {[['peEyes',107,619],['peENT',107,633],['peOral',107,647],['peHead',107,661],
        ['peLungs',107,675],['peCard',107,689],['peAbd',107,703]
      ].map(([n,x,y]) => (
        <React.Fragment key={n}>
          {cb(n+'N', x+130, y)}
          {cb(n+'A', x+168, y)}
        </React.Fragment>
      ))}

      {/* Physical Exam – right */}
      {[['peHern',459,619],['peNeur',459,633],['peExtr',459,647],['peMusc',459,661],
        ['peSkin',459,675],['peMent',459,689],['peOth', 459,703]
      ].map(([n,x,y]) => (
        <React.Fragment key={n}>
          {cb(n+'N', x+160, y)}
          {cb(n+'A', x+198, y)}
        </React.Fragment>
      ))}

      {/* Section C Fitness */}
      {cb('fitAssigned',   107, 766)}
      {cb('fitConditions', 107, 780)}
      {cb('fitUnfit',      107, 794)}
      {cb('fitReassess',   107, 808)}

      {/* Remarks & Medication */}
      <TextArea name="remarks"    x={220} y={764} w={248} h={58} value={fd.remarks}    onChange={set} />
      <TextArea name="medication" x={544} y={764} w={238} h={58} value={fd.medication} onChange={set} />

      {/* Certified by, Signature, Date */}
      {f('certifiedBy', 107, 835, 120, 14, '0.9vw')}
      {f('certSig',     320, 835, 200, 14, '0.9vw')}
      {f('certDate',    698, 835, 88,  14, '0.9vw')}
    </div>
  );
}

const AUTO_FILL_KEYS = ['firstName','familyName','staffNo','dob','nationality','qid','occupation','department','contact','address','genderMale','genderFemale','_photoUrl'];

export default function QEMedicalFormTab({ employees: propEmployees = [], selectedPersonnel = [] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [recordId, setRecordId] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [empSearch, setEmpSearch] = useState('');

  const { data: fetchedEmployees = [] } = useQuery({
    queryKey: ['employees-active-medical'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, 'name', 10000),
    enabled: propEmployees.length === 0,
  });
  const employees = propEmployees.length > 0 ? propEmployees : fetchedEmployees;

  // Existing records for selected employee
  const { data: existingRecords = [] } = useQuery({
    queryKey: ['medical-records', selectedEmpId],
    queryFn: () => base44.entities.MedicalExamRecord.filter({ employee_id: selectedEmpId }),
    enabled: !!selectedEmpId,
  });

  // Pre-select first from selectedPersonnel
  useEffect(() => {
    if (selectedPersonnel.length > 0 && !selectedEmpId) {
      setSelectedEmpId(selectedPersonnel[0].id);
    }
  }, [selectedPersonnel]);

  // Auto-fill when employee selected
  useEffect(() => {
    if (!selectedEmpId) { setFormData({}); setRecordId(null); return; }

    // If existing record found, restore it
    if (existingRecords.length > 0) {
      const rec = existingRecords[0];
      setRecordId(rec.id);
      setFormData(rec.form_data || {});
      return;
    }

    // Otherwise auto-fill from employee
    const emp = employees.find(e => e.id === selectedEmpId);
    if (!emp) return;
    const nameParts = (emp.name || '').trim().split(' ');
    setRecordId(null);
    setFormData({
      firstName:   nameParts[0] || '',
      familyName:  nameParts.slice(1).join(' ') || '',
      staffNo:     emp.staff_no || emp.qid_no || '',
      dob:         emp.dob || '',
      nationality: emp.nationality || '',
      qid:         emp.qid_no || emp.pp_no || '',
      occupation:  emp.position_application || emp.designation_org_chart || '',
      department:  emp.department || '',
      contact:     emp.contact_details || '',
      address:     emp.current_location === 'QATAR' ? 'DOHA, QATAR' : (emp.current_location || ''),
      _photoUrl:   emp.photo_url || '',
    });
  }, [selectedEmpId, existingRecords]);

  const setField = (name, value) => setFormData(p => ({ ...p, [name]: value }));

  // readOnly map – auto-filled personal fields are locked
  const readOnly = AUTO_FILL_KEYS.reduce((acc, k) => { acc[k] = !!selectedEmpId; return acc; }, {});

  const handleSave = async () => {
    if (!selectedEmpId) { toast({ title: 'Select a personnel first', variant: 'destructive' }); return; }
    setSaving(true);
    const emp = employees.find(e => e.id === selectedEmpId);
    const payload = {
      employee_id:   selectedEmpId,
      employee_name: emp?.name || '',
      form_version:  'QE-LNG-v1',
      form_data:     formData,
      status:        'draft',
    };
    try {
      if (recordId) {
        await base44.entities.MedicalExamRecord.update(recordId, payload);
      } else {
        const rec = await base44.entities.MedicalExamRecord.create(payload);
        setRecordId(rec.id);
      }
      qc.invalidateQueries(['medical-records', selectedEmpId]);
      toast({ title: 'Form saved successfully' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const buildPrintHTML = () => {
    const fd = formData;
    const chk = (v) => v ? '<span style="font-size:12px;font-weight:bold;color:#000">✓</span>' : '';
    const esc = (s) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const fieldSpan = (val, l, t, w, fs = 10) =>
      `<span style="position:absolute;left:${l}%;top:${t}%;width:${w}%;font-family:Arial,sans-serif;font-size:${fs}px;color:#000;overflow:hidden;white-space:nowrap">${esc(val)}</span>`;
    const chkSpan = (val, l, t) =>
      `<span style="position:absolute;left:${l}%;top:${t}%;font-size:11px;font-weight:bold;color:#000">${chk(val)}</span>`;

    const p = (x, y) => [(x/FW*100).toFixed(2), (y/FH*100).toFixed(2)];

    const rows = (items) => items.map(([k,x,y]) => chkSpan(fd[k], ...p(x,y))).join('');

    return `<!DOCTYPE html><html><head><title>QE Medical Examination Form</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:white}
  .page{position:relative;width:794px;margin:0 auto}
  .page>img{width:794px;height:auto;display:block}
  @media print{@page{margin:0;size:A4 portrait} body{margin:0} .page{width:100%} .page>img{width:100%}}
</style></head><body>
<div class="page">
<img src="${IMAGE_URL}" />
${fd._photoUrl ? `<img src="${fd._photoUrl}" style="position:absolute;left:${(14/FW*100).toFixed(2)}%;top:${(90/FH*100).toFixed(2)}%;width:${(93/FW*100).toFixed(2)}%;height:${(110/FH*100).toFixed(2)}%;object-fit:cover;" />` : ''}
${fieldSpan(fd.firstName,   ...[...(p(157,88)), (228/FW*100).toFixed(2)])}
${fieldSpan(fd.familyName,  ...[...(p(468,88)), (178/FW*100).toFixed(2)])}
${fieldSpan(fd.staffNo,     ...[...(p(690,88)), (95/FW*100).toFixed(2)])}
${fieldSpan(fd.dob,         ...[...(p(157,106)),(100/FW*100).toFixed(2)])}
${fieldSpan(fd.nationality, ...[...(p(330,106)),(115/FW*100).toFixed(2)])}
${fieldSpan(fd.qid,         ...[...(p(618,106)),(168/FW*100).toFixed(2)])}
${chkSpan(fd.genderMale,   ...p(204,124))} ${chkSpan(fd.genderFemale, ...p(245,124))}
${fieldSpan(fd.occupation,  ...[...(p(338,124)),(200/FW*100).toFixed(2)])}
${fieldSpan(fd.department,  ...[...(p(595,124)),(192/FW*100).toFixed(2)])}
${rows([['wlNorth',188,141],['wlSouth',233,141],['wlBarzan',281,141],['wlLR',321,141],['wlRLTO',352,141],['wlRGA',393,141],['wlNFB',430,141],['wlEPC3',472,141]])}
${rows([['wlHQ',162,158],['wlQNT',203,158],['wlNFE',246,158],['wlNFS',288,158],['wlNFW',330,158],['waPlant',530,158],['waNonPlant',600,158]])}
${fieldSpan(fd.address, ...[...(p(188,176)),(206/FW*100).toFixed(2)])}
${fieldSpan(fd.contact, ...[...(p(496,176)),(116/FW*100).toFixed(2)])}
${rows([['nowConfined',107,202],['nowOffice',246,202],['nowSewage',416,202],['nowEmergency',569,202],
        ['nowHeight',107,216],['nowDiving',246,216],['nowFood',416,216],['nowIonizing',569,216],
        ['nowHanging',107,230],['nowDriving',246,230],['nowOthers',569,230],
        ['drivLight',278,230],['drivBus',336,230],['drivTruck',368,230],['drivCrane',402,230]])}
${rows([['vacHepA',107,256],['vacHepB',328,256],['vacTetanus',554,256]])}
${fieldSpan(fd.covidBrand, ...[...(p(183,270)),(100/FW*100).toFixed(2)],9)}
${fieldSpan(fd.dose1Date,  ...[...(p(360,270)),(80/FW*100).toFixed(2)],9)}
${fieldSpan(fd.dose2Date,  ...[...(p(496,270)),(80/FW*100).toFixed(2)],9)}
${fieldSpan(fd.dose3Date,  ...[...(p(640,270)),(80/FW*100).toFixed(2)],9)}
${rows([['mhBlood',107,308],['mhPeptic',107,322],['mhEpilepsy',107,336],['mhWork',107,350],['mhEar',107,364],
        ['mhHeadache',107,378],['mhAbdominal',107,392],['mhSkin',107,406],['mhMusculo',107,420],['mhMental',107,434],
        ['mhCNS',282,308],['mhHeart',282,322],['mhHBP',282,336],['mhDiabetes',282,350],['mhKidney',282,364],
        ['mhRheum',282,378],['mhFainting',282,392],['mhVascular',282,406],['mhHepatitis',282,420],['mhEye',282,434],
        ['mhChest',459,308],['mhSexual',459,322],['mhCancer',459,336],['mhMajor',459,350],['mhThyroid',459,364],
        ['mhPregnancy',459,378],['mhDrug',459,392],['mhTobacco',459,406],['mhHospital',459,420],['mhOthers',459,434]])}
${fieldSpan(fd.declDate, ...[...(p(107,473)),(110/FW*100).toFixed(2)])}
${fieldSpan(fd.bp,         ...[...(p(162,514)),(62/FW*100).toFixed(2)])}
${fieldSpan(fd.height,     ...[...(p(300,514)),(52/FW*100).toFixed(2)])}
${fieldSpan(fd.pr,         ...[...(p(162,530)),(62/FW*100).toFixed(2)])}
${fieldSpan(fd.weight,     ...[...(p(300,530)),(52/FW*100).toFixed(2)])}
${fieldSpan(fd.rbs,        ...[...(p(162,546)),(62/FW*100).toFixed(2)])}
${fieldSpan(fd.bmi,        ...[...(p(287,546)),(52/FW*100).toFixed(2)])}
${fieldSpan(fd.bloodGroup, ...[...(p(162,562)),(62/FW*100).toFixed(2)])}
${rows([['colorNormal',536,514],['colorPartial',608,514],['colorTotal',674,514],
        ['vaUncorrected',533,533],['vaCorrected',533,547],
        ['spirNormal',300,563],['spirAbnormal',340,563],['ecoNormal',700,563],['ecoAbnormal',740,563]])}
${[['peEyes',107,619],['peENT',107,633],['peOral',107,647],['peHead',107,661],['peLungs',107,675],['peCard',107,689],['peAbd',107,703]].map(([n,x,y])=>rows([[n+'N',x+130,y],[n+'A',x+168,y]])).join('')}
${[['peHern',459,619],['peNeur',459,633],['peExtr',459,647],['peMusc',459,661],['peSkin',459,675],['peMent',459,689],['peOth',459,703]].map(([n,x,y])=>rows([[n+'N',x+160,y],[n+'A',x+198,y]])).join('')}
${rows([['fitAssigned',107,766],['fitConditions',107,780],['fitUnfit',107,794],['fitReassess',107,808]])}
<div style="position:absolute;left:${(220/FW*100).toFixed(2)}%;top:${(764/FH*100).toFixed(2)}%;width:${(248/FW*100).toFixed(2)}%;height:${(58/FH*100).toFixed(2)}%;font-family:Arial,sans-serif;font-size:8px;color:#000;white-space:pre-wrap;overflow:hidden">${esc(fd.remarks||'')}</div>
<div style="position:absolute;left:${(544/FW*100).toFixed(2)}%;top:${(764/FH*100).toFixed(2)}%;width:${(238/FW*100).toFixed(2)}%;height:${(58/FH*100).toFixed(2)}%;font-family:Arial,sans-serif;font-size:8px;color:#000;white-space:pre-wrap;overflow:hidden">${esc(fd.medication||'')}</div>
${fieldSpan(fd.certifiedBy,...[...(p(107,835)),(120/FW*100).toFixed(2)])}
${fieldSpan(fd.certSig,    ...[...(p(320,835)),(200/FW*100).toFixed(2)])}
${fieldSpan(fd.certDate,   ...[...(p(698,835)),(88/FW*100).toFixed(2)])}
</div>
<script>
var img=document.querySelector('.page>img');
function doPrint(){setTimeout(function(){window.print();},400);}
if(img.complete)doPrint(); else img.onload=doPrint;
<\/script>
</body></html>`;
  };

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=900,height=1200');
    win.document.write(buildPrintHTML());
    win.document.close();
  };

  const filteredEmps = employees.filter(e =>
    !empSearch || (e.name || '').toLowerCase().includes(empSearch.toLowerCase()) ||
    (e.company || '').toLowerCase().includes(empSearch.toLowerCase())
  );

  const selectedEmp = employees.find(e => e.id === selectedEmpId);

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-semibold shrink-0">QE Medical Examination Form</h3>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search personnel..."
              value={empSearch}
              onChange={e => setEmpSearch(e.target.value)}
              className="pl-7 pr-2 py-1.5 text-xs border border-border rounded-md bg-background w-44"
            />
          </div>
          <select
            value={selectedEmpId}
            onChange={e => { setSelectedEmpId(e.target.value); setEmpSearch(''); }}
            className="text-xs border border-border rounded-md px-2 py-1.5 bg-background max-w-xs"
          >
            <option value="">— Select Personnel —</option>
            {filteredEmps.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}{emp.company ? ` (${emp.company})` : ''}</option>
            ))}
          </select>
          {existingRecords.length > 0 && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Saved record loaded
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="p-4 bg-gray-50 overflow-auto flex justify-center">
        <div style={{ position: 'relative', width: '100%', maxWidth: '900px', userSelect: 'none' }}>
          <img
            src={IMAGE_URL}
            alt="QE Medical Examination Form"
            style={{ width: '100%', height: 'auto', display: 'block' }}
            draggable={false}
          />
          <Overlay fd={formData} set={setField} readOnly={readOnly} />
        </div>
      </div>
    </div>
  );
}