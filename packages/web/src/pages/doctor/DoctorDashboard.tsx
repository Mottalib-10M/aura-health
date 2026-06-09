import { useState } from 'react';
import {
  Users,
  Clock,
  Star,
  CalendarDays,
  Activity,
  Brain,
  ChevronRight,
  Stethoscope,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, UrgencyBadge } from '@/components/ui/Badge';
import { VitalSparkline } from '@/components/charts/VitalSparkline';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { formatTime } from '@/utils/formatters';
import type { TimeSeriesDataPoint } from '@uzavita/shared/types/telemetry';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

function mockVitals(base: number, variance: number): TimeSeriesDataPoint[] {
  return Array.from({ length: 20 }, (_, i) => ({
    timestamp: new Date(Date.now() - (20 - i) * 1000 * 60 * 60).toISOString(),
    value: base + (Math.random() - 0.5) * variance * 2,
  }));
}

const mockSchedule = [
  {
    id: '1',
    patientName: 'Dilshod Rakhimov',
    patientAge: 45,
    scheduledStart: new Date(new Date().setHours(9, 0, 0)).toISOString(),
    scheduledEnd: new Date(new Date().setHours(9, 30, 0)).toISOString(),
    reasonForVisit: 'Chest pain, follow-up after triage',
    priority: 'urgent' as const,
    status: 'confirmed',
    triageUrgency: 'high' as const,
    vitals: { hr: 92, spO2: 96, temp: 37.4 },
  },
  {
    id: '2',
    patientName: 'Malika Yusupova',
    patientAge: 32,
    scheduledStart: new Date(new Date().setHours(9, 30, 0)).toISOString(),
    scheduledEnd: new Date(new Date().setHours(10, 0, 0)).toISOString(),
    reasonForVisit: 'Routine checkup, medication review',
    priority: 'routine' as const,
    status: 'scheduled',
    triageUrgency: 'low' as const,
    vitals: { hr: 72, spO2: 99, temp: 36.7 },
  },
  {
    id: '3',
    patientName: 'Rustam Abdullaev',
    patientAge: 58,
    scheduledStart: new Date(new Date().setHours(10, 30, 0)).toISOString(),
    scheduledEnd: new Date(new Date().setHours(11, 0, 0)).toISOString(),
    reasonForVisit: 'Persistent cough, 2 weeks, shortness of breath',
    priority: 'urgent' as const,
    status: 'scheduled',
    triageUrgency: 'moderate' as const,
    vitals: { hr: 88, spO2: 94, temp: 37.8 },
  },
  {
    id: '4',
    patientName: 'Nilufar Khamidova',
    patientAge: 26,
    scheduledStart: new Date(new Date().setHours(11, 0, 0)).toISOString(),
    scheduledEnd: new Date(new Date().setHours(11, 30, 0)).toISOString(),
    reasonForVisit: 'Headaches, dizziness, fatigue',
    priority: 'routine' as const,
    status: 'scheduled',
    triageUrgency: 'low' as const,
    vitals: { hr: 68, spO2: 98, temp: 36.5 },
  },
];

