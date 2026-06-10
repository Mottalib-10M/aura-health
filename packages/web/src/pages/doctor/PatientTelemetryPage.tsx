import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, AlertTriangle } from 'lucide-react';
import { TelemetryDashboard, type TelemetryData } from '@/components/charts/TelemetryDashboard';
import { Card, CardContent } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthStore } from '@/stores/authStore';
import { usePatients, type PatientRow } from '@/hooks/usePatients';
import { useTelemetry } from '@/hooks/useTelemetry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function PatientTelemetryPage() {
  const user = useAuthStore((s) => s.user);
  const doctorId = user?.id ?? '';
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get('patientId') ?? '';

  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId);
  const { patients, isLoading: patientsLoading } = usePatients(doctorId);

  const { vitals, isLoading: telemetryLoading, getLatestVital } = useTelemetry({
    patientId: selectedPatientId,
    days: 90,
    enabled: !!selectedPatientId,
  });

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  // Convert to TelemetryDashboard format
  const telemetryData: TelemetryData | null = useMemo(() => {
    if (!vitals || Object.keys(vitals).length === 0) return null;
    return {
      heartRate: (vitals['heart_rate'] ?? []).map(d => ({ timestamp: d.timestamp, value: d.value })),
      spO2: (vitals['spo2'] ?? []).map(d => ({ timestamp: d.timestamp, value: d.value })),
      hrvMs: (vitals['hrv'] ?? []).map(d => ({ timestamp: d.timestamp, value: d.value })),
      sleepHours: (vitals['sleep'] ?? []).map(d => ({ timestamp: d.timestamp, value: d.value })),
      steps: (vitals['steps'] ?? []).map(d => ({ timestamp: d.timestamp, value: d.value })),
    };
  }, [vitals]);

  if (patientsLoading) {
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
          Patient Telemetry
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Monitor patient vitals and biometric data from connected devices
        </p>
      </div>

      {/* Patient Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Select
                label="Select Patient"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                options={patients.map((p) => ({
                  value: p.id,
                  label: `${p.firstName} ${p.lastName} (${calcAge(p.dateOfBirth)}y)`,
                }))}
                placeholder="Choose a patient to view their telemetry..."
              />
            </div>
            {selectedPatient && (
              <div className="flex items-center gap-3 text-sm">
                <Badge variant="success" dot>Synced</Badge>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedPatient.region}, {selectedPatient.city}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Patient Vitals */}
      {!selectedPatientId ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-950">
              <Activity className="h-8 w-8 text-primary-500" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Select a Patient
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Choose a patient from the dropdown to view their telemetry data.
            </p>
          </CardContent>
        </Card>
      ) : telemetryLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Patient Info Bar */}
          {selectedPatient && (
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700 dark:bg-primary-900 dark:text-primary-300">
                {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {calcAge(selectedPatient.dateOfBirth)} years old | Blood Type: {selectedPatient.bloodType ?? 'Unknown'}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-4 text-sm">
                {getLatestVital('heart_rate') && (
                  <span className="text-xs text-slate-500">HR: <strong>{getLatestVital('heart_rate')!.value.toFixed(0)} bpm</strong></span>
                )}
                {getLatestVital('spo2') && (
                  <span className="text-xs text-slate-500">SpO2: <strong>{getLatestVital('spo2')!.value.toFixed(1)}%</strong></span>
                )}
              </div>
            </div>
          )}

          {/* Telemetry Dashboard */}
          {telemetryData && telemetryData.heartRate.length > 0 ? (
            <TelemetryDashboard data={telemetryData} anomalies={[]} />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center py-16">
                <p className="text-sm text-slate-500">No telemetry data available for this patient.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
