import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package, ArrowDownCircle, ArrowUpCircle, AlertTriangle, PackageX,
  Users, Boxes, Activity, Archive, TrendingUp, MapPin, Tag, Truck,
  LayoutDashboard, FileBarChart,
} from 'lucide-react';
import { useInventoryData } from '@/hooks/useInventoryData';
import { calculateDashboardStats as calcStats } from '@/lib/inventoryService';
import InventoryMovementChart from '@/components/inventory/InventoryMovementChart';
import SubmenuNav from '@/components/common/SubmenuNav';

const fmt = (n) => (n || 0).toLocaleString();

const INVENTORY_SUBMENU = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/inventory', exact: true, gradient: 'from-blue-400 to-blue-600' },
  { label: 'Items', icon: Package, path: '/inventory/items', gradient: 'from-indigo-400 to-indigo-600' },
  { label: 'Stock In', icon: ArrowDownCircle, path: '/inventory/stock-in', gradient: 'from-green-400 to-green-600' },
  { label: 'Stock Out', icon: ArrowUpCircle, path: '/inventory/stock-out', gradient: 'from-orange-400 to-orange-500' },
  { label: 'Available Stock', icon: Boxes, path: '/inventory/available', gradient: 'from-emerald-400 to-teal-600' },
  { label: 'Transactions', icon: Activity, path: '/inventory/transactions', gradient: 'from-cyan-400 to-blue-600' },
  { label: 'Reports', icon: FileBarChart, path: '/inventory/reports', gradient: 'from-purple-400 to-purple-600' },
  { label: 'Employee Issuance', icon: Users, path: '/inventory/employee-issuance', gradient: 'from-violet-400 to-purple-600' },
];

export default function InventoryDashboard() {
  const { items, transactions, isLoading } = useInventoryData();
  const stats = calcStats(items, transactions);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  const kpiCards = [
    { label: 'Total Items', value: fmt(stats.totalItems), icon: Package, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Available Qty', value: fmt(stats.totalAvailable), icon: Boxes, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Stock Received', value: fmt(stats.totalStockIn), icon: ArrowDownCircle, color: 'text-green-600 bg-green-50' },
    { label: 'Stock Issued', value: fmt(stats.totalStockOut), icon: ArrowUpCircle, color: 'text-orange-600 bg-orange-50' },
    { label: 'Total Transactions', value: fmt(stats.totalTransactions), icon: Activity, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Low Stock Items', value: fmt(stats.lowStockCount), icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
    { label: 'Out of Stock', value: fmt(stats.outOfStockCount), icon: PackageX, color: 'text-red-600 bg-red-50' },
    { label: 'Dead Stock (No Movement)', value: fmt(stats.deadStockCount), icon: Archive, color: 'text-slate-600 bg-slate-100' },
    { label: 'Employees w/ Issued Items', value: fmt(stats.employeesWithIssuance), icon: Users, color: 'text-purple-600 bg-purple-50' },
    { label: 'Issuance Rate', value: `${stats.issuanceRate}%`, icon: TrendingUp, color: 'text-teal-600 bg-teal-50' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
          <Package className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live inventory overview calculated from transaction ledger</p>
        </div>
      </div>

      {/* Submenu Navigation */}
      <SubmenuNav items={INVENTORY_SUBMENU} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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

      {/* Stock Movement Trend */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-500" />
            Stock Movement Trend (Last 6 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InventoryMovementChart data={stats.monthlyMovement} />
        </CardContent>
      </Card>

      {/* Row: Low Stock Alerts | Stock by Store */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        {fmt(a.available)} {a.unit}
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
                      <span className="text-green-600">In: {fmt(s.stockIn)}</span>
                      <span className="text-orange-600">Out: {fmt(s.stockOut)}</span>
                      <span className="font-bold text-blue-600">Avail: {fmt(s.available)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row: Top Issued Items | Stock by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-orange-500" />
              Top Issued Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topIssuedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No items have been issued yet.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {stats.topIssuedItems.map((it, idx) => (
                  <div key={it.item_sn} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100">
                    <span className="w-6 h-6 rounded-full bg-orange-50 text-orange-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{it.item_sn} — {it.item_name}</p>
                    </div>
                    <span className="text-sm font-bold text-orange-600 ml-2">{fmt(it.qty)} {it.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-500" />
              Stock by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.stockByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No category data available.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {stats.stockByCategory.map((c) => (
                  <div key={c.category} className="flex items-center justify-between p-2 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-sm font-medium">{c.category}</span>
                      <span className="text-xs text-muted-foreground ml-2">({c.itemCount} items)</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">{fmt(c.available)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row: Stock by Site | Top Suppliers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-500" />
              Stock Issued by Site
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.stockBySite.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No site issuance data available.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {stats.stockBySite.map((s) => (
                  <div key={s.site} className="flex items-center justify-between p-2 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-sm font-medium">{s.site}</span>
                      <span className="text-xs text-muted-foreground ml-2">({s.txnCount} txns)</span>
                    </div>
                    <span className="text-sm font-bold text-rose-600">{fmt(s.stockOut)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-4 h-4 text-cyan-500" />
              Top Suppliers (by Volume)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No supplier data available.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {stats.topSuppliers.map((s, idx) => (
                  <div key={s.supplier} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100">
                    <span className="w-6 h-6 rounded-full bg-cyan-50 text-cyan-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium truncate flex-1">{s.supplier}</span>
                    <span className="text-xs text-muted-foreground">({s.txnCount})</span>
                    <span className="text-sm font-bold text-cyan-600 ml-2">{fmt(s.stockIn)}</span>
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
                    <span className="font-bold">{t.transaction_type === 'STOCK_IN' ? '+' : '-'}{fmt(t.quantity_abs)} {t.unit}</span>
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