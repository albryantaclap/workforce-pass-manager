import React from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const SHORTCUTS = [
  ['Wheel', 'Zoom around the pointer'],
  ['Space + drag / middle drag / Hand tool', 'Pan the canvas'],
  ['Double-click empty space', 'Add a card at that point'],
  ['Double-click a card', 'Edit the card'],
  ['Drag a card’s edge dot', 'Draw a connector to another card'],
  ['Hover a card → + button', 'Add a subordinate card, already connected'],
  ['Right-click', 'Context menu (add, paste, arrange, fit)'],
  ['Shift + click / drag on empty space', 'Multi-select'],
  ['Ctrl/Cmd + C, V, D', 'Copy, paste, duplicate'],
  ['Ctrl/Cmd + Z, Shift + Z', 'Undo, redo'],
  ['Ctrl/Cmd + S', 'Save now'],
  ['Ctrl/Cmd + A', 'Select every card'],
  ['Arrow keys', 'Nudge the selection'],
  ['Delete', 'Delete the selection'],
  ['Esc', 'Clear the selection'],
];

export default function HelpDialog({ open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Working with the chart builder</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {SHORTCUTS.map(([key, description]) => (
            <div key={key} className="flex items-start justify-between gap-3 text-[11px] border-b last:border-0 py-1">
              <span className="font-medium">{key}</span>
              <span className="text-muted-foreground text-right">{description}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Cards stay exactly where you place them. Nothing is ever re-arranged automatically — auto layout runs only when you choose it.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}