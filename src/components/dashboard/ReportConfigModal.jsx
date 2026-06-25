import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Search, FileText, Users, LayoutDashboard } from 'lucide-react';

const REPORT_TYPES = [
  { id: 'summary', label: 'Workforce Summary Only', desc: 'Dashboard cards, charts, KPIs — no personnel table', icon: LayoutDashboard },
  { id: 'personnel', label: 'Personnel Details Only', desc: 'Employee records table only — no charts or summary cards', icon: Users },
  { id: 'combined', label: 'Combined Report', desc: 'Dashboard summary + charts + personnel details table', icon: FileText },
];

const DASHBOARD_SECTIONS = [
  { id: 'medical', label: 'Medical Data' },
  { id: 'gatepass', label: 'Gate Pass (RLIC)' },
  { id: 'training', label: 'Training' },
  { id: 'projectid', label: 'Project ID' },
  { id: 'company_headcount', label: 'Company Headcount' },
  { id: 'department_summary', label: 'Department Summary' },
  { id: 'location_summary', label: 'Location / Mobilized' },
  { id: 'dirindir', label: 'DIR / INDIR Summary' },
  { id: 'position_summary', label: 'Position Summary' },
  { id: 'status_overview', label: 'Pass & Status Overview' },
];

const GROUPING_OPTIONS = [
  { id: 'company', label: 'By Company', desc: 'Group employee records under each company' },
  { id: 'department', label: 'By Department', desc: 'Group employee records under each department' },
  { id: 'position', label: 'By Position', desc: 'Group records by position / designation' },
  { id: 'none', label: 'No Grouping', desc: 'Show raw filtered records in one flat list' },
];

export const ALL_PERSONNEL_COLUMNS = [
  { id: 'name', label: 'Full Name' },
  { id: 'qid_no', label: 'QID Number' },
  { id: 'pid', label: 'PID Number' },
  { id: 'qid_expiry', label: 'QID Expiry' },
  { id: 'company', label: 'Company' },
  { id: 'department', label: 'Department' },
  { id: 'designation_org_chart', label: 'Designation / Position' },
  { id: 'dir_indir', label: 'DIR / INDIR' },
  { id: 'current_location', label: 'Location' },
  { id: 'nationality', label: 'Nationality' },
  { id: 'contact_details', label: 'Mobile Number' },
  { id: 'ftw_result', label: 'Medical Status' },
  { id: 'rlic_status_computed', label: 'Gate Pass Status' },
  { id: 'training_status', label: 'Training Status' },
  { id: 'pid_status_computed', label: 'Project ID Status' },
  { id: 'gate_pass_expiry', label: 'Gate Pass Expiry' },
  { id: 'pid_expiry', label: 'PID Expiry' },
  { id: 'pp_no', label: 'Passport Number' },
  { id: 'pp_expiry', label: 'Passport Expiry' },
  { id: 'staff_no', label: 'Staff / RLIC No.' },
  { id: 'sponsor', label: 'Sponsor' },
  { id: 'is_active', label: 'Active Status' },
];

const SESSION_KEY = 'report_config';

function loadSaved() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || {}; } catch { return {}; }
}
function saveCfg(cfg) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(cfg)); } catch {}
}

