import React from 'react';

/**
 * DIR / INDIR pill toggle used on the Admin Panel position list.
 * - Not set: neutral grey handle, centered
 * - DIR: red outline with the handle on the left
 * - INDIR: green fill with the handle on the right
 * Clicking flips the value (not set -> DIR -> INDIR -> DIR ...) and saves it.
 */
export default function DirIndirAssignToggle({ value, onToggle, disabled = false }) {
  const isIndirect = value === 'INDIR';
  const isSet = value === 'DIR' || value === 'INDIR';
  const color = !isSet ? '#9CA3AF' : (isIndirect ? '#10B981' : '#EF4444');
  const label = !isSet ? 'Not set' : (isIndirect ? 'Indirect' : 'Direct');

  const handleClick = (e) => {
    e.stopPropagation();
    if (disabled) return;
    onToggle?.(isIndirect ? 'DIR' : 'INDIR');
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      aria-label={`DIR/INDIR: ${label}`}
      title={disabled ? label : `${label} — click to set ${isIndirect ? 'Direct' : 'Indirect'}`}
      className={`relative inline-block rounded-full border-2 transition-colors ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'}`}
      style={{ width: 38, height: 20, borderColor: color }}
    >
      <span
        className="absolute rounded-full transition-all duration-200"
        style={{
          width: 12,
          height: 12,
          backgroundColor: isSet ? color : '#ffffff',
          border: isSet ? 'none' : `2px solid ${color}`,
          top: '50%',
          transform: 'translateY(-50%)',
          left: isIndirect ? 22 : (isSet ? 2 : 12),
        }}
      />
    </button>
  );
}