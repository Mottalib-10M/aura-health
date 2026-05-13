import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { TimeSeriesDataPoint } from '@aura/shared/types/telemetry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VitalSparklineProps {
  /** Time-series data points */
  data: TimeSeriesDataPoint[];
  /** Label for the vital sign */
  label: string;
  /** Current / latest value */
  currentValue: number;
  /** Unit of measurement */
  unit: string;
  /** Normal range for visual reference */
  normalRange?: { min: number; max: number };
  /** Line color */
  color?: string;
  /** Trend direction */
  trend?: { direction: 'up' | 'down' | 'stable'; change: number };
  /** Height of the sparkline in pixels */
  height?: number;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VitalSparkline({
  data,
  label,
  currentValue,
  unit,
  normalRange,
  color = '#25adb5',
  trend,
  height = 48,
  className,
}: VitalSparklineProps) {
  const chartData = useMemo(
    () => data.map((d) => ({ value: d.value })),
    [data],
  );

  const isOutOfRange = useMemo(() => {
    if (!normalRange) return false;
    return currentValue < normalRange.min || currentValue > normalRange.max;
  }, [currentValue, normalRange]);

  const trendIcon = useMemo(() => {
    if (!trend) return null;
    const iconClass = 'h-3.5 w-3.5';
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className={iconClass} />;
      case 'down':
        return <TrendingDown className={iconClass} />;
      default:
        return <Minus className={iconClass} />;
    }
  }, [trend]);

  const trendColor = useMemo(() => {
    if (!trend) return 'text-slate-400';
    // For some vitals, "up" can be bad (e.g., heart rate too high)
    // We use neutral coloring and let the out-of-range indicator handle warnings
    switch (trend.direction) {
      case 'up':
        return 'text-blue-500';
      case 'down':
        return 'text-amber-500';
      default:
        return 'text-slate-400';
    }
  }, [trend]);

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Value + Label */}
      <div className="flex flex-col items-start min-w-[4.5rem]">
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              'text-xl font-bold tabular-nums',
              isOutOfRange
                ? 'text-red-600 dark:text-red-400'
                : 'text-slate-900 dark:text-slate-100',
            )}
          >
            {Math.round(currentValue)}
          </span>
          <span className="text-xs text-slate-400">{unit}</span>
        </div>
        {trend && (
          <div className={cn('flex items-center gap-0.5 text-xs', trendColor)}>
            {trendIcon}
            <span>{Math.abs(trend.change)}%</span>
          </div>
        )}
      </div>

      {/* Sparkline */}
      <div className="flex-1 min-w-[80px]">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData}>
            <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
            {normalRange && (
              <>
                <ReferenceLine
                  y={normalRange.max}
                  stroke="#ef444444"
                  strokeDasharray="3 3"
                />
                <ReferenceLine
                  y={normalRange.min}
                  stroke="#ef444444"
                  strokeDasharray="3 3"
                />
              </>
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={isOutOfRange ? '#ef4444' : color}
              strokeWidth={2}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
