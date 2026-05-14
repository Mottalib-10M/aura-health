import { useState } from 'react';
import { Watch, Plus, Wifi, WifiOff, Battery, BatteryLow, BatteryMedium, BatteryFull, RefreshCw, Trash2, X, Smartphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Types & Data
// ---------------------------------------------------------------------------

interface Device {
  id: string;
  name: string;
  type: string;
  model: string;
  connected: boolean;
  lastSync: string;
  batteryLevel: number;
  firmwareVersion: string;
  metricsTracked: string[];
}

const mockDevices: Device[] = [
  {
    id: '1',
    name: 'Apple Watch',
    type: 'Smartwatch',
    model: 'Series 9 (45mm)',
    connected: true,
    lastSync: '2 minutes ago',
    batteryLevel: 78,
    firmwareVersion: '10.4.1',
    metricsTracked: ['Heart Rate', 'SpO2', 'ECG', 'Steps', 'Sleep', 'HRV'],
  },
  {
    id: '2',
    name: 'Withings BPM',
    type: 'Blood Pressure Monitor',
    model: 'BPM Connect',
    connected: true,
    lastSync: '3 hours ago',
    batteryLevel: 45,
    firmwareVersion: '2.1.0',
    metricsTracked: ['Blood Pressure', 'Heart Rate'],
  },
  {
    id: '3',
    name: 'Dexcom G7',
    type: 'CGM Sensor',
    model: 'G7',
    connected: false,
    lastSync: '2 days ago',
    batteryLevel: 12,
    firmwareVersion: '1.8.2',
    metricsTracked: ['Glucose'],
  },
];

const supportedDevices = [
  { name: 'Apple Watch', types: 'Series 5+', icon: Watch },
  { name: 'Fitbit', types: 'Sense, Versa 3+', icon: Watch },
  { name: 'Garmin', types: 'Venu, Forerunner', icon: Watch },
  { name: 'Samsung Galaxy Watch', types: 'Watch 4+', icon: Watch },
  { name: 'Withings', types: 'ScanWatch, BPM', icon: Smartphone },
  { name: 'Dexcom', types: 'G6, G7', icon: Smartphone },
  { name: 'Xiaomi Mi Band', types: 'Band 7+', icon: Watch },
  { name: 'Oura Ring', types: 'Gen 3', icon: Watch },
];

// ---------------------------------------------------------------------------
// Battery Icon
// ---------------------------------------------------------------------------

function BatteryIcon({ level }: { level: number }) {
  if (level <= 15) return <BatteryLow className="h-4 w-4 text-red-500" />;
  if (level <= 50) return <BatteryMedium className="h-4 w-4 text-amber-500" />;
  return <BatteryFull className="h-4 w-4 text-green-500" />;
}

// ---------------------------------------------------------------------------
// Device Card
// ---------------------------------------------------------------------------

function DeviceCard({ device }: { device: Device }) {
  return (
    <Card className={cn(!device.connected && 'opacity-75')}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl',
              device.connected
                ? 'bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-400'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800',
            )}>
              <Watch className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {device.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {device.model}
              </p>
            </div>
          </div>
          <Badge variant={device.connected ? 'success' : 'error'} dot size="sm">
            {device.connected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>

        {/* Metrics */}
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Tracking
          </p>
          <div className="flex flex-wrap gap-1">
            {device.metricsTracked.map((metric) => (
              <Badge key={metric} variant="default" size="sm">
                {metric}
              </Badge>
            ))}
          </div>
        </div>

        {/* Status Row */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              {device.connected ? (
                <Wifi className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-slate-400" />
              )}
              {device.lastSync}
            </span>
            <span className="flex items-center gap-1">
              <BatteryIcon level={device.batteryLevel} />
              {device.batteryLevel}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Sync device">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Remove device">
              <Trash2 className="h-4 w-4 text-red-400" />
            </Button>
          </div>
        </div>

        {/* Low battery warning */}
        {device.batteryLevel <= 15 && (
          <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
            Low battery - charge your device soon to avoid data gaps.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function DevicesPage() {
  const [isLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Wearable Devices
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage your connected health devices
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" />
          Add Device
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950">
              <Wifi className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {mockDevices.filter((d) => d.connected).length}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Connected</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950">
              <WifiOff className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {mockDevices.filter((d) => !d.connected).length}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Disconnected</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950">
              <BatteryLow className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {mockDevices.filter((d) => d.batteryLevel <= 20).length}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Low Battery</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Device List */}
      {mockDevices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <Watch className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
              No Devices Connected
            </h3>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Add a wearable device to start tracking your health metrics.
            </p>
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4" />
              Add Device
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mockDevices.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>
      )}

      {/* Add Device Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add a Device"
        description="Select the device you want to connect to Aura Health"
        size="lg"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {supportedDevices.map((device) => (
            <button
              key={device.name}
              type="button"
              className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:hover:border-primary-700 dark:hover:bg-primary-950"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                <device.icon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {device.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {device.types}
                </p>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
