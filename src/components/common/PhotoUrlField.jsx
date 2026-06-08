import React, { useState, useEffect } from 'react';
import { User, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function PhotoUrlField({ photoUrl, name, onChange }) {
  const [imgError, setImgError] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Reset error when URL changes
  useEffect(() => { setImgError(false); }, [photoUrl]);

  const initials = name
    ? name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '';

  const showImage = photoUrl && !imgError;

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onChange(file_url);
    setUploading(false);
  };

  return (
    <div className="md:col-span-3 flex items-center gap-4">
      {/* Avatar preview */}
      <div className="w-20 h-20 rounded-full border-2 border-dashed border-border overflow-hidden flex items-center justify-center bg-muted flex-shrink-0 text-muted-foreground font-semibold text-lg">
        {showImage ? (
          <img
            src={photoUrl}
            alt="Photo"
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : initials ? (
          <span>{initials}</span>
        ) : (
          <User className="w-8 h-8" />
        )}
      </div>

      {/* Controls */}
      <div className="flex-1 space-y-2">
        <Label className="text-xs block">Profile Photo</Label>

        {/* URL input */}
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="Paste direct image URL (e.g. https://...photo.jpg)"
            value={photoUrl}
            onChange={e => onChange(e.target.value)}
            className="text-xs"
          />
          {photoUrl && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')} className="text-xs text-destructive shrink-0">
              Clear
            </Button>
          )}
        </div>

        {/* Upload fallback */}
        <div className="flex items-center gap-3">
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
              <span><Upload className="w-3.5 h-3.5 mr-1.5" />{uploading ? 'Uploading...' : 'Upload File'}</span>
            </Button>
          </label>
          <span className="text-[11px] text-muted-foreground">or paste a direct image URL above</span>
        </div>

        {imgError && photoUrl && (
          <p className="text-[11px] text-destructive">
            Cannot display this URL — SharePoint sharing links are not directly embeddable. Please upload the file instead, or use a direct image URL ending in .jpg / .png.
          </p>
        )}
      </div>
    </div>
  );
}