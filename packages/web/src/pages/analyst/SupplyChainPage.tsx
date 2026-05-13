import { useState } from 'react';
import {
  Truck,
  AlertTriangle,
  Download,
  Filter,
  Package,
  TrendingDown,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { cn } from '@/utils/cn';
import { formatCompactNumber } from '@/utils/formatters';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const inventory = [
  { id: '1', drugName: 'Amoxicillin 250mg', stockUnits: 12500, daysOfSupply: 8, stockLevel: 'critical' as const, criticalityScore: 9.2, category: 'Antibiotic' },
  { id: '2', drugName: 'Metformin 500mg', stockUnits: 45000, daysOfSupply: 45, stockLevel: 'adequate' as const, criticalityScore: 7.5, category: 'Antidiabetic' },
  { id: '3', drugName: 'Lisinopril 10mg', stockUnits: 8200, daysOfSupply: 15, stockLevel: 'low' as const, criticalityScore: 8.0, category: 'Antihypertensive' },
  { id: '4', drugName: 'Paracetamol 500mg', stockUnits: 85000, daysOfSupply: 60, stockLevel: 'adequate' as const, criticalityScore: 6.0, category: 'Analgesic' },
  { id: '5', drugName: 'Insulin Glargine', stockUnits: 3200, daysOfSupply: 12, stockLevel: 'low' as const, criticalityScore: 9.8, category: 'Hormone' },
  { id: '6', drugName: 'Azithromycin 250mg', stockUnits: 1500, daysOfSupply: 4, stockLevel: 'critical' as const, criticalityScore: 8.5, category: 'Antibiotic' },
  { id: '7', drugName: 'Omeprazole 20mg', stockUnits: 22000, daysOfSupply: 30, stockLevel: 'adequate' as const, criticalityScore: 5.5, category: 'GI' },
  { id: '8', drugName: 'Ceftriaxone 1g', stockUnits: 800, daysOfSupply: 3, stockLevel: 'stockout' as const, criticalityScore: 9.5, category: 'Antibiotic' },
];

const forecastData = [
  { month: 'Jan', arima: 15200, prophet: 14800, lstm: 15500, actual: 15100 },
  { month: 'Feb', arima: 14800, prophet: 14500, lstm: 15000, actual: 14600 },
  { month: 'Mar', arima: 16000, prophet: 15800, lstm: 16200, actual: 16100 },
  { month: 'Apr', arima: 17500, prophet: 17200, lstm: 17800, actual: null },
  { month: 'May', arima: 18200, prophet: 17800, lstm: 18500, actual: null },
  { month: 'Jun', arima: 16800, prophet: 16500, lstm: 17100, actual: null },
];

const riskData = inventory.map((item) => ({
  name: item.drugName,
  stockoutProbability: item.stockLevel === 'stockout' ? 1 : item.stockLevel === 'critical' ? 0.8 : item.stockLevel === 'low' ? 0.4 : 0.1,
  criticality: item.criticalityScore,
  stock: item.stockUnits,
}));

const recommendedOrders = [
  { drug: 'Ceftriaxone 1g', supplier: 'Pharma Central Asia', quantity: 5000, orderDate: '2025-01-15', delivery: '2025-01-22', urgency: 'critical' },
  { drug: 'Amoxicillin 250mg', supplier: 'MedSupply UZ', quantity: 25000, orderDate: '2025-01-15', delivery: '2025-01-20', urgency: 'critical' },
  { drug: 'Azithromycin 250mg', supplier: 'Pharma Central Asia', quantity: 10000, orderDate: '2025-01-16', delivery: '2025-01-23', urgency: 'high' },
  { drug: 'Lisinopril 10mg', supplier: 'GlobaMed', quantity: 15000, orderDate: '2025-01-18', delivery: '2025-01-28', urgency: 'moderate' },
  { drug: 'Insulin Glargine', supplier: 'Novo Nordisk CA', quantity: 8000, orderDate: '2025-01-16', delivery: '2025-01-25', urgency: 'high' },
];

const stockLevelColors: Record<string, string> = {
  adequate: 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800',
  low: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800',
  critical: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
  stockout: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SupplyChainPage() {
  const [selectedDrug, setSelectedDrug] = useState('Amoxicillin 250mg');
  const [stockFilter, setStockFilter] = useState('all');

  const filteredInventory = inventory.filter(
    (item) => stockFilter === 'all' || item.stockLevel === stockFilter,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Supply Chain Forecasting
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Pharmaceutical inventory and demand forecasting
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Critical Items', value: inventory.filter((i) => i.stockLevel === 'critical').length, color: 'text-red-600', icon: AlertTriangle },
          { label: 'Low Stock', value: inventory.filter((i) => i.stockLevel === 'low').length, color: 'text-amber-600', icon: TrendingDown },
          { label: 'Stockout', value: inventory.filter((i) => i.stockLevel === 'stockout').length, color: 'text-purple-600', icon: Package },
          { label: 'Pending Orders', value: recommendedOrders.length, color: 'text-primary-600', icon: Truck },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center gap-3">
              <stat.icon className={cn('h-5 w-5', stat.color)} />
              <div>
                <p className="text-xs text-slate-500">{stat.label}</p>
                <p className={cn('text-xl font-bold', stat.color)}>{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-end gap-4">
        <Select
          label="Stock Level"
          options={[
            { value: 'all', label: 'All Levels' },
            { value: 'stockout', label: 'Stockout' },
            { value: 'critical', label: 'Critical' },
            { value: 'low', label: 'Low' },
            { value: 'adequate', label: 'Adequate' },
          ]}
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          fullWidth={false}
          startIcon={<Filter className="h-4 w-4" />}
        />
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pharmaceutical Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['Drug Name', 'Category', 'Stock (units)', 'Days of Supply', 'Stock Level', 'Criticality'].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500" scope="col">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredInventory.map((item) => (
                  <tr
                    key={item.id}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50',
                      selectedDrug === item.drugName && 'bg-primary-50/50 dark:bg-primary-950/30',
                    )}
                    onClick={() => setSelectedDrug(item.drugName)}
                  >
                    <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        {(item.stockLevel === 'critical' || item.stockLevel === 'stockout') && (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                        )}
                        {item.drugName}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-500">{item.category}</td>
                    <td className="px-3 py-3 font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                      {formatCompactNumber(item.stockUnits)}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        'font-medium tabular-nums',
                        item.daysOfSupply <= 5 ? 'text-red-600' : item.daysOfSupply <= 14 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300',
                      )}>
                        {item.daysOfSupply}d
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold capitalize', stockLevelColors[item.stockLevel])}>
                        {item.stockLevel}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-12 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className="h-full rounded-full bg-red-500"
                            style={{ width: `${item.criticalityScore * 10}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{item.criticalityScore}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Demand Forecast Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Demand Forecast: {selectedDrug}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-700" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactNumber(v)} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-lg text-xs dark:border-slate-700 dark:bg-slate-800">
                        <p className="font-semibold mb-1">{label}</p>
                        {payload.map((p) => (
                          <p key={p.name} style={{ color: p.color as string }}>
                            {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : 'N/A'}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="actual" stroke="#1e293b" strokeWidth={2.5} dot={{ r: 4 }} name="Actual" connectNulls={false} />
                <Line type="monotone" dataKey="arima" stroke="#25adb5" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="ARIMA" />
                <Line type="monotone" dataKey="prophet" stroke="#f99d07" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Prophet" />
                <Line type="monotone" dataKey="lstm" stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="LSTM" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Risk Assessment Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Assessment Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-700" />
                <XAxis
                  type="number"
                  dataKey="stockoutProbability"
                  name="Stockout Probability"
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Stockout Probability', position: 'bottom', fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="criticality"
                  name="Criticality"
                  domain={[0, 10]}
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Criticality Score', angle: -90, position: 'left', fontSize: 11 }}
                />
                <ZAxis type="number" dataKey="stock" range={[50, 400]} name="Stock" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as (typeof riskData)[0];
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-lg text-xs dark:border-slate-700 dark:bg-slate-800">
                        <p className="font-semibold">{d.name}</p>
                        <p>Stockout Risk: {(d.stockoutProbability * 100).toFixed(0)}%</p>
                        <p>Criticality: {d.criticality}/10</p>
                        <p>Stock: {d.stock.toLocaleString()} units</p>
                      </div>
                    );
                  }}
                />
                <Scatter data={riskData} name="Pharmaceuticals">
                  {riskData.map((entry, idx) => {
                    const risk = entry.stockoutProbability * entry.criticality / 10;
                    const color = risk > 0.6 ? '#ef4444' : risk > 0.3 ? '#f97316' : risk > 0.1 ? '#eab308' : '#22c55e';
                    return <Cell key={idx} fill={color} fillOpacity={0.7} />;
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recommended Orders */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary-600" />
            <CardTitle>Recommended Orders</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['Drug', 'Supplier', 'Quantity', 'Order Date', 'Est. Delivery', 'Urgency', ''].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500" scope="col">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {recommendedOrders.map((order) => (
                  <tr key={`${order.drug}-${order.supplier}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">{order.drug}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{order.supplier}</td>
                    <td className="px-3 py-3 font-medium tabular-nums text-slate-700 dark:text-slate-300">
                      {order.quantity.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-slate-500">{order.orderDate}</td>
                    <td className="px-3 py-3 text-slate-500">{order.delivery}</td>
                    <td className="px-3 py-3">
                      <Badge
                        variant={
                          order.urgency === 'critical' ? 'critical' : order.urgency === 'high' ? 'high' : 'warning'
                        }
                        size="sm"
                      >
                        {order.urgency}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Button variant="ghost" size="sm">
                        Place Order <ArrowRight className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
