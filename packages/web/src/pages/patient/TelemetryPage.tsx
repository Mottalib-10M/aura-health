import { useState, useMemo } from 'react';
import { Watch, Plus, Wifi, WifiOff } from 'lucide-react';
import { TelemetryDashboard, type TelemetryData, type AnomalyPoint } from '@/components/charts/TelemetryDashboard';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

// ---------------------------------------------------------------------------
// Mock Data Generator
// ---------------------------------------------------------------------------

function generateTimeSeries(days: number, baseValue: number, variance: number) {
  const points = [];
  const now = Date.now();
  const interval = days <= 1 ? 15 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const count = days <= 1 ? 96 : days;

  for (let i = count; i >= 0; i--) {
    points.push({
      timestamp: new Date(now - i * interval).toISOString(),
      value: baseValue + (Math.random() - 0.5) * variance * 2,
    });
  }
  return points;
}

const mockTelemetryData: TelemetryData = {
  heartRate: generateTimeSeries(90, 72, 12),
  spO2: generateTimeSeries(90, 97, 1.5),
  hrvMs: generateTimeSeries(90, 45, 15),
  sleepHours: generateTimeSeries(90, 7.2, 1.5),
  steps: generateTimeSeries(90, 8000, 3000),
};

const mockAnomalies: AnomalyPoint[] = [
  {
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    metric: 'heartRate',
    value: 112,
    expectedMin: 55,
    expectedMax: 100,
    severity: 'warning',
  },
];

// ---------------------------------------------------------------------------
// Device Info
// ---------------------------------------------------------------------------

interface ConnectedDevice {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  lastSync: string;
}

const mockDevices: ConnectedDevice[] = [
  {
    id: '1',
    name: 'Apple Watch Series 9',
    type: 'Smartwatch',
    connected: true,
    lastSync: '2 minutes ago',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TelemetryPage() {
  const [isLoading] = useState(false);
  const hasDevices = mockDevices.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasDevices) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Health Telemetry
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Monitor your vitals and health metrics in real time
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-950">
              <Watch className="h-8 w-8 text-primary-500" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Connect a Wearable Device
            </h3>
            <p className="mb-6 max-w-sm text-center text-sm text-slate-500 dark:text-slate-400">
              Connect your smartwatch or fitness tracker to start monitoring your health metrics
              including heart rate, blood oxygen, sleep, and activity data.
            </p>
            <Button variant="primary" size="lg">
              <Plus className="h-4 w-4" />
              Connect Wearable
            </Button>
            <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-slate-400 dark:text-slate-500">
              <span>Apple Watch</span>
              <span>Fitbit</span>
              <span>Garmin</span>
              <span>Samsung Galaxy Watch</span>
              <span>Xiaomi Mi Band</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Health Telemetry
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Monitor your vitals and health metrics in real time
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mockDevices.map((device) => (
            <div
              key={device.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {device.connected ? (
                <Wifi className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-slate-400" />
              )}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {device.name}
              </span>
              <span className="text-slate-400">
                {device.lastSync}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Telemetry Dashboard */}
      <TelemetryDashboard
        data={mockTelemetryData}
        anomalies={mockAnomalies}
      />
    </div>
  );
}
