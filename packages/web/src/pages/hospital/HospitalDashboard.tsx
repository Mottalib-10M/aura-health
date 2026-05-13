import {
  Building2,
  Users,
  DollarSign,
  Star,
  TrendingUp,
  AlertTriangle,
  BedDouble,
  Clock,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';
import { formatCurrency, formatPercentage } from '@/utils/formatters';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const kpis = [
  { label: 'Bed Occupancy', value: '78%', change: '+3%', icon: BedDouble, color: 'text-primary-600 bg-primary-100 dark:bg-primary-900' },
  { label: 'Staff on Duty', value: '142/180', change: '79%', icon: Users, color: 'text-secondary-600 bg-secondary-100 dark:bg-secondary-900' },
  { label: 'Monthly Revenue', value: '$2.4M', change: '+12%', icon: DollarSign, color: 'text-green-600 bg-green-100 dark:bg-green-900' },
  { label: 'Patient Satisfaction', value: '4.6/5', change: '+0.2', icon: Star, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900' },
];

const departmentLoad = [
  { name: 'Emergency', load: 95, capacity: 30, occupied: 28 },
  { name: 'Cardiology', load: 82, capacity: 40, occupied: 33 },
  { name: 'Surgery', load: 70, capacity: 50, occupied: 35 },
  { name: 'Pediatrics', load: 55, capacity: 35, occupied: 19 },
  { name: 'ICU', load: 90, capacity: 20, occupied: 18 },
  { name: 'Maternity', load: 65, capacity: 25, occupied: 16 },
  { name: 'Oncology', load: 45, capacity: 30, occupied: 13 },
];

const revenueTrend = [
  { month: 'Jul', revenue: 1800000, target: 2000000 },
  { month: 'Aug', revenue: 1950000, target: 2000000 },
  { month: 'Sep', revenue: 2100000, target: 2100000 },
  { month: 'Oct', revenue: 2050000, target: 2100000 },
  { month: 'Nov', revenue: 2250000, target: 2200000 },
  { month: 'Dec', revenue: 2400000, target: 2200000 },
];

const aiRecommendations = [
  {
    id: '1',
    type: 'scheduling',
    title: 'Reschedule Non-Urgent Surgeries',
    description: 'ICU occupancy at 90%. Recommend deferring 3 elective surgeries to next week to maintain emergency capacity.',
    priority: 'high',
    estimatedImpact: 'Free 3 ICU beds',
  },
  {
    id: '2',
    type: 'staffing',
    title: 'On-Call Staff Prediction',
    description: 'Based on seasonal patterns, expect 20% increase in ER visits this weekend. Recommend adding 2 nurses to Saturday shift.',
    priority: 'moderate',
    estimatedImpact: 'Reduce wait time by 25min',
  },
  {
    id: '3',
    type: 'supply',
    title: 'Antibiotic Stock Alert',
    description: 'Amoxicillin stock projected to reach critical level in 5 days. Current respiratory illness surge may accelerate depletion.',
    priority: 'high',
    estimatedImpact: 'Prevent stockout for 300+ patients',
  },
];

const bedMap = [
  { ward: 'General', total: 80, available: 22, reserved: 5 },
  { ward: 'ICU', total: 20, available: 2, reserved: 1 },
  { ward: 'Pediatric', total: 35, available: 16, reserved: 2 },
  { ward: 'Maternity', total: 25, available: 9, reserved: 1 },
  { ward: 'Surgical', total: 50, available: 15, reserved: 3 },
  { ward: 'Isolation', total: 10, available: 6, reserved: 0 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLoadColor(load: number): string {
  if (load >= 90) return '#ef4444';
  if (load >= 75) return '#f97316';
  if (load >= 50) return '#eab308';
  return '#22c55e';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HospitalDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Hospital Operations
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Tashkent City Clinical Hospital #1 - Real-time overview
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <div className="flex items-center justify-between">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', kpi.color)}>
                <kpi.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                <TrendingUp className="h-3 w-3" />
                {kpi.change}
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{kpi.value}</p>
            <p className="text-xs text-slate-500">{kpi.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Department Load */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Department Load</CardTitle>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> &lt;50%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500" /> 50-75%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" /> 75-90%</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> &gt;90%</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={departmentLoad} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-slate-100 dark:stroke-slate-700" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} className="text-slate-500" width={80} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as (typeof departmentLoad)[0];
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-lg text-xs dark:border-slate-700 dark:bg-slate-800">
                        <p className="font-semibold">{d.name}</p>
                        <p>Load: {d.load}%</p>
                        <p>Occupied: {d.occupied}/{d.capacity} beds</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="load" radius={[0, 4, 4, 0]} barSize={20}>
                  {departmentLoad.map((entry) => (
                    <Cell key={entry.name} fill={getLoadColor(entry.load)} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* AI Recommendations */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <CardTitle>AI Recommendations</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {aiRecommendations.map((rec) => (
                <div
                  key={rec.id}
                  className={cn(
                    'rounded-lg border p-3',
                    rec.priority === 'high'
                      ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30'
                      : 'border-slate-200 dark:border-slate-700',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {rec.title}
                    </p>
                    <Badge
                      variant={rec.priority === 'high' ? 'critical' : 'warning'}
                      size="sm"
                    >
                      {rec.priority}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{rec.description}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-2xs font-medium text-primary-600 dark:text-primary-400">
                      Impact: {rec.estimatedImpact}
                    </span>
                    <Button variant="ghost" size="sm">
                      Action <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bed Availability */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BedDouble className="h-4 w-4 text-primary-600" />
              <CardTitle>Real-Time Bed Availability</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500" scope="col">Ward</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500" scope="col">Total</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500" scope="col">Available</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500" scope="col">Reserved</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500" scope="col">Occupancy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {bedMap.map((ward) => {
                    const occupancy = ((ward.total - ward.available) / ward.total) * 100;
                    return (
                      <tr key={ward.ward} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            {ward.available <= 2 && (
                              <AlertTriangle className="h-3.5 w-3.5 text-red-500" aria-label="Low availability" />
                            )}
                            {ward.ward}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-400">{ward.total}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn(
                            'font-semibold',
                            ward.available <= 2 ? 'text-red-600' : ward.available <= 5 ? 'text-amber-600' : 'text-green-600',
                          )}>
                            {ward.available}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-slate-500">{ward.reserved}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${occupancy}%`,
                                  backgroundColor: getLoadColor(occupancy),
                                }}
                              />
                            </div>
                            <span className="text-xs text-slate-500">{occupancy.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-700" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-slate-400" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
                  className="text-slate-400"
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-lg text-xs dark:border-slate-700 dark:bg-slate-800">
                        <p className="font-semibold">{label}</p>
                        <p>Revenue: {formatCurrency(payload[0].value as number)}</p>
                        {payload[1] && <p>Target: {formatCurrency(payload[1].value as number)}</p>}
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="revenue" stroke="#25adb5" strokeWidth={2.5} dot={{ r: 4 }} name="Revenue" />
                <Line type="monotone" dataKey="target" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Target" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
