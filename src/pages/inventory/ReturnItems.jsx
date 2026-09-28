import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Undo2, Search, ArrowDownLeft } from 'lucide-react';
import InventorySubmenuNav from '@/components/common/InventorySubmenuNav';
import PrintPageButton from '@/components/inventory/PrintPageButton';
import ReturnItemFormModal from '@/components/inventory/ReturnItemFormModal';
import { useInventoryData } from '@/hooks/useInventoryData';
import { useCurrentUser } from '@/lib/useCurrentUser';

export default function ReturnItems() {
  const { transactions, getLookupOptions, isLoading } = useInventoryData();
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [search, setSearch] = useState('');

  const stores = getLookupOptions('store');

  const stockOuts = useMemo(() => {
    return transactions
      .filter(function (t) { return t.transaction_type === 'STOCK_OUT' && !t.is_deleted; })
      .filter(function (t) {
        if (!search) return true;
        var q = search.toLowerCase();
        return (
          (t.item_sn || '').toLowerCase().includes(q) ||
          (t.item_name || '').toLowerCase().includes(q) ||
          (t.employee_name || '').toLowerCase().includes(q) ||
          (t.pid || '').toLowerCase().includes(q)
        );
      })
      .sort(function (a, b) { return (b.transaction_date || '').localeCompare(a.transaction_date || ''); });
  }, [transactions, search]);

  const returns = useMemo(() => {
    return transactions
      .filter(function (t) { return t.transaction_type === 'RETURN' && !t.is_deleted; })
      .sort(function (a, b) { return (b.transaction_date || '').localeCompare(a.transaction_date || ''); });
  }, [transactions]);

  const handleReturn = function (txn) {
    setSelectedTxn(txn);
    setShowForm(true);
  };

  const handleSaved = function () {
    queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
  };

  return (
    <div className="p-6 space-y-4">
      <InventorySubmenuNav />

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-md">
          <Undo2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Return Items</h1>
          <p className="text-sm text-muted-foreground">Process returned items and update stock accordingly</p>
        </div>
        <div className="ml-auto">
          <PrintPageButton title="Return Items" />
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={function (e) { setSearch(e.target.value); }}
          placeholder="Search by Item, Employee, PID..."
          className="pl-9"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-muted/30">
          <span className="text-sm font-semibold text-foreground">Issued Items — Click Return to process</span>
        </div>
        <div className="overflow-x-auto table-scroll-x">
          <table className="w-full text-xs table-list-view">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-2 font-semibold">DATE</th>
                <th className="px-3 py-2 font-semibold">ITEM</th>
                <th className="px-3 py-2 font-semibold">EMPLOYEE</th>
                <th className="px-3 py-2 font-semibold">COMPANY</th>
                <th className="px-3 py-2 font-semibold">ISSUED QTY</th>
                <th className="px-3 py-2 font-semibold text-right">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
              ) : stockOuts.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No issued items found.</td></tr>
              ) : stockOuts.slice(0, 100).map(function (t) {
                return (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground">{t.transaction_date}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{t.item_sn}</span>
                      <span className="text-muted-foreground block">{t.item_name}</span>
                    </td>
                    <td className="px-3 py-2">{t.employee_name || '\u2014'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{t.company || '\u2014'}</td>
                    <td className="px-3 py-2 font-bold">{t.quantity_abs} {t.unit}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="outline" onClick={function () { handleReturn(t); }} className="h-7 text-rose-600 border-rose-200 hover:bg-rose-50">
                        <Undo2 className="w-3.5 h-3.5" /> Return
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-muted/30">
          <span className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4 text-green-600" />
            Recent Returns ({returns.length})
          </span>
        </div>
        <div className="overflow-x-auto table-scroll-x">
          <table className="w-full text-xs table-list-view">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-2 font-semibold">DATE</th>
                <th className="px-3 py-2 font-semibold">ITEM</th>
                <th className="px-3 py-2 font-semibold">EMPLOYEE</th>
                <th className="px-3 py-2 font-semibold">RETURNED QTY</th>
                <th className="px-3 py-2 font-semibold">STORE</th>
                <th className="px-3 py-2 font-semibold">REASON</th>
              </tr>
            </thead>
            <tbody>
              {returns.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No returns processed yet.</td></tr>
              ) : returns.slice(0, 50).map(function (t) {
                return (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground">{t.transaction_date}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{t.item_sn}</span>
                      <span className="text-muted-foreground block">{t.item_name}</span>
                    </td>
                    <td className="px-3 py-2">{t.employee_name || '\u2014'}</td>
                    <td className="px-3 py-2 font-bold text-green-600">+{t.quantity_abs} {t.unit}</td>
                    <td className="px-3 py-2 text-muted-foreground">{t.store || '\u2014'}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{t.return_reason || '\u2014'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <ReturnItemFormModal
        open={showForm}
        onClose={function () { setShowForm(false); setSelectedTxn(null); }}
        onSaved={handleSaved}
        originalTxn={selectedTxn}
        stores={stores}
        user={user}
      />
    </div>
  );
}