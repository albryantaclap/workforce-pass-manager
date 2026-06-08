import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Folder, Image, ChevronRight, Loader2, ArrowLeft, HardDrive } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

function isImage(item) {
  if (!item.file) return false;
  const ext = item.name.split('.').pop().toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

export default function SharePointFilePicker({ open, onClose, onSelect }) {
  const [loading, setLoading] = useState(false);
  const [drives, setDrives] = useState([]);
  const [selectedDrive, setSelectedDrive] = useState(null);
  const [items, setItems] = useState([]);
  const [breadcrumb, setBreadcrumb] = useState([]); // [{id, name}]
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) loadDrives();
  }, [open]);

  const call = async (payload) => {
    const res = await base44.functions.invoke('sharepointFileBrowser', payload);
    return res.data;
  };

  const loadDrives = async () => {
    setLoading(true);
    setError(null);
    setSelectedDrive(null);
    setItems([]);
    setBreadcrumb([]);
    try {
      const { site } = await call({ action: 'getSites' });
      const { drives } = await call({ action: 'getDrives', path: site.id });
      setDrives(drives);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const openDrive = async (drive) => {
    setSelectedDrive(drive);
    setBreadcrumb([]);
    loadFolder(drive.id, null, []);
  };

  const loadFolder = async (driveId, itemId, crumbs) => {
    setLoading(true);
    setError(null);
    try {
      const { items } = await call({ action: 'listFiles', driveId, itemId });
      setItems(items);
      setBreadcrumb(crumbs);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const openFolder = (item) => {
    const newCrumbs = [...breadcrumb, { id: item.id, name: item.name }];
    loadFolder(selectedDrive.id, item.id, newCrumbs);
  };

  const goBack = () => {
    if (breadcrumb.length === 0) {
      setSelectedDrive(null);
      return;
    }
    const newCrumbs = breadcrumb.slice(0, -1);
    const parentId = newCrumbs.length > 0 ? newCrumbs[newCrumbs.length - 1].id : null;
    loadFolder(selectedDrive.id, parentId, newCrumbs);
  };

  const selectImage = async (item) => {
    setLoading(true);
    try {
      const { downloadUrl } = await call({ action: 'getDownloadUrl', driveId: selectedDrive.id, itemId: item.id });
      onSelect(downloadUrl);
      onClose();
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const getThumbnail = (item) => {
    return item.thumbnails?.[0]?.small?.url || null;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Browse SharePoint</DialogTitle>
        </DialogHeader>

        {/* Breadcrumb nav */}
        {selectedDrive && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground border-b pb-2 flex-wrap">
            <button onClick={() => setSelectedDrive(null)} className="hover:text-foreground flex items-center gap-1">
              <HardDrive className="w-3 h-3" /> Drives
            </button>
            <ChevronRight className="w-3 h-3" />
            <button onClick={() => loadFolder(selectedDrive.id, null, [])} className="hover:text-foreground">{selectedDrive.name}</button>
            {breadcrumb.map((crumb, i) => (
              <React.Fragment key={crumb.id}>
                <ChevronRight className="w-3 h-3" />
                <button
                  onClick={() => {
                    const newCrumbs = breadcrumb.slice(0, i + 1);
                    loadFolder(selectedDrive.id, crumb.id, newCrumbs);
                  }}
                  className="hover:text-foreground"
                >{crumb.name}</button>
              </React.Fragment>
            ))}
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !selectedDrive ? (
            // Drive list
            <div className="grid grid-cols-2 gap-2 p-1">
              {drives.map(drive => (
                <button
                  key={drive.id}
                  onClick={() => openDrive(drive)}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent text-left"
                >
                  <HardDrive className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm truncate">{drive.name}</span>
                </button>
              ))}
            </div>
          ) : (
            // File/folder list
            <div className="grid grid-cols-3 gap-2 p-1">
              {items.filter(i => i.folder || isImage(i)).map(item => (
                <button
                  key={item.id}
                  onClick={() => item.folder ? openFolder(item) : selectImage(item)}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg border hover:bg-accent text-center group"
                >
                  {item.folder ? (
                    <Folder className="w-10 h-10 text-amber-400" />
                  ) : getThumbnail(item) ? (
                    <img src={getThumbnail(item)} alt={item.name} className="w-16 h-16 object-cover rounded" />
                  ) : (
                    <Image className="w-10 h-10 text-blue-400" />
                  )}
                  <span className="text-xs text-muted-foreground group-hover:text-foreground truncate w-full text-center">{item.name}</span>
                </button>
              ))}
              {items.filter(i => i.folder || isImage(i)).length === 0 && (
                <p className="col-span-3 text-center text-sm text-muted-foreground py-8">No images or folders found here.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between pt-2 border-t">
          {selectedDrive ? (
            <Button variant="outline" size="sm" onClick={goBack}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back
            </Button>
          ) : <div />}
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}