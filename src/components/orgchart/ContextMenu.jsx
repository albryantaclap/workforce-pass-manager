import React from 'react';

export default function ContextMenu({ menu, onClose }) {
  if (!menu) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onPointerDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        className="fixed z-50 min-w-[210px] rounded-lg border bg-card shadow-xl py-1"
        style={{ left: Math.min(menu.x, window.innerWidth - 240), top: Math.min(menu.y, window.innerHeight - menu.items.length * 32 - 20) }}
      >
        {menu.items.map((item, i) => (
          item.separator ? (
            <div key={`sep-${i}`} className="my-1 border-t" />
          ) : (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => { onClose(); item.onClick?.(); }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-40 ${item.danger ? 'text-red-600' : ''}`}
            >
              {item.label}
            </button>
          )
        ))}
      </div>
    </>
  );
}