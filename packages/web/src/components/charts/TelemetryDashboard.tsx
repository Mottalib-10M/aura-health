import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  AreaChart,
  BarChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { Calendar, AlertTriangle } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import type { TimeSeriesDataPoint } from '@aura/shared/types/telemetry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TelemetryData {
  heartRate: TimeSeriesDataPoint[];
  spO2: TimeSeriesDataPoint[];
  hrvMs: TimeSeriesDataPoint[];
  sleepHours: TimeSeriesDataPoint[];
  steps: TimeSeriesDataPoint[];
}

export interface AnomalyPoint {
  timestamp: string;
  metric: string;
  value: number;
  expectedMin: number;
  expectedMax: number;
  severity: 'warning' | 'alert' | 'critical';
}

export interface TelemetryDashboardProps {
  /** All vitals data */
  data: TelemetryData;
  /** Detected anomalies to highlight */
  anomalies?: AnomalyPoint[];
  /** Height per chart */
  chartHeight?: number;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Date range options
// ---------------------------------------------------------------------------

type DateRange = '24h' | '7d' | '30d' | '90d';

const dateRangeOptions: { value: DateRange; label: string }[] = [
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ts: string, range: DateRange): string {
  const date = new Date(ts);
  if (range === '24h') {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function filterByRange(data: TimeSeriesDataPoint[], range: DateRange): TimeSeriesDataPoint[] {
  const now = Date.now();
  const msMap: Record<DateRange, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
  };
  const cutoff = now - msMap[range];
  return data.filter((d) => new Date(d.timestamp).getTime() >= cutoff);
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({ active, payload, label, unit }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {typeof payload[0].value === 'number' ? payload[0].value.toFixed(1) : payload[0].value} {unit}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TelemetryDashboard({
  data,
  anomalies = [],
  chartHeight = 180,
  className,
}: TelemetryDashboardProps) {
  const [range, setRange] = useState<DateRange>('7d');

  const filteredData = useMemo(
    () => ({
      heartRate: filterByRange(data.heartRate, range).map((d) => ({
        time: formatTimestamp(d.timestamp, range),
        value: d.value,
        ts: d.timestamp,
      })),
      spO2: filterByRange(data.spO2, range).map((d) => ({
        time: formatTimestamp(d.timestamp, range),
        value: d.value,
        ts: d.timestamp,
      })),
      hrvMs: filterByRange(data.hrvMs, range).map((d) => ({
        time: formatTimestamp(d.timestamp, range),
        value: d.value,
        ts: d.timestamp,
      })),
      sleepHours: filterByRange(data.sleepHours, range).map((d) => ({
        time: formatTimestamp(d.timestamp, range),
        value: d.value,
        ts: d.timestamp,
      })),
      steps: filterByRange(data.steps, range).map((d) => ({
        time: formatTimestamp(d.timestamp, range),
        value: d.value,
        ts: d.timestamp,
      })),
    }),
    [data, range],
  );

  const activeAnomalies = anomalies.filter(
    (a) => a.severity === 'alert' || a.severity === 'critical',
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with date range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Biometric Telemetry
          </h3>
          {activeAnomalies.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {activeAnomalies.length} anomal{activeAnomalies.length === 1 ? 'y' : 'ies'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
          {dateRangeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRange(opt.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                range === opt.value
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700',
              )}
              aria-label={`Show ${opt.label}`}
            >
              {opt.label}
            </button>
          ))}
          <Button variant="ghost" size="icon-sm" aria-label="Select custom date range">
            <Calendar className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Heart Rate - Line Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            Heart Rate (bpm)
          </h4>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={filteredData.heartRate}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-700" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} className="text-slate-400" />
              <YAxis domain={[40, 140]} tick={{ fontSize: 10 }} className="text-slate-400" />
              <Tooltip content={<ChartTooltip unit="bpm" />} />
              <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={60} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* SpO2 - Area Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            Blood Oxygen - SpO2 (%)
          </h4>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={filteredData.spO2}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-700" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} className="text-slate-400" />
              <YAxis domain={[88, 100]} tick={{ fontSize: 10 }} className="text-slate-400" />
              <Tooltip content={<ChartTooltip unit="%" />} />
              <ReferenceLine y={95} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.5} />
              <defs>
                <linearGradient id="spO2Gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#spO2Gradient)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* HRV - Bar Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            Heart Rate Variability (ms)
          </h4>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={filteredData.hrvMs}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-700" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} className="text-slate-400" />
              <YAxis tick={{ fontSize: 10 }} className="text-slate-400" />
              <Tooltip content={<ChartTooltip unit="ms" />} />
              <Bar
                dataKey="value"
                fill="#8b5cf6"
                fillOpacity={0.8}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Steps - Bar Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            Daily Steps
          </h4>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={filteredData.steps}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-700" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} className="text-slate-400" />
              <YAxis tick={{ fontSize: 10 }} className="text-slate-400" />
              <Tooltip content={<ChartTooltip unit="steps" />} />
              <ReferenceLine y={10000} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Bar
                dataKey="value"
                fill="#22c55e"
                fillOpacity={0.7}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sleep - Full-width stacked bar */}
        <div className="col-span-full rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            Sleep Duration (hours)
          </h4>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={filteredData.sleepHours}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-700" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} className="text-slate-400" />
              <YAxis domain={[0, 12]} tick={{ fontSize: 10 }} className="text-slate-400" />
              <Tooltip content={<ChartTooltip unit="hrs" />} />
              <ReferenceLine y={7} stroke="#6366f1" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: '7h target', fontSize: 10 }} />
              <Bar
                dataKey="value"
                fill="#6366f1"
                fillOpacity={0.6}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
