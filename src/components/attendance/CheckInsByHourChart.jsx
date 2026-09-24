import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/card';

// Line chart of check-ins grouped by the hour of the first clock-in.
// Data is computed server-side by getAttendanceDashboard and passed as props.
export default function CheckInsByHourChart({ checkInsByHour = [] }) {
  const maxCount = Math.max(...checkInsByHour.map(d => d.count), 4);

  return (
    <Card className="p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Check-Ins by Hour</h3>
        <span className="text-xs text-muted-foreground">
          {checkInsByHour.reduce((s, d) => s + d.count, 0)} check-ins
        </span>
      </div>
      <div className="flex-1 min-h-[220px]">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={checkInsByHour} margin={{ top: 8, right: 8, left: -16, bottom: 4 }}>
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