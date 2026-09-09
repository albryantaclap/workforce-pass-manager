import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { getFirstIn } from '@/lib/attendanceEngine';

// Line chart of check-ins grouped by the hour of the first clock-in.
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const hourLabel = (h) => {
  const suffix = h < 12 ? 'am' : 'pm';
  const disp = h <= 12 ? h : h - 12;
  return `${disp}${suffix}`;
};

export default function CheckInsByHourChart({ employees, attendanceByPersonnel }) {
  const data = useMemo(() => {
    const counts = {};
    for (const h of HOURS) counts[h] = 0;
    for (const emp of employees) {
      const att = attendanceByPersonnel.get(emp.id);
      if (!att) continue;
      const firstIn = getFirstIn(att);
      if (!firstIn) continue;
      const d = new Date(firstIn);
      const h = d.getHours();
      if (counts.hasOwnProperty(h)) counts[h]++;
    }
    return HOURS.map(h => ({ hour: hourLabel(h), count: counts[h] }));
  }, [employees, attendanceByPersonnel]);

  const maxCount = Math.max(...data.map(d => d.count), 4);

  return (
    <Card className="p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Check-Ins by Hour</h3>
        <span className="text-xs text-muted-foreground">
          {data.reduce((s, d) => s + d.count, 0)} check-ins
        </span>
      </div>
      <div className="flex-1 min-h-[220px]">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              domain={[0, Math.ceil(maxCount)]}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: 8,
                border: '1px solid #e5e7eb',
              }}
              labelStyle={{ fontWeight: 600 }}
              formatter={(v) => [`${v} check-ins`, 'Count']}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}