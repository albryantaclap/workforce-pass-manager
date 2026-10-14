import React from 'react';

export default function DetailField({ label, value, full }) {
  const display = value || value === 0 ? String(value) : '—';
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm mt-0.5 break-words whitespace-pre-wrap">{display}</p>
    </div>
  );
}