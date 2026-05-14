import { useState, useMemo } from 'react';
import { User, Activity, AlertTriangle } from 'lucide-react';
import { TelemetryDashboard, type TelemetryData, type AnomalyPoint } from '@/components/charts/TelemetryDashboard';
import { Card, CardContent } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

interface PatientOption {
  id: string;
  name: string;
  age: number;
  lastSync: string;
  hasAnomalies: boolean;
}

const mockPatientList: PatientOption[] = [
  { id: '1', name: 'Aziz Rakhimov', age: 45, lastSync: '5 min ago', hasAnomalies: true },
  { id: '2', name: 'Malika Karimova', age: 32, lastSync: '1 hour ago', hasAnomalies: false },
  { id: '3', name: 'Javlon Yusupov', age: 67, lastSync: '30 min ago', hasAnomalies: true },
  { id: '4', name: 'Dilnoza Abdullaeva', age: 28, lastSync: '2 hours ago', hasAnomalies: false },
  { id: '5', name: 'Bobur Tursunov', age: 55, lastSync: '15 min ago', hasAnomalies: true },
];

function generateMockTelemetry(): TelemetryData {
  function gen(days: number, base: number, variance: number) {
    const points = [];
    const now = Date.now();
    for (let i = days; i >= 0; i--) {
      points.push({
        timestamp: new Date(now - i * 24 * 60 * 60 * 1000).toISOString(),
        value: base + (Math.random() - 0.5) * variance * 2,
      });
    }
    return points;
  }

  return {
    heartRate: gen(90, 72, 15),
    spO2: gen(90, 96, 2),
    hrvMs: gen(90, 42, 18),
    sleepHours: gen(90, 6.8, 2),
    steps: gen(90, 7500, 3500),
  };
}

function generateAnomalies(patientId: string): AnomalyPoint[] {
  const patient = mockPatientList.find((p) => p.id === patientId);
  if (!patient?.hasAnomalies) return [];

  return [
    {
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      metric: 'heartRate',
      value: 118,
      expectedMin: 55,
      expectedMax: 100,
      severity: 'alert',
    },
    {
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      metric: 'spO2',
      value: 91,
      expectedMin: 95,
      expectedMax: 100,
      severity: 'warning',
    },
  ];
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function PatientTelemetryPage() {
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [isLoading] = useState(false);

  const selectedPatient = mockPatientList.find((p) => p.id === selectedPatientId);
  const telemetryData = useMemo(() => generateMockTelemetry(), [selectedPatientId]);
  const anomalies = useMemo(() => generateAnomalies(selectedPatientId), [selectedPatientId]);

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
                options={mockPatientList.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.age}y)${p.hasAnomalies ? ' - Has anomalies' : ''}`,
                }))}
                placeholder="Choose a patient to view their telemetry..."
              />
            </div>
            {selectedPatient && (
              <div className="flex items-center gap-3 text-sm">
                <Badge variant={selectedPatient.hasAnomalies ? 'error' : 'success'} dot>
                  {selectedPatient.hasAnomalies ? 'Anomalies Detected' : 'Normal'}
                </Badge>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Last sync: {selectedPatient.lastSync}
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
      ) : (
        <>
          {/* Patient Info Bar */}
          {selectedPatient && (
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700 dark:bg-primary-900 dark:text-primary-300">
                {selectedPatient.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedPatient.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedPatient.age} years old | Last sync: {selectedPatient.lastSync}
                </p>
              </div>
              {anomalies.length > 0 && (
                <div className="ml-auto flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {anomalies.length} anomal{anomalies.length === 1 ? 'y' : 'ies'} detected
                </div>
              )}
            </div>
          )}

          {/* Telemetry Dashboard */}
          <TelemetryDashboard
            data={telemetryData}
            anomalies={anomalies}
          />
        </>
      )}
    </div>
  );
}
