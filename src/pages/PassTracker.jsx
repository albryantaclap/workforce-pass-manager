import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ShieldCheck, ShieldAlert, ShieldOff, Clock } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, differenceInDays } from 'date-fns';

function PassSection({ employees, type }) {
  const [search, setSearch] = useState('');
  const isRlic = type === 'rlic';

  const statusField = isRlic ? 'rlic_status' : 'pid_status';
  const expiryField = isRlic ? 'gate_pass_expiry' : 'pid_expiry';

  const categories = [
    { key: isRlic ? 'VALID RLIC PASS' : 'VALID PID PASS', label: 'Valid', icon: ShieldCheck, color: 'text-emerald-600' },
    { key: isRlic ? 'EXPIRED RLIC PASS' : 'EXPIRED PID PASS', label: 'Expired', icon: ShieldAlert, color: 'text-red-600' },
    { key: 'SOON TO EXPIRE', label: 'Soon to Expire', icon: Clock, color: 'text-amber-600' },
    { key: isRlic ? 'NO RLIC PASS' : 'NO PID PASS', label: 'No Pass', icon: ShieldOff, color: 'text-slate-500' },
  ];

  const [activeStatus, setActiveStatus] = useState(categories[1].key);

  const filtered = useMemo(() => {
    return employees.filter(emp => {
      const matchesStatus = emp[statusField] === activeStatus;
      const matchesSearch = !search || emp.name?.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [employees, activeStatus, search, statusField]);

  const today = new Date();

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex flex-wrap gap-3">
        {categories.map(cat => {
          const count = employees.filter(e => e[statusField] === cat.key).length;
          const isActive = activeStatus === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveStatus(cat.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                isActive ? 'bg-card border-primary shadow-sm' : 'bg-transparent border-transparent hover:bg-muted'
              }`}
            >
              <cat.icon className={`w-4 h-4 ${cat.color}`} />
              {cat.label}
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold">SL</TableHead>
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">Company</TableHead>
                <TableHead className="text-xs font-semibold">Designation</TableHead>
                <TableHead className="text-xs font-semibold">Staff No</TableHead>
                <TableHead className="text-xs font-semibold">{isRlic ? 'RLIC Status' : 'PID Status'}</TableHead>
                <TableHead className="text-xs font-semibold">Expiry</TableHead>
                <TableHead className="text-xs font-semibold">Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No employees in this category</TableCell></TableRow>
              ) : (
                filtered.map(emp => {
                  const expiry = emp[expiryField] ? parseISO(emp[expiryField]) : null;
                  const daysLeft = expiry ? differenceInDays(expiry, today) : null;
                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="text-xs">{emp.sl_no}</TableCell>
                      <TableCell className="text-sm font-medium">{emp.name}</TableCell>
                      <TableCell className="text-xs">{emp.company}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{emp.designation_org_chart}</TableCell>
                      <TableCell className="text-xs">{emp.staff_no || '—'}</TableCell>
                      <TableCell><StatusBadge status={emp[statusField]} short /></TableCell>
                      <TableCell className="text-xs">{expiry ? format(expiry, 'dd MMM yyyy') : '—'}</TableCell>
                      <TableCell>
                        {daysLeft !== null ? (
                          <span className={`text-xs font-semibold ${
                            daysLeft < 0 ? 'text-red-600' : daysLeft < 30 ? 'text-amber-600' : 'text-emerald-600'
                          }`}>
                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d over` : `${daysLeft}d`}
                          </span>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

export default function PassTracker() {
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 200),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-96" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pass Tracker</h2>
        <p className="text-sm text-muted-foreground mt-1">Monitor RLIC and PID pass status</p>
      </div>

      <Tabs defaultValue="rlic" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rlic">RLIC Pass</TabsTrigger>
          <TabsTrigger value="pid">Project ID</TabsTrigger>
        </TabsList>
        <TabsContent value="rlic">
          <PassSection employees={employees} type="rlic" />
        </TabsContent>
        <TabsContent value="pid">
          <PassSection employees={employees} type="pid" />
        </TabsContent>
      </Tabs>
    </div>
  );
}