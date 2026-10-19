import React from 'react';
import { Link } from 'react-router-dom';
import {
  Pencil, Copy, Trash2, UserPlus, Users, Link2, Palette, Lock, Unlock,
  ExternalLink, Plus, ChevronUp, Move,
} from 'lucide-react';

const SHADOWS = {
  none: 'none',
  sm: '0 1px 2px rgba(15,23,42,0.08)',
  md: '0 4px 12px rgba(15,23,42,0.14)',
  lg: '0 10px 28px rgba(15,23,42,0.2)',
};

const SHAPE_POINTS = {
  diamond: '50,2 98,50 50,98 2,50',
  hexagon: '22,3 78,3 98,50 78,97 22,97 2,50',
  parallelogram: '22,3 98,3 78,97 2,97',
};

export function initialsOf(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

const PORTS = ['top', 'right', 'bottom', 'left'];
const PORT_POS = {
  top: { left: '50%', top: 0, transform: 'translate(-50%, -50%)' },
  bottom: { left: '50%', bottom: 0, transform: 'translate(-50%, 50%)' },
  left: { left: 0, top: '50%', transform: 'translate(-50%, -50%)' },
  right: { right: 0, top: '50%', transform: 'translate(50%, -50%)' },
};

function fieldValue(field, node) {
  switch (field) {
    case 'designation': return node.designation;
    case 'department': return node.department;
    case 'company': return node.company;
    case 'project': return node.project_name;
    case 'employee_code': return node.employee_code;
    case 'pid': return node.pid;
    case 'email': return node.email;
    case 'phone': return node.phone;
    case 'manager': return node.manager_name;
    case 'employment_status': return node.employment_status;
    case 'planned_fill_date': return node.planned_fill_date;
    case 'position_grade': return node.position_grade;
    default: return null;
  }
}

function QuickActions({ node, onAction }) {
  const buttons = [
    { key: 'edit', icon: Pencil, title: 'Edit card' },
    { key: 'duplicate', icon: Copy, title: 'Duplicate' },
    { key: 'subordinate', icon: UserPlus, title: 'Add subordinate' },
    { key: 'manager', icon: ChevronUp, title: 'Add manager' },
    { key: 'sibling', icon: Users, title: 'Add sibling' },
    { key: 'connect', icon: Link2, title: 'Connect to another card' },
    { key: 'style', icon: Palette, title: 'Change style' },
    { key: 'lock', icon: node.is_locked ? Unlock : Lock, title: node.is_locked ? 'Unlock' : 'Lock' },
    { key: 'group', icon: Move, title: 'Group with other cards' },
    { key: 'view', icon: ExternalLink, title: 'View personnel record', href: node.linked_employee_id ? `/employees/${node.linked_employee_id}` : null },
    { key: 'delete', icon: Trash2, title: 'Delete', danger: true },
  ];
  return (
    <div
      className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-lg bg-slate-900 px-1 py-1 shadow-lg"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {buttons.map(({ key, icon: Icon, title, danger, href }) =>
        href ? (
          <Link key={key} to={href} title={title} className="p-1.5 rounded text-slate-300 hover:bg-slate-700 hover:text-white">
            <Icon className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <button
            key={key}
            type="button"
            title={title}
            onClick={() => onAction(key, node)}
            className={`p-1.5 rounded ${danger ? 'text-red-300 hover:bg-red-600 hover:text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        )
      )}
    </div>
  );
}

export default function NodeCard({
  node, settings, selected, multiSelected, canEdit, hovered,
  onPointerDown, onDoubleClick, onPortStart, onQuickAdd, onAction, onContextMenu,
}) {
  const styleKey = node.display_style || settings.card_style || 'business';
  const density = node.density || settings.density || 'standard';
  const accent = node.accent_color || settings.accent_color || '#254dd0';
  const borderColor = node.border_color || accent;
  const bg = node.background_color || '#ffffff';
  const textColor = node.text_color || '#0e1425';
  const radius = node.corner_radius ?? 12;
  const borderWidth = node.border_width ?? 1;
  const fontSize = node.font_size ?? 13;
  const fontWeight = node.font_weight || '600';
  const avatarSize = node.avatar_size ?? 44;
  const shadow = SHADOWS[node.shadow || 'sm'];
  const pad = node.padding ?? 14;
  const align = node.align || 'center';
  const visibleFields = settings.visible_fields || ['name', 'designation', 'department'];
  const isShape = node.node_kind === 'shape';
  const isText = node.node_kind === 'text';
  const isNote = node.node_kind === 'note';

  const showName = visibleFields.includes('name');
  const infoFields = visibleFields.filter(f => f !== 'name');
  const maxLines = density === 'minimal' ? 1 : density === 'standard' ? 5 : 30;
  const shownFields = infoFields.slice(0, maxLines);
  const showFooter = styleKey === 'business' && (density !== 'minimal');
  const footer = node.footer_text || (density === 'detailed' ? [node.company, node.project_name].filter(Boolean).join(' · ') : '');

  const wrapperStyle = {
    position: 'absolute',
    left: node.x,
    top: node.y,
    width: node.width || 260,
    height: node.height || 118,
    zIndex: node.z_index || 1,
    transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
    opacity: node.is_visible === false ? 0.25 : 1,
  };

  const boxStyle = {
    background: isNote ? '#fef9c3' : bg,
    border: `${isShape ? 0 : borderWidth}px solid ${borderColor}`,
    borderRadius: radius,
    boxShadow: shadow,
    color: textColor,
    fontSize,
    fontWeight,
    padding: pad,
    alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
    textAlign: align,
  };

  const isInteractiveHover = hovered || selected;

  return (
    <div
      style={wrapperStyle}
      data-node-id={node.id}
      onPointerDown={(e) => onPointerDown(node, e)}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(node); }}
      onContextMenu={(e) => onContextMenu(e, node.id)}
      onMouseEnter={() => onAction('hover', node)}
      onMouseLeave={() => onAction('hoverOut', node)}
      className="select-none"
    >
      {selected && !multiSelected && canEdit && <QuickActions node={node} onAction={onAction} />}

      {isShape ? (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          {SHAPE_POINTS[node.shape] ? (
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block', filter: shadow !== 'none' ? 'drop-shadow(0 1px 2px rgba(15,23,42,0.15))' : undefined }}>
              <polygon points={SHAPE_POINTS[node.shape]} fill={bg} stroke={borderColor} strokeWidth={borderWidth} vectorEffect="non-scaling-stroke" />
            </svg>
          ) : (
            <div
              style={{
                width: '100%', height: '100%', background: bg, border: `${borderWidth}px solid ${borderColor}`,
                borderRadius: node.shape === 'ellipse' || node.shape === 'circle' ? '50%' : node.shape === 'cylinder' ? '50% / 16%' : radius,
                boxShadow: shadow,
              }}
            />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-3" style={{ color: textColor, fontSize, fontWeight }}>
            <div className="text-center leading-tight">{showName && node.name}</div>
            {node.designation && <div className="text-[11px] font-normal opacity-80 text-center">{node.designation}</div>}
          </div>
        </div>
      ) : isText || isNote ? (
        <div
          style={{ ...boxStyle, display: 'flex', flexDirection: 'column', justifyContent: isNote ? 'flex-start' : 'center', height: '100%', gap: 4, overflow: 'hidden' }}
        >
          {showName && node.name && <div style={{ fontWeight: 700 }}>{node.name}</div>}
          <div className="w-full whitespace-pre-wrap text-[11px] font-normal leading-snug opacity-90">{node.text_content}</div>
        </div>
      ) : (
        <div style={{ ...boxStyle, display: 'flex', flexDirection: 'column', height: '100%', gap: 6, overflow: 'hidden', justifyContent: 'center' }}>
          {styleKey === 'photo' ? (
            <div className="flex flex-col items-center gap-1.5 w-full">
              <Avatar node={node} accent={accent} size={Math.max(56, avatarSize + 14)} />
              {showName && <div className="truncate w-full" style={{ fontWeight, fontSize: fontSize + 1 }}>{node.name}</div>}
              {shownFields.map(f => <FieldRow key={f} field={f} node={node} />)}
            </div>
          ) : styleKey === 'text' ? (
            <div className="flex flex-col w-full gap-0.5">
              {showName && <div className="truncate w-full">{node.name}</div>}
              {shownFields.map(f => <FieldRow key={f} field={f} node={node} />)}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 w-full" style={{ justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
              <Avatar node={node} accent={accent} size={avatarSize} />
              <div className="min-w-0 flex-1" style={{ textAlign: 'left' }}>
                {showName && <div className="truncate">{node.name}</div>}
                {shownFields.slice(0, 2).map(f => <FieldRow key={f} field={f} node={node} />)}
                {shownFields.slice(2).map(f => <FieldRow key={f} field={f} node={node} />)}
              </div>
            </div>
          )}
          {showFooter && footer && (
            <div className="w-full truncate text-[10px] font-normal uppercase tracking-wide opacity-70 border-t pt-1" style={{ borderColor: `${borderColor}44` }}>
              {footer}
            </div>
          )}
        </div>
      )}

      {canEdit && (isInteractiveHover || selected) && (
        <>
          {PORTS.map(port => (
            <button
              key={port}
              type="button"
              title={`Connect from ${port}`}
              style={{ position: 'absolute', ...PORT_POS[port], width: 10, height: 10, borderRadius: 9999, background: '#fff', border: `2px solid ${accent}`, cursor: 'crosshair' }}
              onPointerDown={(e) => { e.stopPropagation(); onPortStart(node, port, e); }}
            />
          ))}
        </>
      )}
      {canEdit && !node.is_locked && (isInteractiveHover || selected) && (
        <button
          type="button"
          title="Add subordinate card"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onQuickAdd(node)}
          style={{ position: 'absolute', left: '50%', bottom: -30, transform: 'translateX(-50%)', width: 20, height: 20, borderRadius: 9999, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
      {node.linked_employee_id && (
        <span
          title="Linked to the Master List"
          style={{ position: 'absolute', left: -8, top: -8, width: 18, height: 18, borderRadius: 9999, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Link2 className="w-2.5 h-2.5" />
        </span>
      )}
      {node.is_locked && (
        <span
          title="Locked"
          style={{ position: 'absolute', right: -8, top: -8, width: 18, height: 18, borderRadius: 9999, background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Lock className="w-2.5 h-2.5" />
        </span>
      )}
    </div>
  );
}

function Avatar({ node, accent, size }) {
  if (node.photo_url) {
    return (
      <img
        src={node.photo_url}
        alt={node.name || ''}
        draggable={false}
        style={{ width: size, height: size, borderRadius: 9999, objectFit: 'cover', border: `2px solid ${accent}33`, flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 9999, background: `${accent}18`, color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
        fontSize: Math.max(10, size / 2.8), flexShrink: 0,
      }}
    >
      {initialsOf(node.name)}
    </div>
  );
}

function FieldRow({ field, node }) {
  if (field === 'custom') {
    const extras = (node.extra_fields || []).filter(f => f.label || f.value);
    if (!extras.length) return null;
    return (
      <div className="flex flex-col w-full">
        {extras.map((f, i) => (
          <div key={i} className="truncate text-[10px] font-normal opacity-80">{f.label ? `${f.label}: ` : ''}{f.value}</div>
        ))}
      </div>
    );
  }
  const value = fieldValue(field, node);
  if (!value) return null;
  const isPrimary = field === 'designation';
  return (
    <div className={`truncate w-full ${isPrimary ? 'text-[11px] opacity-90' : 'text-[10px] font-normal opacity-70'}`}>{value}</div>
  );
}