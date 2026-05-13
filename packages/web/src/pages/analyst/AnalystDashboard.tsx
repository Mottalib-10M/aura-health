import { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Activity,
  Globe,
  Clock,
  TrendingUp,
  Eye,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SurveillanceMap, type MapFeature } from '@/components/maps/SurveillanceMap';
import { OutbreakTrendChart, type OutbreakTrendDataPoint } from '@/components/charts/OutbreakTrendChart';
import { cn } from '@/utils/cn';
import { formatRelativeTime, formatCompactNumber } from '@/utils/formatters';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const alertCounts = {
  watch: 12,
  warning: 5,
  alert: 3,
  emergency: 1,
};

const alertColors: Record<string, { bg: string; text: string; border: string }> = {
  watch: { bg: 'bg-green-50 dark:bg-green-950', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800' },
  warning: { bg: 'bg-yellow-50 dark:bg-yellow-950', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-200 dark:border-yellow-800' },
  alert: { bg: 'bg-orange-50 dark:bg-orange-950', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
  emergency: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
};

const mapFeatures: MapFeature[] = [
  { coordinates: { latitude: 41.2995, longitude: 69.2401 }, caseCount: 245, diseaseName: 'ILI', alertLevel: 'alert', region: 'Tashkent', city: 'Tashkent' },
  { coordinates: { latitude: 39.6542, longitude: 66.9597 }, caseCount: 89, diseaseName: 'TB', alertLevel: 'warning', region: 'Samarkand', city: 'Samarkand' },
  { coordinates: { latitude: 40.7821, longitude: 72.3442 }, caseCount: 342, diseaseName: 'Brucellosis', alertLevel: 'emergency', region: 'Fergana', city: 'Andijan' },
  { coordinates: { latitude: 41.5400, longitude: 60.6318 }, caseCount: 56, diseaseName: 'ILI', alertLevel: 'watch', region: 'Karakalpakstan', city: 'Nukus' },
  { coordinates: { latitude: 38.8600, longitude: 65.8000 }, caseCount: 124, diseaseName: 'COVID', alertLevel: 'warning', region: 'Kashkadarya', city: 'Karshi' },
  { coordinates: { latitude: 42.8746, longitude: 74.5698 }, caseCount: 78, diseaseName: 'ILI', alertLevel: 'watch', region: 'Bishkek', city: 'Bishkek' },
  { coordinates: { latitude: 38.5600, longitude: 68.7700 }, caseCount: 167, diseaseName: 'TB', alertLevel: 'alert', region: 'Dushanbe', city: 'Dushanbe' },
];

const outbreakAlerts = [
  { id: '1', disease: 'Brucellosis', region: 'Fergana Valley', level: 'emergency' as const, cases: 342, updated: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
  { id: '2', disease: 'Influenza-like Illness', region: 'Tashkent', level: 'alert' as const, cases: 245, updated: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
  { id: '3', disease: 'TB', region: 'Dushanbe', level: 'alert' as const, cases: 167, updated: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
  { id: '4', disease: 'COVID-19', region: 'Kashkadarya', level: 'warning' as const, cases: 124, updated: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() },
];

const populationKPIs = [
  { label: 'Incidence Rate', value: '48.2', unit: 'per 100k', trend: 'up' },
  { label: 'Mortality Rate', value: '2.1', unit: 'per 100k', trend: 'stable' },
  { label: 'Vaccination Coverage', value: '82%', unit: '', trend: 'up' },
  { label: 'Reporting Completeness', value: '94%', unit: '', trend: 'up' },
];

const trendData: OutbreakTrendDataPoint[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const base = 15 + Math.sin(i / 5) * 8;
  const newCases = Math.max(0, Math.round(base + (Math.random() - 0.3) * 10));
  return {
    date,
    newCases,
    cumulativeCases: 200 + i * 8 + newCases,
    movingAverage7d: base + 2,
    threshold: 25,
  };
});

type PathogenTab = 'ILI' | 'TB' | 'Brucellosis' | 'COVID' | 'Emerging';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnalystDashboard() {
  const [activeTab, setActiveTab] = useState<PathogenTab>('ILI');
  const [temporalView, setTemporalView] = useState('7d');

  const tabs: PathogenTab[] = ['ILI', 'TB', 'Brucellosis', 'COVID', 'Emerging'];
  const temporalOptions = [
    { value: 'realtime', label: 'Real-time' },
    { value: '7d', label: '7-Day' },
    { value: '30d', label: '30-Day' },
    { value: 'seasonal', label: 'Seasonal' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Disease Surveillance
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Regional epidemiological monitoring - Central Asia
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info" dot>
            <Clock className="mr-1 h-3 w-3" />
            Live
          </Badge>
          <Button variant="outline" size="sm">
            Export Data
          </Button>
        </div>
      </div>

      {/* Alert Level Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(alertCounts).map(([level, count]) => {
          const colors = alertColors[level];
          return (
            <Card
              key={level}
              className={cn('border', colors.border, colors.bg, 'p-4')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn('text-xs font-semibold uppercase', colors.text)}>
                    {level}
                  </p>
                  <p className={cn('mt-1 text-3xl font-bold', colors.text)}>
                    {count}
                  </p>
                </div>
                <ShieldCheck className={cn('h-8 w-8 opacity-40', colors.text)} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Pathogen Tabs + Temporal View */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'rounded-md px-4 py-2 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700',
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex gap-1 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
          {temporalOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTemporalView(opt.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                temporalView === opt.value
                  ? 'bg-secondary-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Surveillance Map */}
      <SurveillanceMap
        features={mapFeatures.filter(
          (f) => activeTab === 'Emerging' || f.diseaseName === activeTab || f.diseaseName === activeTab.replace('-', ''),
        )}
        height="420px"
        dateRange={{
          min: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          max: new Date().toISOString().split('T')[0],
        }}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Outbreak Trend Chart */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <OutbreakTrendChart
              data={trendData}
              diseaseName={activeTab}
              height={300}
              showCumulative
            />
          </CardContent>
        </Card>

        {/* Outbreak Alerts Timeline */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <CardTitle>Active Alerts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {outbreakAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    'rounded-lg border p-3',
                    alertColors[alert.level]?.border,
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {alert.disease}
                    </p>
                    <Badge
                      variant={
                        alert.level === 'emergency'
                          ? 'critical'
                          : alert.level === 'alert'
                            ? 'high'
                            : 'warning'
                      }
                      size="sm"
                      dot
                    >
                      {alert.level}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {alert.region} &middot; {formatCompactNumber(alert.cases)} cases
                  </p>
                  <p className="mt-1 text-2xs text-slate-400">
                    Updated {formatRelativeTime(alert.updated)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Population Health KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {populationKPIs.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {kpi.value}
              </span>
              {kpi.unit && (
                <span className="text-xs text-slate-400">{kpi.unit}</span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs">
              {kpi.trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
              {kpi.trend === 'stable' && <Activity className="h-3 w-3 text-slate-400" />}
              <span className={kpi.trend === 'up' ? 'text-green-600' : 'text-slate-400'}>
                {kpi.trend === 'up' ? 'Improving' : 'Stable'}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
