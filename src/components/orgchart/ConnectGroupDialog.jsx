import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CONNECTOR_PATH_STYLES, CONNECTOR_TYPES } from '@/lib/orgChartConstants';
import { rootNodeOf } from '@/lib/orgChartMerge';

const field = 'h-8 w-full rounded-md border bg-background px-2 text-[11px]';

export default function ConnectGroupDialog({ open, group, groupNodes, candidates, onClose, onConnect }) {
  const [managerId, setManagerId] = useState('');
  const [rootId, setRootId] = useState('');
  const [type, setType] = useState('Direct Reporting');
  const [pathStyle, setPathStyle] = useState('orthogonal');

  useEffect(() => {
    if (!open) return;
    const root = rootNodeOf(groupNodes || []);
    setRootId(root?.id || '');
    setManagerId(candidates?.[0]?.id || '');
    setType('Direct Reporting');
    setPathStyle('orthogonal');
  }, [open, groupNodes, candidates]);

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Connect “{group?.name}” to a manager</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-[10px] text-muted-foreground">Manager card (in this chart)</span>
            <select value={managerId} onChange={(e) => setManagerId(e.target.value)} className={field}>
              {(candidates || []).map(node => (
                <option key={node.id} value={node.id}>{node.name || node.designation || 'Card'}</option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] text-muted-foreground">Department root card</span>
            <select value={rootId} onChange={(e) => setRootId(e.target.value)} className={field}>
              {(groupNodes || []).map(node => (
                <option key={node.id} value={node.id}>{node.name || node.designation || 'Card'}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-[10px] text-muted-foreground">Connector type</span>
              <select value={type} onChange={(e) => setType(e.target.value)} className={field}>
                {CONNECTOR_TYPES.map(item => <option key={item.key} value={item.key}>{item.key}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] text-muted-foreground">Line style</span>
              <select value={pathStyle} onChange={(e) => setPathStyle(e.target.value)} className={field}>
                {CONNECTOR_PATH_STYLES.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>

          <p className="text-[10px] text-muted-foreground">
            This draws a connector only. Master List reporting lines are never changed here.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            className="h-7 text-[11px]"
            disabled={!managerId || !rootId}
            onClick={() => onConnect({ managerId, rootId, type, pathStyle })}
          >
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}