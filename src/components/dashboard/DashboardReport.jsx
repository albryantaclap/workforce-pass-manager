import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Printer, FileDown } from 'lucide-react';
import { computePassStatus, formatDate } from '@/utils/constants';

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] || 'Unknown';
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

function SummaryTable({ title, rows }) {
  return (
    <div className="mb-6 break-inside-avoid">
      <h3 className="text-sm font-bold text-slate-700 mb-2 border-b pb-1">{title}</h3>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="text-left p-1.5 border border-slate-200 font-semibold">Name</th>
            <th className="text-left p-1.5 border border-slate-200 font-semibold">Company</th>
            <th className="text-left p-1.5 border border-slate-200 font-semibold">Position</th>
            <th className="text-left p-1.5 border border-slate-200 font-semibold">Medical</th>
            <th className="text-left p-1.5 border border-slate-200 font-semibold">RLIC</th>
            <th className="text-left p-1.5 border border-slate-200 font-semibold">PID</th>
            <th className="text-left p-1.5 border border-slate-200 font-semibold">Training</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e, i) => {
            const rlic = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
            const pid = computePassStatus(e.pid_expiry, 'pid', e.pid_status);
            const rlicShort = rlic === 'VALID RLIC PASS' ? 'Valid' : rlic === 'EXPIRED RLIC PASS' ? 'Expired' : rlic === 'SOON TO EXPIRE' ? 'Soon' : rlic === 'NO RLIC PASS' ? 'No Pass' : rlic || '—';
            const pidShort = pid === 'VALID PID PASS' ? 'Valid' : pid === 'EXPIRED PID PASS' ? 'Expired' : pid === 'SOON TO EXPIRE' ? 'Soon' : pid === 'NO PID PASS' ? 'No Pass' : pid || '—';
            return (
              <tr key={e.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="p-1.5 border border-slate-200">{e.name}</td>
                <td className="p-1.5 border border-slate-200">{e.company}</td>
                <td className="p-1.5 border border-slate-200">{e.designation_org_chart || '—'}</td>
                <td className="p-1.5 border border-slate-200">{e.ftw_result || '—'}</td>
                <td className="p-1.5 border border-slate-200">{rlicShort}</td>
                <td className="p-1.5 border border-slate-200">{pidShort}</td>
                <td className="p-1.5 border border-slate-200">{e.training_status || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardReport({ filtered, categoryCards, companyCounts, allDepartments, onClose }) {
  const printRef = useRef(null);

  const byCompany = groupBy(filtered, 'company');
  const byDepartment = groupBy(filtered, 'department');
  const byPosition = groupBy(filtered, 'designation_org_chart');

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=1100,height=800');
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GSO Qatar Workforce Report</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; background: white; }
            .report-wrap { padding: 24px; max-width: 1050px; margin: 0 auto; }
            h1 { font-size: 20px; font-weight: 700; color: #0f172a; }
            h2 { font-size: 14px; font-weight: 700; color: #334155; margin: 20px 0 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
            h3 { font-size: 12px; font-weight: 700; color: #475569; margin: 12px 0 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th { background: #f1f5f9; text-align: left; padding: 5px 7px; border: 1px solid #cbd5e1; font-size: 10px; font-weight: 600; }
            td { padding: 4px 7px; border: 1px solid #cbd5e1; font-size: 10px; }
            tr:nth-child(even) td { background: #f8fafc; }
            .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
            .summary-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
            .card-title { font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 8px; }
            .stat-row { display: flex; justify-content: space-between; font-size: 10px; padding: 2px 0; }
            .stat-val { font-weight: 700; }
            .meta { color: #64748b; font-size: 10px; margin-bottom: 16px; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none; }
              h2 { page-break-before: auto; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="report-wrap">${content}</div>
          <script>setTimeout(() => window.print(), 300);</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold">Workforce Report Preview</h2>
          <div className="flex gap-2">
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="w-4 h-4" /> Print / Save PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        {/* Printable content */}
        <div className="p-6 overflow-auto">
          <div ref={printRef}>
            {/* Report Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900">GSO Qatar — Workforce Status Report</h1>
              <p className="text-sm text-slate-500 mt-1">Generated: {today} &nbsp;|&nbsp; Total Personnel: <strong>{filtered.length}</strong></p>
            </div>

            {/* Summary Cards */}
            <h2 className="text-base font-bold text-slate-700 mb-3 border-b-2 border-slate-200 pb-1">Dashboard Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {categoryCards.map(card => (
                <div key={card.title} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-7 h-7 rounded-lg ${card.bg} flex items-center justify-center`}>
                      <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">{card.title}</span>
                  </div>
                  <div className="space-y-1">
                    {card.stats.map(s => (
                      <div key={s.label} className="flex justify-between text-xs">
                        <span className="text-slate-500">{s.label}</span>
                        <span className={`font-bold ${s.color}`}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Personnel by Company count table */}
            <h2 className="text-base font-bold text-slate-700 mb-3 border-b-2 border-slate-200 pb-1">Headcount by Company</h2>
            <table className="w-full text-xs border-collapse mb-6">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left p-2 border border-slate-200 font-semibold">Company</th>
                  <th className="text-right p-2 border border-slate-200 font-semibold">Count</th>
                </tr>
              </thead>
              <tbody>
                {companyCounts.map((c, i) => (
                  <tr key={c.name} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="p-2 border border-slate-200">{c.name}</td>
                    <td className="p-2 border border-slate-200 text-right font-medium">{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* By Company */}
            <h2 className="text-base font-bold text-slate-700 mb-3 border-b-2 border-slate-200 pb-1">Personnel by Company</h2>
            {Object.entries(byCompany).sort((a,b) => b[1].length - a[1].length).map(([company, rows]) => (
              <SummaryTable key={company} title={`${company} (${rows.length})`} rows={rows} />
            ))}

            {/* By Department */}
            <h2 className="text-base font-bold text-slate-700 mb-3 border-b-2 border-slate-200 pb-1">Personnel by Department</h2>
            {Object.entries(byDepartment).sort((a,b) => b[1].length - a[1].length).map(([dept, rows]) => (
              <SummaryTable key={dept} title={`${dept} (${rows.length})`} rows={rows} />
            ))}

            {/* By Position */}
            <h2 className="text-base font-bold text-slate-700 mb-3 border-b-2 border-slate-200 pb-1">Personnel by Position / Designation</h2>
            {Object.entries(byPosition).sort((a,b) => b[1].length - a[1].length).map(([pos, rows]) => (
              <SummaryTable key={pos} title={`${pos} (${rows.length})`} rows={rows} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}