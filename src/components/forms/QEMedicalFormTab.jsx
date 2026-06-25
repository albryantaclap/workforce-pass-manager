import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Save, CheckCircle, Search, ChevronDown } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

// ─── The form image ───────────────────────────────────────────────────────────
const IMAGE_URL = 'https://media.base44.com/images/public/69ce3261a82ad7bdfb8d8300/67bda378c_NEWMEDICALFORM_page-0001.jpg';

// Natural pixel dimensions of the image
const FW = 794;
const FH = 1123;

// Convert pixel coords to percentage strings
const L = (x) => `${(x / FW * 100).toFixed(3)}%`;
const T = (y) => `${(y / FH * 100).toFixed(3)}%`;
const W = (w) => `${(w / FW * 100).toFixed(3)}%`;
const H = (h) => `${(h / FH * 100).toFixed(3)}%`;

// ─── Transparent text input ───────────────────────────────────────────────────
function TF({ name, x, y, w, h, value, onChange, readOnly, fontSize = 10.5, multiline = false }) {
  const style = {
    position: 'absolute',
    left: L(x), top: T(y), width: W(w), height: H(h),
    background: 'transparent',
    border: 'none',
    outline: 'none',
    padding: '0 1px',
    margin: 0,
    fontFamily: 'Arial, sans-serif',
    fontSize: `${fontSize}px`,
    color: '#1a1a1a',
    lineHeight: 1.15,
    resize: 'none',
    overflow: 'hidden',
    pointerEvents: 'all',
    cursor: readOnly ? 'default' : 'text',
    boxSizing: 'border-box',
    zIndex: 2,
  };
  if (multiline) {
    return (
      <textarea
        value={value || ''}
        onChange={e => onChange(name, e.target.value)}
        readOnly={readOnly}
        style={style}
      />
    );
  }
  return (
    <input
      type="text"
      value={value || ''}
      onChange={e => onChange(name, e.target.value)}
      readOnly={readOnly}
      style={style}
    />
  );
}

