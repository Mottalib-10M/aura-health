import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { formatTime } from '@/utils/formatters';
import { useSchedule } from '@/hooks/useSchedule';
import { useEfficacy } from '@/hooks/useEfficacy';
import { useTelemetry } from '@/hooks/useTelemetry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function urgencyFromStatus(status: string): 'critical' | 'high' | 'moderate' | 'low' {
  switch (status) {
    case 'EMERGENCY': return 'critical';
    case 'URGENT': return 'high';
    case 'SEMI_URGENT': return 'moderate';
    default: return 'low';
  }
}

function calcAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DoctorDashboard() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const doctorId = user?.id ?? '';

  const { appointments, isLoading } = useSchedule(doctorId, today);
  const { metrics: efficacyData } = useEfficacy();

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Select first appointment's patient by default
  const todayAppointments = useMemo(() => {
    return appointments.filter(a => a.status !== 'CANCELLED');
  }, [appointments]);

  const activePatientId = selectedPatientId ?? todayAppointments[0]?.patientId ?? null;
  const selected = todayAppointments.find(a => a.patientId === activePatientId);

  // Telemetry for selected patient
  const { vitals, getLatestVital, getTrend } = useTelemetry({
    patientId: activePatientId ?? '',
    days: 30,
    enabled: !!activePatientId,
  });

  const latestHR = getLatestVital('heart_rate');
  const latestSpO2 = getLatestVital('spo2');
  const latestHRV = getLatestVital('hrv');
  const hrTrend = getTrend('heart_rate');
  const spo2Trend = getTrend('spo2');
  const hrvTrend = getTrend('hrv');

  // Convert vitals to sparkline format
  const hrData = (vitals['heart_rate'] ?? []).map(d => ({ timestamp: d.timestamp, value: d.value }));
  const spo2Data = (vitals['spo2'] ?? []).map(d => ({ timestamp: d.timestamp, value: d.value }));
  const hrvData = (vitals['hrv'] ?? []).map(d => ({ timestamp: d.timestamp, value: d.value }));

  // Stats
  const completedToday = appointments.filter(a => a.status === 'COMPLETED').length;
  const totalToday = todayAppointments.length;

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
        <Button onClick={() => navigate('/doctor/schedule')}>
          <CalendarDays className="h-4 w-4" />
          Full Schedule
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Patients Today', value: String(totalToday), icon: Users, color: 'text-primary-600 bg-primary-100 dark:bg-primary-900' },
          { label: 'Completed', value: String(completedToday), icon: Clock, color: 'text-secondary-600 bg-secondary-100 dark:bg-secondary-900' },
          { label: 'Satisfaction', value: user ? '4.8/5' : '-', icon: Star, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900' },
          { label: 'Pending Follow-ups', value: String(appointments.filter(a => a.status === 'SCHEDULED').length), icon: Activity, color: 'text-red-600 bg-red-100 dark:bg-red-900' },
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
          {todayAppointments.length === 0 ? (
            <Card className="p-8 text-center text-sm text-slate-500">
              No appointments scheduled for today.
            </Card>
          ) : (
            <div className="space-y-2">
              {todayAppointments.map((apt) => {
                const endTime = new Date(new Date(apt.scheduledAt).getTime() + apt.durationMinutes * 60000).toISOString();
                const patientAge = apt.patient?.dateOfBirth ? calcAge(apt.patient.dateOfBirth) : null;
                return (
                  <Card
                    key={apt.id}
                    hoverable
                    accentColor={apt.status === 'CONFIRMED' ? 'warning' : undefined}
                    className={cn(
                      'cursor-pointer transition-all',
                      activePatientId === apt.patientId && 'ring-2 ring-primary-500',
                    )}
                    onClick={() => setSelectedPatientId(apt.patientId)}
                  >
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {formatTime(apt.scheduledAt)}
                          </p>
                          <p className="text-2xs text-slate-400">
                            {formatTime(endTime)}
                          </p>
                        </div>
                        <div className="h-10 w-px bg-slate-200 dark:bg-slate-700" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {apt.patient?.firstName} {apt.patient?.lastName}
                            </p>
                            {patientAge !== null && (
                              <span className="text-xs text-slate-400">{patientAge}y</span>
                            )}
                            <Badge variant={apt.status === 'CONFIRMED' ? 'success' : 'default'} size="sm">
                              {apt.status}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">{apt.reason ?? 'No reason noted'}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Telemetry for Selected Patient */}
          {selected && hrData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {selected.patient?.firstName} {selected.patient?.lastName} - 30-Day Telemetry
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <VitalSparkline
                    data={hrData}
                    label="Heart Rate"
                    currentValue={latestHR?.value ?? 0}
                    unit="bpm"
                    normalRange={{ min: 60, max: 100 }}
                    color="#ef4444"
                    trend={hrTrend}
                  />
                  <VitalSparkline
                    data={spo2Data}
                    label="SpO2"
                    currentValue={latestSpO2?.value ?? 0}
                    unit="%"
                    normalRange={{ min: 95, max: 100 }}
                    color="#3b82f6"
                    trend={spo2Trend}
                  />
                  <VitalSparkline
                    data={hrvData}
                    label="HRV"
                    currentValue={latestHRV?.value ?? 0}
                    unit="ms"
                    normalRange={{ min: 20, max: 70 }}
                    color="#8b5cf6"
                    trend={hrvTrend}
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
            {/* Generate insights from today's appointments */}
            {todayAppointments.length > 0 && (
              <Card hoverable accentColor="primary">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900">
                      <Stethoscope className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        Daily Summary
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        You have {totalToday} patients today. {appointments.filter(a => a.status === 'CONFIRMED').length} confirmed, {appointments.filter(a => a.status === 'SCHEDULED').length} pending confirmation.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {todayAppointments.some(a => a.reason?.toLowerCase().includes('chest') || a.reason?.toLowerCase().includes('pain')) && (
              <Card hoverable accentColor="danger">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900">
                      <Brain className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        High Priority Cases
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Some patients today present with acute symptoms. Review triage results before consultations.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card hoverable accentColor="warning">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Triage Review
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Check the triage review page for pending AI triage assessments requiring doctor approval.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 -ml-2"
                      onClick={() => navigate('/doctor/triage-review')}
                    >
                      Review Triage Queue
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Efficacy Tracker Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Prescription Efficacy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {efficacyData.length > 0 ? efficacyData.slice(0, 5).map((metric) => (
                  <div key={metric.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {metric.drugName} {metric.dosage}
                      </p>
                      <p className="text-2xs text-slate-500">{metric.diagnosisCode}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            metric.outcomeMetrics.remissionRate >= 0.85 ? 'bg-green-500' : metric.outcomeMetrics.remissionRate >= 0.7 ? 'bg-amber-500' : 'bg-red-500',
                          )}
                          style={{ width: `${Math.round(metric.outcomeMetrics.remissionRate * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {Math.round(metric.outcomeMetrics.remissionRate * 100)}%
                      </span>
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-slate-500">No efficacy data available.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
