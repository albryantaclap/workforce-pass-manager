import React from 'react';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Pencil } from 'lucide-react';

/**
 * Actions cell for a recorded Stock In / Stock Out line — the same icon size,
 * spacing and hover behaviour used on the Inventory Items page.
 * Each action only appears when the user holds the matching permission.
 */
export default function TransactionActions({ showWarranty, showEdit, onWarranty, onEdit }) {
  if (!showWarranty && !showEdit) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex gap-1">
      {showWarranty && (
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Warranty Details" onClick={onWarranty}>
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        </Button>
      )}
      {showEdit && (
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit" onClick={onEdit}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}