import { useState } from 'react';
import { AlertTriangle, Activity, MapPin, Clock, ChevronDown, ChevronUp, Bell, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

interface Outbreak {
  id: string;
  disease: string;
  severity: 'low' | 'moderate' | 'high' | 'critical' | 'emergency';
  status: 'active' | 'monitoring' | 'contained' | 'resolved';
  totalCases: number;
  newCases24h: number;
  deaths: number;
  affectedRegions: string[];
  startDate: string;
  lastUpdated: string;
  responseActions: string[];
  timeline: { date: string; event: string }[];
}

const mockOutbreaks: Outbreak[] = [
  {
    id: '1',
    disease: 'Cholera',
    severity: 'emergency',
    status: 'active',
    totalCases: 342,
    newCases24h: 28,
    deaths: 12,
    affectedRegions: ['Fergana', 'Andijan', 'Namangan'],
    startDate: '2026-04-20',
    lastUpdated: '2026-05-14T08:30:00Z',
    responseActions: [
      'Emergency water purification units deployed',
      'ORS distribution centers established',
      'Contact tracing active in 3 regions',
      'Vaccination campaign initiated',
    ],
    timeline: [
      { date: '2026-04-20', event: 'First cases reported in Fergana' },
      { date: '2026-04-25', event: 'Spread to Andijan region confirmed' },
      { date: '2026-05-01', event: 'Emergency response activated' },
      { date: '2026-05-08', event: 'Namangan cases detected' },
      { date: '2026-05-12', event: 'Vaccination campaign launched' },
    ],
  },
  {
    id: '2',
    disease: 'Tuberculosis (MDR)',
    severity: 'high',
    status: 'active',
    totalCases: 167,
    newCases24h: 5,
    deaths: 8,
    affectedRegions: ['Samarkand', 'Bukhara'],
    startDate: '2026-02-10',
    lastUpdated: '2026-05-14T06:00:00Z',
    responseActions: [
      'DOT (Directly Observed Therapy) expanded',
      'Contact tracing in progress',
      'Drug resistance testing accelerated',
    ],
    timeline: [
      { date: '2026-02-10', event: 'MDR-TB cluster identified' },
      { date: '2026-03-01', event: 'Enhanced surveillance initiated' },
      { date: '2026-04-15', event: 'Second-line drug supply secured' },
    ],
  },
  {
    id: '3',
    disease: 'Measles',
    severity: 'moderate',
    status: 'monitoring',
    totalCases: 85,
    newCases24h: 2,
    deaths: 0,
    affectedRegions: ['Karakalpakstan'],
    startDate: '2026-03-15',
    lastUpdated: '2026-05-13T14:00:00Z',
    responseActions: [
      'MMR vaccination catch-up campaign',
      'School-based screening program',
    ],
    timeline: [
      { date: '2026-03-15', event: 'Outbreak declared in Nukus' },
      { date: '2026-04-01', event: 'Vaccination campaign started' },
      { date: '2026-05-01', event: 'Case rate declining' },
    ],
  },
  {
    id: '4',
    disease: 'COVID-19 (Variant XBB.4)',
    severity: 'moderate',
    status: 'contained',
    totalCases: 520,
    newCases24h: 0,
    deaths: 3,
    affectedRegions: ['Tashkent'],
    startDate: '2026-01-05',
    lastUpdated: '2026-05-10T10:00:00Z',
    responseActions: [
      'Updated booster vaccines distributed',
      'Hospital surge capacity maintained',
    ],
    timeline: [
      { date: '2026-01-05', event: 'New variant detected' },
      { date: '2026-02-15', event: 'Peak transmission reached' },
      { date: '2026-04-20', event: 'Outbreak contained' },
    ],
  },
];

const alertHistory = [
  { id: '1', message: 'Cholera: 28 new cases in Fergana Valley', time: '2 hours ago', severity: 'emergency' as const },
  { id: '2', message: 'MDR-TB: Drug resistance pattern change detected in Samarkand', time: '6 hours ago', severity: 'high' as const },
  { id: '3', message: 'Measles: Vaccination coverage reached 85% in Karakalpakstan', time: '1 day ago', severity: 'low' as const },
  { id: '4', message: 'Cholera: Water contamination source identified in Andijan', time: '1 day ago', severity: 'critical' as const },
  { id: '5', message: 'COVID-19 XBB.4: Zero new cases for 5 consecutive days', time: '3 days ago', severity: 'low' as const },
];

// ---------------------------------------------------------------------------
// Outbreak Card
// ---------------------------------------------------------------------------

function OutbreakCard({ outbreak }: { outbreak: Outbreak }) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig: Record<Outbreak['status'], { variant: 'error' | 'warning' | 'success' | 'info'; label: string }> = {
    active: { variant: 'error', label: 'Active' },
    monitoring: { variant: 'warning', label: 'Monitoring' },
    contained: { variant: 'info', label: 'Contained' },
    resolved: { variant: 'success', label: 'Resolved' },
  };
  const status = statusConfig[outbreak.status];

  return (
    <Card className={cn(
      outbreak.severity === 'emergency' && 'border-red-200 dark:border-red-900',
      outbreak.severity === 'critical' && 'border-orange-200 dark:border-orange-900',
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {outbreak.disease}
              </h3>
              <Badge variant={status.variant} dot>{status.label}</Badge>
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {outbreak.affectedRegions.join(', ')}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Since {new Date(outbreak.startDate).toLocaleDateString()}
              </span>
            </div>
          </div>
          <Badge
            variant={
              outbreak.severity === 'emergency' ? 'emergency' :
              outbreak.severity === 'critical' ? 'critical' :
              outbreak.severity === 'high' ? 'high' :
              outbreak.severity === 'moderate' ? 'moderate' : 'low'
            }
            size="lg"
          >
            {outbreak.severity}
          </Badge>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-4 gap-3">
          <div className="rounded-lg bg-slate-50 p-3 text-center dark:bg-slate-800/50">
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{outbreak.totalCases.toLocaleString()}</p>
            <p className="text-xs text-slate-500">Total Cases</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3 text-center dark:bg-amber-950/50">
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">+{outbreak.newCases24h}</p>
            <p className="text-xs text-slate-500">New (24h)</p>
          </div>
          <div className="rounded-lg bg-red-50 p-3 text-center dark:bg-red-950/50">
            <p className="text-lg font-bold text-red-700 dark:text-red-300">{outbreak.deaths}</p>
            <p className="text-xs text-slate-500">Deaths</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-950/50">
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{outbreak.affectedRegions.length}</p>
            <p className="text-xs text-slate-500">Regions</p>
          </div>
        </div>

        {/* Expand/Collapse */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-md py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950"
        >
          {expanded ? 'Show Less' : 'Show Details'}
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {expanded && (
          <div className="mt-3 space-y-4 border-t border-slate-100 pt-4 dark:border-slate-700">
            {/* Response Actions */}
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Response Actions</p>
              <ul className="space-y-1.5">
                {outbreak.responseActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-500" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>

            {/* Timeline */}
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Timeline</p>
              <div className="space-y-2">
                {outbreak.timeline.map((event, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className="flex-shrink-0 text-xs font-medium text-slate-400">
                      {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">{event.event}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function OutbreaksPage() {
  const [isLoading] = useState(false);

  const activeOutbreaks = mockOutbreaks.filter((o) => o.status === 'active' || o.status === 'monitoring');

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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Outbreak Management
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Monitor active outbreaks, response actions, and alert history
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card accentColor="danger">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{activeOutbreaks.length}</p>
              <p className="text-xs text-slate-500">Active Outbreaks</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <TrendingUp className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {mockOutbreaks.reduce((s, o) => s + o.newCases24h, 0)}
              </p>
              <p className="text-xs text-slate-500">New Cases (24h)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <MapPin className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {new Set(mockOutbreaks.flatMap((o) => o.affectedRegions)).size}
              </p>
              <p className="text-xs text-slate-500">Affected Regions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Activity className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {mockOutbreaks.filter((o) => o.status === 'contained' || o.status === 'resolved').length}
              </p>
              <p className="text-xs text-slate-500">Contained</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Outbreak List */}
        <div className="space-y-4">
          {mockOutbreaks.map((outbreak) => (
            <OutbreakCard key={outbreak.id} outbreak={outbreak} />
          ))}
        </div>

        {/* Alert History Sidebar */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4 text-amber-500" />
              Alert History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alertHistory.map((alert) => (
                <div key={alert.id} className="border-b border-slate-50 pb-3 last:border-0 dark:border-slate-700/50">
                  <div className="flex items-start gap-2">
                    <span className={cn(
                      'mt-1 h-2 w-2 flex-shrink-0 rounded-full',
                      alert.severity === 'emergency' ? 'bg-purple-500' :
                      alert.severity === 'critical' ? 'bg-red-500' :
                      alert.severity === 'high' ? 'bg-orange-500' : 'bg-green-500',
                    )} />
                    <div>
                      <p className="text-xs text-slate-700 dark:text-slate-300">{alert.message}</p>
                      <p className="mt-0.5 text-2xs text-slate-400">{alert.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
