import React, { useState } from 'react';
import { cn } from '@/lib/utils';

// Literal size map — Tailwind JIT only generates classes that appear as literal
// strings in source. The previous `w-${size} h-${size}` template produced classes
// like `w-sm h-sm` that were never generated, so avatars rendered at their
// natural size (huge for photos). Map every supported size to literal classes.
const SIZE_CLASSES = {
  6: 'w-6 h-6 min-w-6 min-h-6 max-w-6 max-h-6 text-[9px]',
  8: 'w-8 h-8 min-w-8 min-h-8 max-w-8 max-h-8 text-[10px]',
  10: 'w-10 h-10 min-w-10 min-h-10 max-w-10 max-h-10 text-xs',
  12: 'w-12 h-12 min-w-12 min-h-12 max-w-12 max-h-12 text-sm',
  sm: 'w-8 h-8 min-w-8 min-h-8 max-w-8 max-h-8 text-[10px]',
  md: 'w-10 h-10 min-w-10 min-h-10 max-w-10 max-h-10 text-xs',
  lg: 'w-12 h-12 min-w-12 min-h-12 max-w-12 max-h-12 text-sm',
};

export default function PersonnelAvatar({ name, photoUrl, size = 8, className }) {
  const [imgError, setImgError] = useState(false);

  const initials = name
    ? name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
    : '?';

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES[8];

  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={name}
        onError={() => setImgError(true)}
        className={cn(
          sizeClass,
          'rounded-full object-cover flex-shrink-0 border border-border',
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        'rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center flex-shrink-0 border border-border',
        className
      )}
    >
      {initials}
    </div>
  );
}