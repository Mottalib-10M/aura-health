import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ErrorBar,
  Area,
} from 'recharts';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EfficacyDataPoint {
  period: string;
  resolutionRate: number;
  confidenceLower: number;
  confidenceUpper: number;
  cohortSize: number;
  comparisonRate?: number;
}

export interface EfficacyChartProps {
  /** Chart data points */
  data: EfficacyDataPoint[];
  /** Drug name for the chart title */
  drugName: string;
  /** Comparison label (e.g., "Regional Average") */
  comparisonLabel?: string;
  /** Height of the chart */
  height?: number;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

interface TooltipPayload {
  payload: EfficacyDataPoint;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <p className="mb-1 text-sm font-medium text-slate-900 dark:text-slate-100">
        {data.period}
      </p>
      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary-500" />
          <span className="text-slate-500">Resolution Rate:</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {(data.resolutionRate * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          <span className="text-slate-500">95% CI:</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {(data.confidenceLower * 100).toFixed(1)}% - {(data.confidenceUpper * 100).toFixed(1)}%
          </span>
        </div>
        {data.comparisonRate !== undefined && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-slate-500">Comparison:</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {(data.comparisonRate * 100).toFixed(1)}%
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
          <span className="text-slate-500">Cohort Size:</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            n={data.cohortSize}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EfficacyChart({
  data,
  drugName,
  comparisonLabel = 'Regional Average',
  height = 320,
  className,
}: EfficacyChartProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        resolutionRatePercent: d.resolutionRate * 100,
        comparisonPercent: d.comparisonRate ? d.comparisonRate * 100 : undefined,
        ciLower: (d.resolutionRate - d.confidenceLower) * 100,
        ciUpper: (d.confidenceUpper - d.resolutionRate) * 100,
        ciRange: [d.confidenceLower * 100, d.confidenceUpper * 100],
      })),
    [data],
  );

  return (
    <div className={cn('w-full', className)}>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {drugName} - Prescription Efficacy
        </h4>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-700" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11 }}
            className="text-slate-500"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `${v}%`}
            className="text-slate-500"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
          />

          {/* Confidence interval band */}
          <Area
            type="monotone"
            dataKey="ciRange"
            fill="#25adb5"
            fillOpacity={0.1}
            stroke="none"
            name="95% CI"
          />

          {/* Resolution rate bars */}
          <Bar
            dataKey="resolutionRatePercent"
            fill="#25adb5"
            fillOpacity={0.8}
            radius={[4, 4, 0, 0]}
            name={drugName}
            barSize={32}
          >
            <ErrorBar
              dataKey="ciUpper"
              direction="y"
              width={8}
              strokeWidth={1.5}
              stroke="#1a8a91"
            />
          </Bar>

          {/* Comparison line */}
          {data.some((d) => d.comparisonRate !== undefined) && (
            <Line
              type="monotone"
              dataKey="comparisonPercent"
              stroke="#f99d07"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: '#f99d07' }}
              name={comparisonLabel}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
