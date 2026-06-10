import { useState, useMemo } from 'react';
import {
  Filter,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { useEfficacy, type EfficacyMetricRow } from '@/hooks/useEfficacy';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EfficacyTracker() {
  const { metrics, isLoading } = useEfficacy();
  const [selectedDrug, setSelectedDrug] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-select first drug
  const activeDrug = selectedDrug || (metrics.length > 0 ? metrics[0].drugName : '');

  const filteredMetrics = useMemo(() => {
    if (!searchQuery) return metrics;
    const q = searchQuery.toLowerCase();
    return metrics.filter(
      (m) =>
        m.drugName.toLowerCase().includes(q) ||
        m.diagnosisCode.toLowerCase().includes(q),
    );
  }, [metrics, searchQuery]);

  const currentMetric = metrics.find((m) => m.drugName === activeDrug);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Prescription Efficacy Tracker
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Track and compare treatment outcomes across prescriptions
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <Input
          label="Search"
          placeholder="Drug name or diagnosis code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          fullWidth={false}
          className="w-64"
          startIcon={<Filter className="h-4 w-4" />}
        />
        {metrics.length > 0 && (
          <Select
            label="Drug"
            options={metrics.map((m) => ({ value: m.drugName, label: `${m.drugName} ${m.dosage}` }))}
            value={activeDrug}
            onChange={(e) => setSelectedDrug(e.target.value)}
            fullWidth={false}
          />
        )}
      </div>

      {/* Comparison Summary */}
      {currentMetric && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Remission Rate</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {(currentMetric.outcomeMetrics.remissionRate * 100).toFixed(1)}%
              </span>
              <Badge
                variant={currentMetric.outcomeMetrics.remissionRate >= 0.8 ? 'success' : currentMetric.outcomeMetrics.remissionRate >= 0.6 ? 'warning' : 'error'}
                size="sm"
              >
                n={currentMetric.cohortSize}
              </Badge>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Avg Days to Improvement</p>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {currentMetric.outcomeMetrics.averageDaysToImprovement.toFixed(0)} days
            </p>
            <p className="text-2xs text-slate-400">
              Side effect rate: {(currentMetric.outcomeMetrics.sideEffectRate * 100).toFixed(1)}%
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Comparative Effectiveness</p>
            <div className="mt-1 flex items-center gap-2">
              <span className={cn(
                'text-xl font-bold',
                (currentMetric.comparativeEffectiveness ?? 0) >= 0.8 ? 'text-green-600' : 'text-amber-600',
              )}>
                {currentMetric.comparativeEffectiveness
                  ? (currentMetric.comparativeEffectiveness * 100).toFixed(1) + '%'
                  : 'N/A'}
              </span>
              <span className="text-2xs text-slate-400">
                {currentMetric.region ?? 'All regions'} | {currentMetric.timeframeMonths}mo window
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Prescriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Efficacy Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredMetrics.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No efficacy data available. Data will appear as prescriptions are tracked.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    {['Drug', 'Diagnosis', 'Cohort', 'Remission Rate', 'Side Effects', 'Avg Improvement', 'Effectiveness'].map(
                      (header) => (
                        <th
                          key={header}
                          className="px-3 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400"
                          scope="col"
                        >
                          {header}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredMetrics.map((metric) => (
                    <tr
                      key={metric.id}
                      className={cn(
                        'transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer',
                        activeDrug === metric.drugName && 'bg-primary-50/50 dark:bg-primary-950/30',
                      )}
                      onClick={() => setSelectedDrug(metric.drugName)}
                    >
                      <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">
                        {metric.drugName} {metric.dosage}
                      </td>
                      <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                        {metric.diagnosisCode}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                        n={metric.cohortSize}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                metric.outcomeMetrics.remissionRate >= 0.85
                                  ? 'bg-green-500'
                                  : metric.outcomeMetrics.remissionRate >= 0.7
                                    ? 'bg-amber-500'
                                    : 'bg-red-500',
                              )}
                              style={{ width: `${metric.outcomeMetrics.remissionRate * 100}%` }}
                            />
                          </div>
                          <span className="font-medium text-slate-900 dark:text-white">
                            {(metric.outcomeMetrics.remissionRate * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        {(metric.outcomeMetrics.sideEffectRate * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                        {metric.outcomeMetrics.averageDaysToImprovement.toFixed(0)} days
                      </td>
                      <td className="px-3 py-3">
                        {(metric.comparativeEffectiveness ?? 0) >= 0.8 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" aria-label="High effectiveness" />
                        ) : (metric.comparativeEffectiveness ?? 0) >= 0.6 ? (
                          <Minus className="h-4 w-4 text-slate-400" aria-label="Moderate effectiveness" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" aria-label="Low effectiveness" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
