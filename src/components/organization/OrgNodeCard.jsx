import React from 'react';

export const DEPT_COLORS = {
  Electrical: '#3182CE',
  Mechanical: '#DD6B20',
  Civil: '#38B2AC',
  Services: '#805AD5',
};

export const getDeptColor = (dept) => DEPT_COLORS[dept] || '#718096';

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] || '';
  const b = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (a + b).toUpperCase();
}

export default function OrgNodeCard({ employee, pos, nodeWidth, nodeHeight, selected, highlighted, dimmed, hasChildren, onClick }) {
  const color = getDeptColor(employee.department);
  const position = employee.designation_org_chart || employee.position_application || '—';
  const ring = selected ? color : highlighted ? '#2D3748' : null;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        left: pos.x - nodeWidth / 2,
        top: pos.y,
        width: nodeWidth,
        height: nodeHeight,
        borderColor: color,
      }}
      className={`absolute rounded-md bg-white border shadow-sm cursor-pointer transition-opacity duration-150 ${dimmed ? 'opacity-30' : 'opacity-100'}`}
    >
      {/* Photo overlapping the left border */}
      <div
        className="absolute rounded-full bg-white flex items-center justify-center overflow-hidden ring-2 ring-white"
        style={{ left: -16, top: (nodeHeight - 38) / 2, width: 38, height: 38, boxShadow: `0 0 0 1.5px ${color}` }}
      >
        {employee.photo_url ? (
          <img src={employee.photo_url} alt={employee.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[12px] font-bold text-white" style={{ backgroundColor: color }}>
            {initials(employee.name)}
          </div>
        )}
      </div>

      {/* Selection / highlight ring */}
      {ring && (
        <div className="absolute -inset-[3px] rounded-md pointer-events-none" style={{ boxShadow: `0 0 0 2px ${ring}` }} />
      )}

      <div className="h-full flex flex-col justify-center pl-8 pr-2.5">
        <p className="text-[13px] font-bold leading-tight text-slate-800 line-clamp-2">{employee.name}</p>
        <p className="text-[11px] text-slate-600 leading-tight line-clamp-1 mt-0.5">{position}</p>
        <div className="flex items-center gap-1 mt-1">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
          <span className="text-[10px] text-slate-500 leading-none truncate">{employee.department || 'Unassigned'}</span>
        </div>
      </div>

      {/* Collapse / expand indicator */}
      {hasChildren && (
        <div
          className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border flex items-center justify-center text-[10px] text-slate-500 shadow-sm z-10"
          style={{ borderColor: color }}
        >
          {pos.collapsed ? '+' : '−'}
        </div>
      )}
    </div>
  );
}