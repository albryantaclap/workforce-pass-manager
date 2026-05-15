import React, { useState } from 'react';

export default function PersonnelAvatar({ name, photoUrl, size = 8 }) {
  const [imgError, setImgError] = useState(false);

  const initials = name
    ? name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
    : '?';

  const sizeClass = `w-${size} h-${size}`;
  const textSize = size <= 8 ? 'text-[10px]' : 'text-xs';

  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={name}
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 border border-border`}
      />
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center flex-shrink-0 ${textSize}`}>
      {initials}
    </div>
  );
}