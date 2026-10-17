import React, { useState, useEffect } from 'react';

/**
 * DIR / INDIR toggle switch.
 * - Direct (DIR): red, handle on the left
 * - Indirect (INDIR): green, handle on the right
 * Clickable: flips instantly on click (optimistic) and saves `dir_indir`, so the
 * personnel list and the personnel forms stay in sync.
 */
export default function DirIndirToggle({ value, onToggle, disabled = false, className = '' }) {
  const [local, setLocal] = useState(value);

  // Keep in sync when the record value changes (e.g. after a save/refetch)
  useEffect(() => { setLocal(value); }, [value]);

  const isIndirect = local === 'INDIR';
  const color = isIndirect ? '#10B981' : '#EF4444';

  const handleClick = (e) => {
    e.stopPropagation();
    if (disabled) return;
    const next = isIndirect ? 'DIR' : 'INDIR';
    setLocal(next);
    onToggle?.(next);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      aria-label={`DIR/INDIR: ${isIndirect ? 'Indirect' : 'Direct'}`}
      title={disabled
        ? (isIndirect ? 'Indirect' : 'Direct')
        : `${isIndirect ? 'Indirect' : 'Direct'} — click to set ${isIndirect ? 'Direct' : 'Indirect'}`}
      className={`relative inline-block rounded-full border-2 transition-colors ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'} ${className}`}
      style={{ width: 38, height: 20, borderColor: color }}
    >
      <span
        className="absolute rounded-full transition-all duration-200"
        style={{
          width: 12,
          height: 12,
          backgroundColor: color,
          top: '50%',
          transform: 'translateY(-50%)',
          left: isIndirect ? 22 : 2,
        }}
      />
    </button>
  );
}