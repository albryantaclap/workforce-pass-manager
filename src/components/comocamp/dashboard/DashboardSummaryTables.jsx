import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { complianceItems } from './comoCampAggregations';

function ComplianceTable({ title, items, onRowClick }) {
  const [sortKey, setSortKey] = useState('total');
  const [sortDir, setSortDir] = useState('desc');
  const sorted = [...items].sort((a, b) =>
    sortDir === 'desc' ? (b[sortKey] - a[sortKey]) : (a[sortKey] - b[sortKey])
  );
  const toggle = (k) => {
    if (k === sortKey) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(k); setSortDir('desc'); }
  };
  const arrow = (k) => (sortKey === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '');
  const Head = ({ k, label, className }) => (
    <TableHead
      className={cn('text-xs bg-muted/50 cursor-pointer select-none whitespace-nowrap', className)}
      onClick={() => toggle(k)}
    >
      {label}{arrow(k)}
    </TableHead>
  );
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b bg-muted/30">
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <div className="table-scroll-y max-h-80">
        <Table className="table-list-view">
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs bg-muted/50">{title.split(' ')[0]}</TableHead>
              <Head k="total" label="Total" className="text-right" />
              <Head k="medAccepted" label="MD" className="text-right" />
              <Head k="gpValid" label="GP" className="text-right" />
              <Head k="trainDone" label="TR" className="text-right" />
              <Head k="pidValid" label="PID" className="text-right" />
              <Head k="completePct" label="Complete %" className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No data</TableCell>
              </TableRow>
            ) : sorted.map((it) => (
              <TableRow
                key={it.key}
                className={cn('hover:bg-muted/30', onRowClick && 'cursor-pointer')}
                onClick={onRowClick ? () => onRowClick(it.key) : undefined}
              >
                <TableCell className="text-xs font-medium uppercase">{it.label}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{it.total}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{it.medAccepted}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{it.gpValid}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{it.trainDone}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{it.pidValid}</TableCell>
                <TableCell className="text-xs text-right tabular-nums font-semibold">{it.completePct}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function DashboardSummaryTables({ agg, onDrillCompany, onDrillDepartment, onDrillPosition, onDrillManager }) {
  const companyItems = complianceItems(agg.byCompany);
  const deptItems = complianceItems(agg.byDepartment);
  const positionItems = complianceItems(agg.byPosition);
  const managerItems = complianceItems(agg.byManager);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ComplianceTable title="Company Compliance" items={companyItems} onRowClick={onDrillCompany} />
      <ComplianceTable title="Department Compliance" items={deptItems} onRowClick={onDrillDepartment} />
      <ComplianceTable title="Position Summary" items={positionItems} onRowClick={onDrillPosition} />
      <ComplianceTable title="Assigned Manager Summary" items={managerItems} onRowClick={onDrillManager} />
    </div>
  );
}