// ─── Invisible click target that shows ✓ inside the printed checkbox ──────────
// x,y = top-left of the existing printed checkbox square on the form
function CB({ name, x, y, size = 11, value, onChange, radio, radioGroup, radioValue }) {
  const checked = radio ? value === radioValue : !!value;

  const handleClick = () => {
    if (radio) {
      onChange(radioGroup, radioValue);
    } else {
      onChange(name, !value);
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'absolute',
        left: L(x), top: T(y),
        width: W(size), height: H(size),
        cursor: 'pointer',
        pointerEvents: 'all',
        zIndex: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked && (
        <span style={{
          fontSize: `${size * 0.95}px`,
          fontWeight: 'bold',
          color: '#000',
          lineHeight: 1,
          userSelect: 'none',
          fontFamily: 'Arial, sans-serif',
        }}>✓</span>
      )}
    </div>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────
function FormOverlay({ fd, set }) {
  const cb = (name, x, y, s = 11) => <CB key={name} name={name} x={x} y={y} size={s} value={fd[name]} onChange={set} />;
  const rbg = (group, val, x, y, s = 11) => <CB key={`${group}_${val}`} name={group} radioGroup={group} radio radioValue={val} x={x} y={y} size={s} value={fd[group]} onChange={set} />;
  const tf = (name, x, y, w, h, ro, fs = 10.5) => <TF key={name} name={name} x={x} y={y} w={w} h={h} value={fd[name]} onChange={set} readOnly={ro} fontSize={fs} />;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>

      {/* ── PHOTO ── */}
      {fd._photoUrl && (
        <img
          src={fd._photoUrl}
          alt=""
          style={{
            position: 'absolute',
            left: L(15), top: T(90),
            width: W(88), height: H(107),
            objectFit: 'cover',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      )}

      {/* ── Row 1: First Name, Family Name, Staff No ── */}
      {tf('firstName',  157, 89, 225, 14, true)}
      {tf('familyName', 467, 89, 175, 14, true)}
      {tf('staffNo',    691, 89,  94, 14, true, 10)}

      {/* ── Row 2: DOB, Nationality, Company (auto), QID ── */}
      {tf('dob',         157, 107,  95, 13, true, 10)}
      {tf('nationality', 322, 107, 108, 13, true, 10)}
      {tf('qid',         619, 107, 165, 13, true, 10)}

      {/* ── Row 3: Gender (radio), Occupation, Department ── */}
      {rbg('gender', 'Male',   211, 124)}
      {rbg('gender', 'Female', 253, 124)}
      {tf('occupation', 335, 123, 193, 14, true, 10)}
      {tf('department', 596, 123, 187, 14, true, 10)}

      {/* ── Work Location row 1 ── */}
      {cb('wlNorth',  192, 141)} {cb('wlSouth',  237, 141)} {cb('wlBarzan', 282, 141)}
      {cb('wlLR',     323, 141)} {cb('wlRLTO',   356, 141)} {cb('wlRGA',    397, 141)}
      {cb('wlNFB',    434, 141)} {cb('wlEPC3',   476, 141)}

      {/* ── Work Location row 2 ── */}
      {cb('wlHQ',  165, 158)} {cb('wlQNT', 207, 158)} {cb('wlNFE', 249, 158)}
      {cb('wlNFS', 292, 158)} {cb('wlNFW', 334, 158)}

      {/* ── Work Area ── */}
      {rbg('workArea', 'Plant',    534, 158)} {rbg('workArea', 'NonPlant', 605, 158)}

      {/* ── Address, Contact ── */}
      {tf('address', 190, 176, 200, 13, true, 10)}
      {tf('contact', 497, 176, 113, 13, true, 10)}

      {/* ── Nature of Work ── */}
      {cb('nowConfined',  110, 204)} {cb('nowOffice',    248, 204)} {cb('nowSewage',  418, 204)} {cb('nowEmergency', 571, 204)}
      {cb('nowHeight',    110, 218)} {cb('nowDiving',    248, 218)} {cb('nowFood',    418, 218)} {cb('nowIonizing',  571, 218)}
      {cb('nowHanging',   110, 232)} {cb('nowDriving',   248, 232)}                              {cb('nowOthers',    571, 232)}
      {cb('drivLight', 281, 232)} {cb('drivBus', 337, 232)} {cb('drivTruck', 370, 232)} {cb('drivCrane', 405, 232)}

      {/* ── Vaccination ── */}
      {cb('vacHepA',    110, 257)} {cb('vacHepB',  330, 257)} {cb('vacTetanus', 557, 257)}
      {tf('covidBrand', 183, 271,  95, 13, false, 9)}
      {tf('dose1Date',  358, 271,  70, 13, false, 9)}
      {tf('dose2Date',  492, 271,  70, 13, false, 9)}
      {tf('dose3Date',  638, 271,  70, 13, false, 9)}

      {/* ── Medical History left column ── */}
      {cb('mhBlood',    110, 309)} {cb('mhPeptic',   110, 323)} {cb('mhEpilepsy', 110, 337)}
      {cb('mhWork',     110, 351)} {cb('mhEar',      110, 365)} {cb('mhHeadache', 110, 379)}
      {cb('mhAbdomen',  110, 393)} {cb('mhSkin',     110, 407)} {cb('mhMusculo',  110, 421)}
      {cb('mhMental',   110, 435)}

      {/* ── Medical History middle column ── */}
      {cb('mhCNS',      284, 309)} {cb('mhHeart',    284, 323)} {cb('mhHBP',      284, 337)}
      {cb('mhDiabetes', 284, 351)} {cb('mhKidney',   284, 365)} {cb('mhRheum',    284, 379)}
      {cb('mhFainting', 284, 393)} {cb('mhVascular', 284, 407)} {cb('mhHepatitis',284, 421)}
      {cb('mhEye',      284, 435)}

      {/* ── Medical History right column ── */}
      {cb('mhChest',    461, 309)} {cb('mhSexual',   461, 323)} {cb('mhCancer',   461, 337)}
      {cb('mhMajor',    461, 351)} {cb('mhThyroid',  461, 365)} {cb('mhPregnancy',461, 379)}
      {cb('mhDrug',     461, 393)} {cb('mhTobacco',  461, 407)} {cb('mhHospital', 461, 421)}
      {cb('mhOthers',   461, 435)}

      {/* ── Declaration date ── */}
      {tf('declDate', 108, 474, 105, 13, false, 10)}

      {/* ── Section B — Biometrics ── */}
      {tf('bp',         167, 516, 58, 13, false, 10)}
      {tf('height',     300, 516, 50, 13, false, 10)}
      {tf('pr',         167, 530, 58, 13, false, 10)}
      {tf('weight',     300, 530, 50, 13, false, 10)}
      {tf('rbs',        167, 545, 58, 13, false, 10)}
      {tf('bmi',        287, 545, 50, 13, false, 10)}
      {tf('bloodGroup', 167, 559, 58, 13, false, 10)}

      {/* Color Vision */}
      {rbg('colorVision', 'Normal',  538, 516)} {rbg('colorVision', 'Partial', 610, 516)} {rbg('colorVision', 'Total', 676, 516)}

      {/* Visual Acuity */}
      {cb('vaUncorrected', 535, 533)} {cb('vaCorrected', 535, 547)}

      {/* Spirometry */}
      {rbg('spirometry', 'Normal', 303, 563)} {rbg('spirometry', 'Abnormal', 344, 563)}

      {/* ECG */}
      {rbg('ecg', 'Normal', 702, 563)} {rbg('ecg', 'Abnormal', 743, 563)}

      {/* ── Physical Examination left column (Normal / Abnormal) ── */}
      {[
        ['peEyes',  110, 621], ['peENT',   110, 635], ['peOral',  110, 649],
        ['peHead',  110, 663], ['peLungs', 110, 677], ['peCard',  110, 691],
        ['peAbd',   110, 705],
      ].map(([n, x, y]) => (
        <React.Fragment key={n}>
          {rbg(n, 'Normal',   x + 127, y)} {rbg(n, 'Abnormal', x + 167, y)}
        </React.Fragment>
      ))}

      {/* ── Physical Examination right column ── */}
      {[
        ['peHern', 461, 621], ['peNeur', 461, 635], ['peExtr', 461, 649],
        ['peMuscS',461, 663], ['peSkin', 461, 677], ['peMent', 461, 691],
        ['peOth',  461, 705],
      ].map(([n, x, y]) => (
        <React.Fragment key={n}>
          {rbg(n, 'Normal',   x + 157, y)} {rbg(n, 'Abnormal', x + 197, y)}
        </React.Fragment>
      ))}

      {/* ── Section C – Fitness ── */}
      {rbg('fitness', 'Assigned',   110, 768)}
      {rbg('fitness', 'Conditions', 110, 782)}
      {rbg('fitness', 'Unfit',      110, 796)}
      {rbg('fitness', 'Reassess',   110, 810)}

      {/* ── Remarks & Medication ── */}
      <TF name="remarks"    x={222} y={765} w={246} h={56} value={fd.remarks}    onChange={set} multiline fontSize={9} />
      <TF name="medication" x={545} y={765} w={237} h={56} value={fd.medication} onChange={set} multiline fontSize={9} />

      {/* ── Certified by / Signature / Date ── */}
      {tf('certBy',  108, 836, 118, 13, false, 10)}
      {tf('certSig', 318, 836, 195, 13, false, 10)}
      {tf('certDate',700, 836,  85, 13, false, 10)}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
const AUTO_LOCKED = ['firstName','familyName','staffNo','dob','nationality','qid','occupation','department','contact','address','_photoUrl','gender'];

export default function QEMedicalFormTab({ employees: propEmployees = [], selectedPersonnel = [] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [recordId, setRecordId] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [ddOpen, setDdOpen] = useState(false);

  const { data: fetchedEmps = [] } = useQuery({
    queryKey: ['employees-active-medical'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, 'name', 10000),
    enabled: propEmployees.length === 0,
  });
  const employees = propEmployees.length > 0 ? propEmployees : fetchedEmps;

  const { data: existingRecords = [] } = useQuery({
    queryKey: ['medical-records', selectedEmpId],
    queryFn: () => base44.entities.MedicalExamRecord.filter({ employee_id: selectedEmpId }),
    enabled: !!selectedEmpId,
  });

  // Pre-select from parent if provided
  useEffect(() => {
    if (selectedPersonnel.length > 0 && !selectedEmpId) {
      setSelectedEmpId(selectedPersonnel[0].id);
    }
  }, [selectedPersonnel]);

  // Load/auto-fill on employee change
  useEffect(() => {
    if (!selectedEmpId) { setFormData({}); setRecordId(null); return; }

    if (existingRecords.length > 0) {
      const rec = existingRecords[0];
      setRecordId(rec.id);
      setFormData(rec.form_data || {});
      return;
    }

    const emp = employees.find(e => e.id === selectedEmpId);
    if (!emp) return;
    const parts = (emp.name || '').trim().split(' ');
    setRecordId(null);
    setFormData({
      firstName:   parts[0] || '',
      familyName:  parts.slice(1).join(' ') || '',
      staffNo:     emp.staff_no || '',
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

  const handleSave = async () => {
    if (!selectedEmpId) { toast({ title: 'Select a personnel first', variant: 'destructive' }); return; }
    setSaving(true);
    const emp = employees.find(e => e.id === selectedEmpId);
    const payload = { employee_id: selectedEmpId, employee_name: emp?.name || '', form_version: 'QE-LNG-v1', form_data: formData, status: 'draft' };
    try {
      if (recordId) {
        await base44.entities.MedicalExamRecord.update(recordId, payload);
      } else {
        const rec = await base44.entities.MedicalExamRecord.create(payload);
        setRecordId(rec.id);
      }
      qc.invalidateQueries(['medical-records', selectedEmpId]);
      toast({ title: 'Form saved' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  // ── Print: inject filled values as absolutely-positioned spans over the image ──
  const handlePrint = () => {
    const fd = formData;
    const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const span = (val, x, y, w, fs=10) =>
      `<span style="position:absolute;left:${(x/FW*100).toFixed(3)}%;top:${(y/FH*100).toFixed(3)}%;width:${(w/FW*100).toFixed(3)}%;font-family:Arial,sans-serif;font-size:${fs}px;color:#1a1a1a;overflow:hidden;white-space:nowrap;line-height:1.15">${esc(val)}</span>`;
    const chk = (val, x, y, s=11) => val
      ? `<span style="position:absolute;left:${(x/FW*100).toFixed(3)}%;top:${(y/FH*100).toFixed(3)}%;font-size:${s}px;font-weight:bold;font-family:Arial,sans-serif;color:#000;line-height:1">✓</span>`
      : '';
    const rchk = (group, rval, x, y, s=11) => chk(fd[group]===rval, x, y, s);

    const html = `<!DOCTYPE html><html><head><title>QE Medical Examination Form</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:white}.page{position:relative;width:794px;margin:0 auto}.page>img{width:794px;height:auto;display:block}
@media print{@page{margin:0;size:A4 portrait}body{margin:0}.page{width:100%}.page>img{width:100%;height:auto}}</style></head><body>
<div class="page">
<img src="${IMAGE_URL}" />
${fd._photoUrl?`<img src="${fd._photoUrl}" style="position:absolute;left:${(15/FW*100).toFixed(3)}%;top:${(90/FH*100).toFixed(3)}%;width:${(88/FW*100).toFixed(3)}%;height:${(107/FH*100).toFixed(3)}%;object-fit:cover"/>` : ''}
${span(fd.firstName, 157,89,225)}${span(fd.familyName,467,89,175)}${span(fd.staffNo,691,89,94,10)}
${span(fd.dob,157,107,95,10)}${span(fd.nationality,322,107,108,10)}${span(fd.qid,619,107,165,10)}
${rchk('gender','Male',211,124)}${rchk('gender','Female',253,124)}
${span(fd.occupation,335,123,193,10)}${span(fd.department,596,123,187,10)}
${chk(fd.wlNorth,192,141)}${chk(fd.wlSouth,237,141)}${chk(fd.wlBarzan,282,141)}${chk(fd.wlLR,323,141)}${chk(fd.wlRLTO,356,141)}${chk(fd.wlRGA,397,141)}${chk(fd.wlNFB,434,141)}${chk(fd.wlEPC3,476,141)}
${chk(fd.wlHQ,165,158)}${chk(fd.wlQNT,207,158)}${chk(fd.wlNFE,249,158)}${chk(fd.wlNFS,292,158)}${chk(fd.wlNFW,334,158)}
${rchk('workArea','Plant',534,158)}${rchk('workArea','NonPlant',605,158)}
${span(fd.address,190,176,200,10)}${span(fd.contact,497,176,113,10)}
${chk(fd.nowConfined,110,204)}${chk(fd.nowOffice,248,204)}${chk(fd.nowSewage,418,204)}${chk(fd.nowEmergency,571,204)}
${chk(fd.nowHeight,110,218)}${chk(fd.nowDiving,248,218)}${chk(fd.nowFood,418,218)}${chk(fd.nowIonizing,571,218)}
${chk(fd.nowHanging,110,232)}${chk(fd.nowDriving,248,232)}${chk(fd.nowOthers,571,232)}
${chk(fd.drivLight,281,232)}${chk(fd.drivBus,337,232)}${chk(fd.drivTruck,370,232)}${chk(fd.drivCrane,405,232)}
${chk(fd.vacHepA,110,257)}${chk(fd.vacHepB,330,257)}${chk(fd.vacTetanus,557,257)}
${span(fd.covidBrand,183,271,95,9)}${span(fd.dose1Date,358,271,70,9)}${span(fd.dose2Date,492,271,70,9)}${span(fd.dose3Date,638,271,70,9)}
${['mhBlood','mhPeptic','mhEpilepsy','mhWork','mhEar','mhHeadache','mhAbdomen','mhSkin','mhMusculo','mhMental'].map((k,i)=>chk(fd[k],110,309+i*14)).join('')}
${['mhCNS','mhHeart','mhHBP','mhDiabetes','mhKidney','mhRheum','mhFainting','mhVascular','mhHepatitis','mhEye'].map((k,i)=>chk(fd[k],284,309+i*14)).join('')}
${['mhChest','mhSexual','mhCancer','mhMajor','mhThyroid','mhPregnancy','mhDrug','mhTobacco','mhHospital','mhOthers'].map((k,i)=>chk(fd[k],461,309+i*14)).join('')}
${span(fd.declDate,108,474,105)}
${span(fd.bp,167,516,58)}${span(fd.height,300,516,50)}${span(fd.pr,167,530,58)}${span(fd.weight,300,530,50)}
${span(fd.rbs,167,545,58)}${span(fd.bmi,287,545,50)}${span(fd.bloodGroup,167,559,58)}
${rchk('colorVision','Normal',538,516)}${rchk('colorVision','Partial',610,516)}${rchk('colorVision','Total',676,516)}
${chk(fd.vaUncorrected,535,533)}${chk(fd.vaCorrected,535,547)}
${rchk('spirometry','Normal',303,563)}${rchk('spirometry','Abnormal',344,563)}
${rchk('ecg','Normal',702,563)}${rchk('ecg','Abnormal',743,563)}
${[['peEyes',110,621],['peENT',110,635],['peOral',110,649],['peHead',110,663],['peLungs',110,677],['peCard',110,691],['peAbd',110,705]].map(([n,x,y])=>rchk(n,'Normal',x+127,y)+rchk(n,'Abnormal',x+167,y)).join('')}
${[['peHern',461,621],['peNeur',461,635],['peExtr',461,649],['peMuscS',461,663],['peSkin',461,677],['peMent',461,691],['peOth',461,705]].map(([n,x,y])=>rchk(n,'Normal',x+157,y)+rchk(n,'Abnormal',x+197,y)).join('')}
${rchk('fitness','Assigned',110,768)}${rchk('fitness','Conditions',110,782)}${rchk('fitness','Unfit',110,796)}${rchk('fitness','Reassess',110,810)}
<div style="position:absolute;left:${(222/FW*100).toFixed(3)}%;top:${(765/FH*100).toFixed(3)}%;width:${(246/FW*100).toFixed(3)}%;height:${(56/FH*100).toFixed(3)}%;font-family:Arial,sans-serif;font-size:9px;color:#1a1a1a;white-space:pre-wrap;overflow:hidden;line-height:1.3">${esc(fd.remarks||'')}</div>
<div style="position:absolute;left:${(545/FW*100).toFixed(3)}%;top:${(765/FH*100).toFixed(3)}%;width:${(237/FW*100).toFixed(3)}%;height:${(56/FH*100).toFixed(3)}%;font-family:Arial,sans-serif;font-size:9px;color:#1a1a1a;white-space:pre-wrap;overflow:hidden;line-height:1.3">${esc(fd.medication||'')}</div>
${span(fd.certBy,108,836,118)}${span(fd.certSig,318,836,195)}${span(fd.certDate,700,836,85)}
</div>
<script>
var img=document.querySelector('.page>img');
function go(){setTimeout(function(){window.print();},400);}
if(img.complete)go();else img.onload=go;
<\/script></body></html>`;

    const win = window.open('', '_blank', 'width=900,height=1200');
    win.document.write(html);
    win.document.close();
  };

  const filteredEmps = employees.filter(e =>
    !empSearch ||
    (e.name||'').toLowerCase().includes(empSearch.toLowerCase()) ||
    (e.company||'').toLowerCase().includes(empSearch.toLowerCase())
  );
  const selectedEmp = employees.find(e => e.id === selectedEmpId);

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-wrap gap-3 no-print">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold shrink-0">QE Medical Examination Form</span>

          {/* Personnel picker */}
          <div className="relative">
            <div className="flex items-center gap-1 border border-border rounded-md bg-background px-2 py-1.5 cursor-pointer text-xs min-w-[220px]" onClick={() => setDdOpen(v => !v)}>
              <Search className="w-3 h-3 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder={selectedEmp ? selectedEmp.name : 'Search personnel…'}
                value={empSearch}
                onChange={e => { setEmpSearch(e.target.value); setDdOpen(true); }}
                onClick={e => { e.stopPropagation(); setDdOpen(true); }}
                className="flex-1 bg-transparent border-none outline-none text-xs placeholder:text-muted-foreground"
              />
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            </div>
            {ddOpen && (
              <div className="absolute top-full left-0 z-50 bg-white border border-border rounded-md shadow-xl mt-1 w-72 max-h-56 overflow-y-auto">
                {filteredEmps.slice(0, 100).map(emp => (
                  <div
                    key={emp.id}
                    className={`px-3 py-2 text-xs cursor-pointer hover:bg-muted/50 ${selectedEmpId === emp.id ? 'bg-primary/10 text-primary font-medium' : ''}`}
                    onClick={() => { setSelectedEmpId(emp.id); setEmpSearch(''); setDdOpen(false); }}
                  >
                    {emp.name}{emp.company ? <span className="text-muted-foreground ml-1">({emp.company})</span> : ''}
                  </div>
                ))}
                {filteredEmps.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No results</div>}
              </div>
            )}
          </div>

          {existingRecords.length > 0 && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Saved record
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

      {/* ── Form canvas ── */}
      <div
        className="p-4 bg-gray-100 flex justify-center overflow-auto"
        onClick={() => ddOpen && setDdOpen(false)}
      >
        <div style={{ position: 'relative', width: '100%', maxWidth: '900px', userSelect: 'none' }}>
          <img
            src={IMAGE_URL}
            alt="QE Medical Examination Form"
            style={{ width: '100%', height: 'auto', display: 'block' }}
            draggable={false}
          />
          <FormOverlay fd={formData} set={setField} />
        </div>
      </div>

      <style>{`
        @media print { .no-print { display: none !important; } }
      `}</style>
    </div>
  );
}