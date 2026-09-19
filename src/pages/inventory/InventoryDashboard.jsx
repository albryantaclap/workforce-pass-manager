import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, ArrowDownCircle, ArrowUpCircle, AlertTriangle, PackageX, Users, Boxes } from 'lucide-react';
import { useInventoryData } from '@/hooks/useInventoryData';
import { calculateDashboardStats as calcStats } from '@/lib/inventoryService';

export default function InventoryDashboard() {
  const { items, transactions, isLoading } = useInventoryData();
  const stats = calcStats(items, transactions);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  const kpiCards = [
    { label: 'Total Items', value: stats.totalItems, icon: Package, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Available Qty', value: stats.totalAvailable, icon: Boxes, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Stock Received', value: stats.totalStockIn, icon: ArrowDownCircle, color: 'text-green-600 bg-green-50' },
    { label: 'Stock Issued', value: stats.totalStockOut, icon: ArrowUpCircle, color: 'text-orange-600 bg-orange-50' },
    { label: 'Low Stock Items', value: stats.lowStockCount, icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
    { label: 'Out of Stock', value: stats.outOfStockCount, icon: PackageX, color: 'text-red-600 bg-red-50' },
    { label: 'Employees w/ Issued Items', value: stats.employeesWithIssuance, icon: Users, color: 'text-purple-600 bg-purple-50' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventory Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Live inventory overview calculated from transaction ledger</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className="border-slate-200">
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${kpi.color}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Low Stock & Out of Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.lowStockAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">All items are above minimum stock levels.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {stats.lowStockAlerts.map((a) => (
                  <div key={a.item_sn} className="flex items-center justify-between p-2 rounded-lg border border-slate-100">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{a.item_sn} — {a.item_name}</p>
                      <p className="text-xs text-muted-foreground">Min: {a.min_level} {a.unit}</p>
                    </div>
                    <div className="text-right ml-2">
                      <span className={`text-sm font-bold ${a.status === 'Out of Stock' ? 'text-red-600' : 'text-amber-600'}`}>
                        {a.available} {a.unit}
                      </span>
                      <p className={`text-[10px] font-semibold ${a.status === 'Out of Stock' ? 'text-red-500' : 'text-amber-500'}`}>
                        {a.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock by Store */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-500" />
              Stock by Store
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.stockByStore.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No store data available.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {stats.stockByStore.map((s) => (
                  <div key={s.store} className="flex items-center justify-between p-2 rounded-lg border border-slate-100">
                    <span className="text-sm font-medium">{s.store}</span>
                    <div className="flex gap-4 text-xs">
                      <span className="text-green-600">In: {s.stockIn}</span>
                      <span className="text-orange-600">Out: {s.stockOut}</span>
                      <span className="font-bold text-blue-600">Avail: {s.available}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No transactions recorded yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {transactions.slice(0, 10).map(t => (
                <div key={t.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 text-sm">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      t.transaction_type === 'STOCK_IN' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                    }`}>
                      {t.transaction_type.replace(/_/g, ' ')}
                    </span>
                    <span className="truncate">{t.item_sn} — {t.item_name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs ml-2">
                    <span className="text-muted-foreground">{t.transaction_date}</span>
                    <span className="font-bold">{t.transaction_type === 'STOCK_IN' ? '+' : '-'}{t.quantity_abs} {t.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}