import React from 'react';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function PassStatusChart({ employees }) {
  const statusCounts = employees.reduce((acc, emp) => {
    const rlic = emp.rlic_status || 'Unknown';
    acc[rlic] = (acc[rlic] || 0) + 1;
    return acc;
  }, {});

  const data = [
    { name: 'Valid', count: statusCounts['VALID RLIC PASS'] || 0, fill: 'hsl(142, 71%, 45%)' },
    { name: 'Expired', count: statusCounts['EXPIRED RLIC PASS'] || 0, fill: 'hsl(0, 84%, 60%)' },
    { name: 'Soon to Expire', count: statusCounts['SOON TO EXPIRE'] || 0, fill: 'hsl(38, 92%, 50%)' },
    { name: 'No Pass', count: statusCounts['NO RLIC PASS'] || 0, fill: 'hsl(220, 9%, 46%)' },
  ];

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold mb-4">RLIC Pass Status Overview</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(220, 13%, 91%)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}