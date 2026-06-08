import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Folder, Image, ChevronRight, Loader2, ArrowLeft, HardDrive, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';

function base64ToFile(base64, fileName, contentType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: contentType });
}

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
  const [nextLink, setNextLink] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([]); // [{id, name}]
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const searchTimeout = React.useRef(null);

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
    setSearch('');
    try {
      const res = await call({ action: 'listFiles', driveId, itemId });
      setItems(res.items || []);
      setNextLink(res.nextLink || null);
      setBreadcrumb(crumbs);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleSearch = (value) => {
    setSearch(value);
    clearTimeout(searchTimeout.current);
    if (!value.trim()) {
      // reload current folder
      const parentId = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : null;
      loadFolder(selectedDrive.id, parentId, breadcrumb);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const parentId = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : null;
        const res = await call({ action: 'searchFiles', driveId: selectedDrive.id, itemId: parentId, query: value });
        setItems(res.items || []);
        setNextLink(null);
      } catch (e) {
        setError(e.message);
      }
      setSearching(false);
    }, 500);
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
    setError(null);
    try {
      const { base64, contentType, fileName } = await call({ action: 'getDownloadUrl', driveId: selectedDrive.id, itemId: item.id });
      // Convert base64 to File and upload to Base44 storage for a stable embeddable URL
      const file = base64ToFile(base64, fileName, contentType);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onSelect(file_url);
      onClose();
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
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

        {selectedDrive && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search files and folders..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex-1 overflow-y-auto min-h-0">
          {(loading || searching) ? (
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
            <>
              <div className="grid grid-cols-3 gap-2 p-1">
                {items.filter(i => i.folder || isImage(i)).map(item => (
                  <button
                    key={item.id}
                    onClick={() => item.folder ? openFolder(item) : selectImage(item)}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border hover:bg-accent text-center group"
                  >
                    {item.folder ? (
                      <Folder className="w-10 h-10 text-amber-400" />
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
              {nextLink && !search && (
                <div className="flex justify-center py-2">
                  <Button variant="outline" size="sm" onClick={async () => {
                    setLoading(true);
                    try {
                      const parentId = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : null;
                      const res = await call({ action: 'listFiles', driveId: selectedDrive.id, itemId: parentId });
                      setItems(prev => [...prev, ...(res.items || [])]);
                      setNextLink(res.nextLink || null);
                    } catch (e) { setError(e.message); }
                    setLoading(false);
                  }}>Load more</Button>
                </div>
              )}
            </>
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