export default function ReportConfigModal({ filtered, onClose, onGenerate }) {
  const saved = useMemo(loadSaved, []);

  const [reportType, setReportType] = useState(saved.reportType || 'combined');
  const [dashSections, setDashSections] = useState(saved.dashSections || DASHBOARD_SECTIONS.map(s => s.id));
  const [grouping, setGrouping] = useState(saved.grouping || 'company');
  const [selectedCols, setSelectedCols] = useState(saved.selectedCols || ALL_PERSONNEL_COLUMNS.map(c => c.id));
  const [colSearch, setColSearch] = useState('');

  const filteredCols = useMemo(() => {
    if (!colSearch.trim()) return ALL_PERSONNEL_COLUMNS;
    return ALL_PERSONNEL_COLUMNS.filter(c =>
      c.label.toLowerCase().includes(colSearch.toLowerCase())
    );
  }, [colSearch]);

  const toggleSection = (id) =>
    setDashSections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const toggleCol = (id) =>
    setSelectedCols(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const showDashSections = reportType !== 'personnel';
  const showPersonnelCols = reportType !== 'summary';
  const showGrouping = reportType !== 'summary';

  const handleGenerate = () => {
    const cfg = { reportType, dashSections, grouping, selectedCols };
    saveCfg(cfg);
    onGenerate(cfg);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-foreground">Report Configuration</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Customize your Workforce Report before generating</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

          {/* Section 1: Report Type */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">Section 1 — Report Type</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {REPORT_TYPES.map(rt => {
                const Icon = rt.icon;
                const active = reportType === rt.id;
                return (
                  <button key={rt.id} onClick={() => setReportType(rt.id)}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/40'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-xs font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>{rt.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{rt.desc}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 2: Dashboard Sections */}
          {showDashSections && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Section 2 — Dashboard Sections</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => setDashSections(DASHBOARD_SECTIONS.map(s => s.id))}>Select All</Button>
                  <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => setDashSections([])}>Unselect All</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DASHBOARD_SECTIONS.map(sec => (
                  <label key={sec.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted/40 cursor-pointer select-none">
                    <input type="checkbox" checked={dashSections.includes(sec.id)} onChange={() => toggleSection(sec.id)}
                      className="w-3.5 h-3.5 rounded accent-primary flex-shrink-0" />
                    <span className="text-xs text-foreground">{sec.label}</span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Section 3: Grouping */}
          {showGrouping && (
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-3">Section 3 — Personnel Grouping</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {GROUPING_OPTIONS.map(g => {
                  const active = grouping === g.id;
                  return (
                    <button key={g.id} onClick={() => setGrouping(g.id)}
                      className={`text-left p-2.5 rounded-lg border-2 transition-all ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                      <p className={`text-xs font-semibold mb-0.5 ${active ? 'text-primary' : 'text-foreground'}`}>{g.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{g.desc}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Section 4: Personnel Columns */}
          {showPersonnelCols && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Section 4 — Personnel Columns
                  <span className="ml-2 text-xs font-normal text-primary">{selectedCols.length} / {ALL_PERSONNEL_COLUMNS.length} selected</span>
                </h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => setSelectedCols(ALL_PERSONNEL_COLUMNS.map(c => c.id))}>Select All</Button>
                  <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => setSelectedCols([])}>Unselect All</Button>
                </div>
              </div>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search columns..." value={colSearch} onChange={e => setColSearch(e.target.value)} className="pl-9 h-8 text-xs" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto border rounded-lg p-2 bg-muted/20">
                {filteredCols.map(col => (
                  <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white cursor-pointer select-none">
                    <input type="checkbox" checked={selectedCols.includes(col.id)} onChange={() => toggleCol(col.id)}
                      className="w-3.5 h-3.5 rounded accent-primary flex-shrink-0" />
                    <span className="text-xs text-foreground truncate" title={col.label}>{col.label}</span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Section 5: Preview Summary */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">Section 5 — Report Summary Preview</h3>
            <div className="bg-muted/30 border rounded-xl px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Records', value: filtered.length.toLocaleString() },
                { label: 'Report Type', value: REPORT_TYPES.find(r => r.id === reportType)?.label || reportType },
                { label: 'Grouping', value: showGrouping ? GROUPING_OPTIONS.find(g => g.id === grouping)?.label : 'N/A' },
                { label: 'Dashboard Sections', value: showDashSections ? `${dashSections.length} of ${DASHBOARD_SECTIONS.length}` : 'N/A' },
                { label: 'Personnel Columns', value: showPersonnelCols ? `${selectedCols.length} of ${ALL_PERSONNEL_COLUMNS.length}` : 'N/A' },
              ].map(item => (
                <div key={item.label} className="text-center">
                  <div className="text-base font-bold text-foreground">{item.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-end gap-3 rounded-b-2xl">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleGenerate}
            disabled={
              (showDashSections && dashSections.length === 0 && reportType === 'summary') ||
              (showPersonnelCols && selectedCols.length === 0)
            }>
            Generate Report Preview
          </Button>
        </div>
      </div>
    </div>
  );
}