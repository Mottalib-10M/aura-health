import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OutbreakTrendDataPoint {
  date: string;
  newCases: number;
  cumulativeCases: number;
  movingAverage7d: number;
  threshold?: number;
}

export interface AlertLevelEntry {
  date: string;
  level: 'watch' | 'warning' | 'alert' | 'emergency';
}

export interface OutbreakTrendChartProps {
  /** Time-series outbreak data */
  data: OutbreakTrendDataPoint[];
  /** Alert level transitions */
  alertLevels?: AlertLevelEntry[];
  /** Disease name */
  diseaseName: string;
  /** Chart height */
  height?: number;
  /** Show cumulative toggle */
  showCumulative?: boolean;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Alert level colors
// ---------------------------------------------------------------------------

const alertColors: Record<string, string> = {
  watch: '#22c55e',
  warning: '#eab308',
  alert: '#f97316',
  emergency: '#ef4444',
};

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <p className="mb-1.5 text-xs font-medium text-slate-500">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-500">{entry.name}:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OutbreakTrendChart({
  data,
  alertLevels = [],
  diseaseName,
  height = 350,
  showCumulative = false,
  className,
}: OutbreakTrendChartProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        date: new Date(d.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      })),
    [data],
  );

  // Find threshold value (use the first available or a static value)
  const thresholdValue = useMemo(() => {
    const withThreshold = data.find((d) => d.threshold !== undefined);
    return withThreshold?.threshold;
  }, [data]);

  // Build alert level reference areas
  const alertTransitions = useMemo(() => {
    if (alertLevels.length === 0) return [];
    return alertLevels.map((entry, idx) => ({
      ...entry,
      formattedDate: new Date(entry.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      nextDate:
        idx < alertLevels.length - 1
          ? new Date(alertLevels[idx + 1].date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
          : undefined,
    }));
  }, [alertLevels]);

  return (
    <div className={cn('w-full', className)}>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {diseaseName} - Outbreak Trend
        </h4>
        <div className="flex items-center gap-3 text-xs">
          {Object.entries(alertColors).map(([level, color]) => (
            <div key={level} className="flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="capitalize text-slate-500">{level}</span>
            </div>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-700" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            className="text-slate-400"
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10 }}
            className="text-slate-400"
          />
          {showCumulative && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10 }}
              className="text-slate-400"
            />
          )}
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

          {/* Alert level reference lines */}
          {alertTransitions.map((alert) => (
            <ReferenceLine
              key={`${alert.level}-${alert.formattedDate}`}
              x={alert.formattedDate}
              yAxisId="left"
              stroke={alertColors[alert.level]}
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          ))}

          {/* Threshold line */}
          {thresholdValue !== undefined && (
            <ReferenceLine
              y={thresholdValue}
              yAxisId="left"
              stroke="#ef4444"
              strokeDasharray="8 4"
              label={{
                value: `Threshold: ${thresholdValue}`,
                position: 'right',
                fontSize: 10,
                fill: '#ef4444',
              }}
            />
          )}

          {/* New cases area */}
          <defs>
            <linearGradient id="newCasesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="newCases"
            fill="url(#newCasesGradient)"
            stroke="#f97316"
            strokeWidth={1.5}
            name="New Cases"
            dot={false}
          />

          {/* 7-day moving average line */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="movingAverage7d"
            stroke="#ef4444"
            strokeWidth={2.5}
            dot={false}
            name="7-Day Avg"
          />

          {/* Cumulative cases */}
          {showCumulative && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumulativeCases"
              stroke="#6366f1"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              name="Cumulative"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
