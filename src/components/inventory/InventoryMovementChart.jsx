import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/**
 * Stock Movement Trend — 6-month In vs Out bar chart.
 * Data: [{ month, stockIn, stockOut }, ...]
 */
export default function InventoryMovementChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          formatter={(v) => v.toLocaleString()}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="stockIn" name="Stock In" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="stockOut" name="Stock Out" fill="#f97316" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}