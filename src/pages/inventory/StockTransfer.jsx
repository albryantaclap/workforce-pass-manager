import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeftRight, Printer, Search } from 'lucide-react';
import InventorySubmenuNav from '@/components/common/InventorySubmenuNav';
import StockTransferFormModal from '@/components/inventory/StockTransferFormModal';
import { printInternalDn } from '@/components/inventory/InternalDnPrint';
import { useInventoryData } from '@/hooks/useInventoryData';
import { useCurrentUser } from '@/lib/useCurrentUser';

export default function StockTransfer() {
  const { items, transactions, getLookupOptions, isLoading } = useInventoryData();
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');

  const stores = getLookupOptions('store');

  const transfers = useMemo(() => {
    return transactions
      .filter(t => t.transaction_type === 'TRANSFER' && !t.is_deleted)
      .filter(t => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          (t.internal_dn_no || '').toLowerCase().includes(q) ||
          (t.item_sn || '').toLowerCase().includes(q) ||
          (t.item_name || '').toLowerCase().includes(q) ||
          (t.transfer_from_store || '').toLowerCase().includes(q) ||
          (t.transfer_to_store || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.transaction_date || '').localeCompare(a.transaction_date || ''));
  }, [transactions, search]);

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
  };

  return (
    <div className="p-6 space-y-4">
      <InventorySubmenuNav />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-md">
            <ArrowLeftRight className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Stock Transfer</h1>
            <p className="text-sm text-muted-foreground">Transfer stock between stores with Internal Delivery Note</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
          <ArrowLeftRight className="w-4 h-4" /> New Transfer
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by DN No, Item, Store..."
          className="pl-9"
        />
      </div>

      {/* Transfers table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto table-scroll-x">
          <table className="w-full text-xs table-list-view">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-2 font-semibold">INTERNAL DN</th>
                <th className="px-3 py-2 font-semibold">DATE</th>
                <th className="px-3 py-2 font-semibold">ITEM</th>
                <th className="px-3 py-2 font-semibold">FROM STORE</th>
                <th className="px-3 py-2 font-semibold">TO STORE</th>
                <th className="px-3 py-2 font-semibold">QTY</th>
                <th className="px-3 py-2 font-semibold">REMARKS</th>
                <th className="px-3 py-2 font-semibold text-right">PRINT</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
              ) : transfers.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No stock transfers recorded yet.</td></tr>
              ) : transfers.map(t => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium text-blue-600">{t.internal_dn_no || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{t.transaction_date}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{t.item_sn}</span>
                    <span className="text-muted-foreground block">{t.item_name}</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{t.transfer_from_store || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{t.transfer_to_store || '—'}</td>
                  <td className="px-3 py-2 font-bold">{t.quantity_abs} {t.unit}</td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{t.remarks || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => printInternalDn(t)} className="h-7">
                      <Printer className="w-3.5 h-3.5" /> Print DN
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <StockTransferFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={handleSaved}
        items={items}
        stores={stores}
        user={user}
      />
    </div>
  );
}