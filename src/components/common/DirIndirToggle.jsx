import React from 'react';

/**
 * DIR / INDIR toggle switch.
 * - Direct (DIR): red outline, handle on the left
 * - Indirect (INDIR): green outline, handle on the right
 * Clicking flips the value and saves it to the shared `dir_indir` field, so the
 * personnel list and the personnel forms stay in sync automatically.
 */
export default function DirIndirToggle({ value, onToggle, disabled = false, className = '' }) {
  const isIndirect = value === 'INDIR';
  const color = isIndirect ? '#10B981' : '#EF4444';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onToggle?.(isIndirect ? 'DIR' : 'INDIR');
      }}
      title={`${isIndirect ? 'Indirect' : 'Direct'}${disabled ? '' : ` — click to set ${isIndirect ? 'Direct' : 'Indirect'}`}`}
      className={`relative inline-flex items-center w-10 h-5 rounded-full border transition-colors ${disabled ? 'cursor-default' : 'cursor-pointer hover:shadow-sm'} ${className}`}
      style={{ borderColor: color }}
    >
      <span
        className="absolute w-3.5 h-3.5 rounded-full transition-all duration-200"
        style={{ backgroundColor: color, left: isIndirect ? 'calc(100% - 16px)' : '2px' }}
      />
    </button>
  );
}