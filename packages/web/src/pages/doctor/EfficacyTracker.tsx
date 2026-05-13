import { useState } from 'react';
import {
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { EfficacyChart, type EfficacyDataPoint } from '@/components/charts/EfficacyChart';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockPrescriptions = [
  {
    drugName: 'Lisinopril 10mg',
    diagnosisCode: 'I10',
    diagnosisName: 'Essential Hypertension',
    cohortSize: 245,
    resolutionRate: 0.87,
    avgTimeToImprovement: 14,
    ciLower: 0.82,
    ciUpper: 0.92,
    vsFirstLine: { difference: 0.03, pValue: 0.12 },
    vsRegional: { difference: 0.05, pValue: 0.04 },
    trend: 'up' as const,
  },
  {
    drugName: 'Metformin 500mg',
    diagnosisCode: 'E11',
    diagnosisName: 'Type 2 Diabetes',
    cohortSize: 189,
    resolutionRate: 0.78,
    avgTimeToImprovement: 28,
    ciLower: 0.72,
    ciUpper: 0.84,
    vsFirstLine: { difference: -0.02, pValue: 0.34 },
    vsRegional: { difference: 0.01, pValue: 0.67 },
    trend: 'stable' as const,
  },
  {
    drugName: 'Amoxicillin 250mg',
    diagnosisCode: 'J06',
    diagnosisName: 'Acute URTI',
    cohortSize: 412,
    resolutionRate: 0.92,
    avgTimeToImprovement: 5,
    ciLower: 0.89,
    ciUpper: 0.95,
    vsFirstLine: { difference: 0.0, pValue: 0.95 },
    vsRegional: { difference: 0.08, pValue: 0.001 },
    trend: 'up' as const,
  },
  {
    drugName: 'Omeprazole 20mg',
    diagnosisCode: 'K21',
    diagnosisName: 'GERD',
    cohortSize: 156,
    resolutionRate: 0.71,
    avgTimeToImprovement: 21,
    ciLower: 0.63,
    ciUpper: 0.79,
    vsFirstLine: { difference: -0.05, pValue: 0.08 },
    vsRegional: { difference: -0.03, pValue: 0.22 },
    trend: 'down' as const,
  },
];

const mockChartData: EfficacyDataPoint[] = [
  { period: 'Jan', resolutionRate: 0.82, confidenceLower: 0.76, confidenceUpper: 0.88, cohortSize: 38, comparisonRate: 0.8 },
  { period: 'Feb', resolutionRate: 0.84, confidenceLower: 0.78, confidenceUpper: 0.9, cohortSize: 42, comparisonRate: 0.81 },
  { period: 'Mar', resolutionRate: 0.81, confidenceLower: 0.74, confidenceUpper: 0.88, cohortSize: 35, comparisonRate: 0.8 },
  { period: 'Apr', resolutionRate: 0.86, confidenceLower: 0.8, confidenceUpper: 0.92, cohortSize: 45, comparisonRate: 0.82 },
  { period: 'May', resolutionRate: 0.88, confidenceLower: 0.82, confidenceUpper: 0.94, cohortSize: 48, comparisonRate: 0.82 },
  { period: 'Jun', resolutionRate: 0.87, confidenceLower: 0.81, confidenceUpper: 0.93, cohortSize: 41, comparisonRate: 0.83 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EfficacyTracker() {
  const [selectedDrug, setSelectedDrug] = useState(mockPrescriptions[0].drugName);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPrescriptions = mockPrescriptions.filter(
    (p) =>
      p.drugName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.diagnosisName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const currentDrug = mockPrescriptions.find((p) => p.drugName === selectedDrug);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Prescription Efficacy Tracker
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track and compare treatment outcomes across your prescriptions
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <Input
          label="Search"
          placeholder="Drug name or diagnosis..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          fullWidth={false}
          className="w-64"
          startIcon={<Filter className="h-4 w-4" />}
        />
        <Select
          label="Drug"
          options={mockPrescriptions.map((p) => ({ value: p.drugName, label: p.drugName }))}
          value={selectedDrug}
          onChange={(e) => setSelectedDrug(e.target.value)}
          fullWidth={false}
        />
        <Select
          label="Time Period"
          options={[
            { value: '30d', label: 'Last 30 Days' },
            { value: '90d', label: 'Last 90 Days' },
            { value: '6m', label: 'Last 6 Months' },
            { value: '1y', label: 'Last Year' },
          ]}
          fullWidth={false}
        />
      </div>

      {/* Efficacy Chart */}
      <Card>
        <CardContent className="p-6">
          <EfficacyChart
            data={mockChartData}
            drugName={selectedDrug}
            comparisonLabel="Regional Average"
            height={300}
          />
        </CardContent>
      </Card>

      {/* Comparison Summary */}
      {currentDrug && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">vs First-Line Alternative</p>
            <div className="mt-1 flex items-center gap-2">
              <span className={cn(
                'text-xl font-bold',
                currentDrug.vsFirstLine.difference > 0
                  ? 'text-green-600'
                  : currentDrug.vsFirstLine.difference < 0
                    ? 'text-red-600'
                    : 'text-slate-600',
              )}>
                {currentDrug.vsFirstLine.difference > 0 ? '+' : ''}{(currentDrug.vsFirstLine.difference * 100).toFixed(1)}%
              </span>
              <Badge
                variant={currentDrug.vsFirstLine.pValue < 0.05 ? 'success' : 'default'}
                size="sm"
              >
                p={currentDrug.vsFirstLine.pValue.toFixed(3)}
              </Badge>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">vs Regional Average</p>
            <div className="mt-1 flex items-center gap-2">
              <span className={cn(
                'text-xl font-bold',
                currentDrug.vsRegional.difference > 0
                  ? 'text-green-600'
                  : currentDrug.vsRegional.difference < 0
                    ? 'text-red-600'
                    : 'text-slate-600',
              )}>
                {currentDrug.vsRegional.difference > 0 ? '+' : ''}{(currentDrug.vsRegional.difference * 100).toFixed(1)}%
              </span>
              <Badge
                variant={currentDrug.vsRegional.pValue < 0.05 ? 'success' : 'default'}
                size="sm"
              >
                p={currentDrug.vsRegional.pValue.toFixed(3)}
              </Badge>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Bayesian 95% CI</p>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {(currentDrug.ciLower * 100).toFixed(1)}% - {(currentDrug.ciUpper * 100).toFixed(1)}%
            </p>
            <p className="text-2xs text-slate-400">
              Cohort: n={currentDrug.cohortSize}
            </p>
          </Card>
        </div>
      )}

      {/* Prescriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Prescriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['Drug', 'Diagnosis', 'Cohort', 'Resolution Rate', '95% CI', 'Avg Time to Improvement', 'Trend'].map(
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
                {filteredPrescriptions.map((rx) => (
                  <tr
                    key={rx.drugName}
                    className={cn(
                      'transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer',
                      selectedDrug === rx.drugName && 'bg-primary-50/50 dark:bg-primary-950/30',
                    )}
                    onClick={() => setSelectedDrug(rx.drugName)}
                  >
                    <td className="px-3 py-3 font-medium text-slate-900 dark:text-white">
                      {rx.drugName}
                    </td>
                    <td className="px-3 py-3">
                      <div>
                        <span className="text-slate-700 dark:text-slate-300">{rx.diagnosisName}</span>
                        <span className="ml-1 text-xs text-slate-400">({rx.diagnosisCode})</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                      n={rx.cohortSize}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              rx.resolutionRate >= 0.85
                                ? 'bg-green-500'
                                : rx.resolutionRate >= 0.7
                                  ? 'bg-amber-500'
                                  : 'bg-red-500',
                            )}
                            style={{ width: `${rx.resolutionRate * 100}%` }}
                          />
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {(rx.resolutionRate * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {(rx.ciLower * 100).toFixed(1)}% - {(rx.ciUpper * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                      {rx.avgTimeToImprovement} days
                    </td>
                    <td className="px-3 py-3">
                      {rx.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" aria-label="Trending up" />}
                      {rx.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" aria-label="Trending down" />}
                      {rx.trend === 'stable' && <Minus className="h-4 w-4 text-slate-400" aria-label="Stable" />}
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
