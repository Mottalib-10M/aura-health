import { Link } from 'react-router-dom';
import {
  CalendarDays,
  FileText,
  Watch,
  Stethoscope,
  AlertTriangle,
  ArrowRight,
  Heart,
  Activity,
  Zap,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, UrgencyBadge } from '@/components/ui/Badge';
import { VitalSparkline } from '@/components/charts/VitalSparkline';
import { Spinner } from '@/components/ui/Spinner';
import { useTelemetry } from '@/hooks/useTelemetry';
import { useAuthStore } from '@/stores/authStore';
import { formatDateTime, formatRelativeTime } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import type { TimeSeriesDataPoint } from '@aura/shared/types/telemetry';

// ---------------------------------------------------------------------------
// Mock data (would come from API in production)
// ---------------------------------------------------------------------------

const mockAnomalies = [
  {
    id: '1',
    metricName: 'Heart Rate',
    severity: 'warning' as const,
    message: 'Heart rate elevated above normal range during rest periods. Average resting HR 95bpm (normal: 60-85bpm).',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
];

const mockAppointments = [
  {
    id: '1',
    doctorName: 'Dr. Alisher Karimov',
    specialty: 'Cardiology',
    scheduledStart: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
    appointmentType: 'telemedicine' as const,
    status: 'confirmed',
  },
  {
    id: '2',
    doctorName: 'Dr. Nigora Usmanova',
    specialty: 'General Practice',
    scheduledStart: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    appointmentType: 'in_person' as const,
    status: 'scheduled',
  },
];

const mockTriageHistory = [
  {
    id: '1',
    urgencyLevel: 'moderate' as const,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    specialties: ['Cardiology'],
  },
];

function generateMockVitals(count: number, base: number, variance: number): TimeSeriesDataPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(Date.now() - (count - i) * 1000 * 60 * 30).toISOString(),
    value: base + (Math.random() - 0.5) * variance * 2,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PatientDashboard() {
  const user = useAuthStore((s) => s.user);
  const { vitals, isLoading, getTrend } = useTelemetry({
    patientId: user?.id ?? '',
    enabled: !!user?.id,
  });

  // Use mock data if API data is not available yet
  const heartRateData = vitals?.heartRate ?? generateMockVitals(24, 75, 10);
  const spO2Data = vitals?.spO2 ?? generateMockVitals(24, 97, 1.5);
  const hrvData = vitals?.hrvMs ?? generateMockVitals(24, 45, 10);

  const latestHR = heartRateData[heartRateData.length - 1]?.value ?? 0;
  const latestSpO2 = spO2Data[spO2Data.length - 1]?.value ?? 0;
  const latestHRV = hrvData[hrvData.length - 1]?.value ?? 0;

  const hrTrend = vitals ? getTrend('heartRate') : { direction: 'up' as const, change: 3.2 };
  const spO2Trend = vitals ? getTrend('spO2') : { direction: 'stable' as const, change: 0.1 };
  const hrvTrend = vitals ? getTrend('hrvMs') : { direction: 'down' as const, change: -5.1 };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" label="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Good {getGreeting()}, {user?.firstName ?? 'Patient'}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Here is your health overview
        </p>
      </div>

      {/* AI Alert Banner */}
      {mockAnomalies.length > 0 && (
        <div
          className={cn(
            'flex items-start gap-3 rounded-xl border p-4',
            mockAnomalies[0].severity === 'critical'
              ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
              : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950',
          )}
          role="alert"
        >
          <AlertTriangle
            className={cn(
              'mt-0.5 h-5 w-5 flex-shrink-0',
              mockAnomalies[0].severity === 'critical'
                ? 'text-red-600 dark:text-red-400'
                : 'text-amber-600 dark:text-amber-400',
            )}
          />
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              AI Health Alert
            </p>
            <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
              {mockAnomalies[0].message}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Detected {formatRelativeTime(mockAnomalies[0].timestamp)}
            </p>
          </div>
          <Button variant="outline" size="sm">
            View Details
          </Button>
        </div>
      )}

      {/* Vital Signs Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Heart className="h-4 w-4 text-red-500" aria-hidden="true" />
            <span className="text-xs font-medium text-slate-500">Heart Rate</span>
          </div>
          <VitalSparkline
            data={heartRateData}
            label=""
            currentValue={latestHR}
            unit="bpm"
            normalRange={{ min: 60, max: 100 }}
            color="#ef4444"
            trend={hrTrend}
          />
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <span className="text-xs font-medium text-slate-500">SpO2</span>
          </div>
          <VitalSparkline
            data={spO2Data}
            label=""
            currentValue={latestSpO2}
            unit="%"
            normalRange={{ min: 95, max: 100 }}
            color="#3b82f6"
            trend={spO2Trend}
          />
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Zap className="h-4 w-4 text-purple-500" aria-hidden="true" />
            <span className="text-xs font-medium text-slate-500">HRV</span>
          </div>
          <VitalSparkline
            data={hrvData}
            label=""
            currentValue={latestHRV}
            unit="ms"
            normalRange={{ min: 20, max: 70 }}
            color="#8b5cf6"
            trend={hrvTrend}
          />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Symptom Triage CTA */}
        <Card hoverable className="lg:col-span-1">
          <CardContent className="flex flex-col items-center p-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary-900">
              <Stethoscope className="h-7 w-7 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              AI Symptom Triage
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Describe your symptoms and get AI-powered recommendations for the right specialist
            </p>
            <Link to="/patient/triage" className="mt-4 w-full">
              <Button size="lg" className="w-full">
                Check Symptoms
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Upcoming Appointments</CardTitle>
              <Link to="/patient/appointments">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {mockAppointments.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                No upcoming appointments
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700" role="list">
                {mockAppointments.map((apt) => (
                  <li
                    key={apt.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg',
                          apt.appointmentType === 'telemedicine'
                            ? 'bg-blue-100 dark:bg-blue-900'
                            : 'bg-green-100 dark:bg-green-900',
                        )}
                      >
                        <CalendarDays
                          className={cn(
                            'h-5 w-5',
                            apt.appointmentType === 'telemedicine'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-green-600 dark:text-green-400',
                          )}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {apt.doctorName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {apt.specialty} &middot; {apt.appointmentType === 'telemedicine' ? 'Video Call' : 'In Person'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {formatDateTime(apt.scheduledStart)}
                      </p>
                      <Badge variant={apt.status === 'confirmed' ? 'success' : 'default'} size="sm">
                        {apt.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Treatment Timeline + Recent Triage */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Triage History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Triage Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {mockTriageHistory.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">
                No triage sessions yet
              </p>
            ) : (
              <ul className="space-y-3" role="list">
                {mockTriageHistory.map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-700"
                  >
                    <div>
                      <UrgencyBadge level={session.urgencyLevel} />
                      <p className="mt-1 text-xs text-slate-500">
                        {formatRelativeTime(session.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        {session.specialties.join(', ')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link to="/patient/appointments">
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left transition-colors',
                    'hover:border-primary-300 hover:bg-primary-50',
                    'dark:border-slate-700 dark:hover:border-primary-700 dark:hover:bg-primary-950',
                  )}
                >
                  <CalendarDays className="h-5 w-5 text-primary-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Book Appointment
                    </p>
                    <p className="text-2xs text-slate-500">Schedule a visit</p>
                  </div>
                </button>
              </Link>

              <Link to="/patient/records">
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left transition-colors',
                    'hover:border-secondary-300 hover:bg-secondary-50',
                    'dark:border-slate-700 dark:hover:border-secondary-700 dark:hover:bg-secondary-950',
                  )}
                >
                  <FileText className="h-5 w-5 text-secondary-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      View Records
                    </p>
                    <p className="text-2xs text-slate-500">Medical history</p>
                  </div>
                </button>
              </Link>

              <Link to="/patient/devices">
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left transition-colors',
                    'hover:border-green-300 hover:bg-green-50',
                    'dark:border-slate-700 dark:hover:border-green-700 dark:hover:bg-green-950',
                  )}
                >
                  <Watch className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Connect Wearable
                    </p>
                    <p className="text-2xs text-slate-500">Sync health data</p>
                  </div>
                </button>
              </Link>

              <Link to="/patient/triage">
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left transition-colors',
                    'hover:border-amber-300 hover:bg-amber-50',
                    'dark:border-slate-700 dark:hover:border-amber-700 dark:hover:bg-amber-950',
                  )}
                >
                  <Stethoscope className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Check Symptoms
                    </p>
                    <p className="text-2xs text-slate-500">AI triage</p>
                  </div>
                </button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