const mockAIInsights = [
  {
    id: '1',
    type: 'differential',
    title: 'Consider Pulmonary Embolism',
    description: 'Patient Rakhimov presents with chest pain + elevated HR + borderline SpO2. Clinical scoring (Wells) recommended.',
    confidence: 0.72,
    priority: 'high' as const,
  },
  {
    id: '2',
    type: 'drug_interaction',
    title: 'Potential Drug Interaction',
    description: 'Yusupova is on metformin + new ACE inhibitor. Monitor renal function closely.',
    confidence: 0.89,
    priority: 'moderate' as const,
  },
  {
    id: '3',
    type: 'epidemiological',
    title: 'Seasonal Pattern Alert',
    description: 'Respiratory complaints up 40% this week in Tashkent region. Consider ILI screening for patients with cough.',
    confidence: 0.95,
    priority: 'low' as const,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DoctorDashboard() {
  const user = useAuthStore((s) => s.user);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(mockSchedule[0]?.id ?? null);

  const selected = mockSchedule.find((p) => p.id === selectedPatient);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Dr. {user?.lastName ?? 'Dashboard'}
          </h1>
          <p className="text-sm text-slate-500">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        <Button>
          <CalendarDays className="h-4 w-4" />
          Full Schedule
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Patients Today', value: '12', icon: Users, color: 'text-primary-600 bg-primary-100 dark:bg-primary-900' },
          { label: 'Avg Consultation', value: '22 min', icon: Clock, color: 'text-secondary-600 bg-secondary-100 dark:bg-secondary-900' },
          { label: 'Satisfaction', value: '4.8/5', icon: Star, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900' },
          { label: 'Pending Follow-ups', value: '5', icon: Activity, color: 'text-red-600 bg-red-100 dark:bg-red-900' },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', stat.color)}>
                <stat.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xs font-medium text-slate-500">{stat.label}</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's Schedule */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Today&apos;s Schedule
          </h2>
          <div className="space-y-2">
            {mockSchedule.map((apt) => (
              <Card
                key={apt.id}
                hoverable
                accentColor={apt.priority === 'urgent' ? 'warning' : undefined}
                className={cn(
                  'cursor-pointer transition-all',
                  selectedPatient === apt.id && 'ring-2 ring-primary-500',
                )}
                onClick={() => setSelectedPatient(apt.id)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {formatTime(apt.scheduledStart)}
                      </p>
                      <p className="text-2xs text-slate-400">
                        {formatTime(apt.scheduledEnd)}
                      </p>
                    </div>
                    <div className="h-10 w-px bg-slate-200 dark:bg-slate-700" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {apt.patientName}
                        </p>
                        <span className="text-xs text-slate-400">
                          {apt.patientAge}y
                        </span>
                        <UrgencyBadge level={apt.triageUrgency} size="sm" />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{apt.reasonForVisit}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden text-right text-xs text-slate-500 sm:block">
                      <p>HR: {apt.vitals.hr}</p>
                      <p>SpO2: {apt.vitals.spO2}%</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 30-Day Telemetry for Selected Patient */}
          {selected && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {selected.patientName} - 30-Day Telemetry
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <VitalSparkline
                    data={mockVitals(selected.vitals.hr, 12)}
                    label="Heart Rate"
                    currentValue={selected.vitals.hr}
                    unit="bpm"
                    normalRange={{ min: 60, max: 100 }}
                    color="#ef4444"
                    trend={{ direction: 'up', change: 4.2 }}
                  />
                  <VitalSparkline
                    data={mockVitals(selected.vitals.spO2, 2)}
                    label="SpO2"
                    currentValue={selected.vitals.spO2}
                    unit="%"
                    normalRange={{ min: 95, max: 100 }}
                    color="#3b82f6"
                    trend={{ direction: 'stable', change: 0.3 }}
                  />
                  <VitalSparkline
                    data={mockVitals(42, 10)}
                    label="HRV"
                    currentValue={42}
                    unit="ms"
                    normalRange={{ min: 20, max: 70 }}
                    color="#8b5cf6"
                    trend={{ direction: 'down', change: -6.1 }}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* AI Clinical Assistant */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            AI Clinical Assistant
          </h2>
          <div className="space-y-3">
            {mockAIInsights.map((insight) => (
              <Card
                key={insight.id}
                hoverable
                accentColor={
                  insight.priority === 'high'
                    ? 'danger'
                    : insight.priority === 'moderate'
                      ? 'warning'
                      : 'primary'
                }
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
                        insight.priority === 'high'
                          ? 'bg-red-100 dark:bg-red-900'
                          : insight.priority === 'moderate'
                            ? 'bg-amber-100 dark:bg-amber-900'
                            : 'bg-primary-100 dark:bg-primary-900',
                      )}
                    >
                      {insight.type === 'differential' ? (
                        <Brain className="h-4 w-4 text-red-600 dark:text-red-400" />
                      ) : insight.type === 'drug_interaction' ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <Stethoscope className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {insight.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {insight.description}
                      </p>
                      <Badge variant="default" size="sm" className="mt-2">
                        Confidence: {Math.round(insight.confidence * 100)}%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Efficacy Tracker Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Prescription Efficacy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { drug: 'Lisinopril 10mg', condition: 'Hypertension', rate: 87 },
                  { drug: 'Metformin 500mg', condition: 'T2 Diabetes', rate: 78 },
                  { drug: 'Amoxicillin 250mg', condition: 'URTI', rate: 92 },
                ].map((rx) => (
                  <div key={rx.drug} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {rx.drug}
                      </p>
                      <p className="text-2xs text-slate-500">{rx.condition}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            rx.rate >= 85 ? 'bg-green-500' : rx.rate >= 70 ? 'bg-amber-500' : 'bg-red-500',
                          )}
                          style={{ width: `${rx.rate}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {rx.rate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
