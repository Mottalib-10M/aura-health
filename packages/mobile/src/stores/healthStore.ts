/**
 * Health Store (Zustand)
 *
 * Manages health telemetry data: cached vital signs, connected device
 * sync status, active health alerts, and longitudinal analysis results.
 * Data is kept in-memory with periodic persistence to expo-sqlite for
 * offline availability.
 */

import { create } from 'zustand';
import type { VitalSigns } from '@uzavita/shared/types/patient';
import type {
  TimeSeriesDataPoint,
  BiometricAnomaly,
  HealthRiskAssessment,
  DeviceSource,
} from '@uzavita/shared/types/telemetry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DateRange = 'today' | '7d' | '30d' | '90d';
type DeviceSyncState = 'disconnected' | 'connected' | 'syncing' | 'synced' | 'error';

interface VitalsCache {
  heartRate: TimeSeriesDataPoint[];
  spO2: TimeSeriesDataPoint[];
  hrv: TimeSeriesDataPoint[];
  steps: TimeSeriesDataPoint[];
  sleep: TimeSeriesDataPoint[];
  bloodPressure: Array<{ timestamp: string; systolic: number; diastolic: number }>;
  temperature: TimeSeriesDataPoint[];
  bloodGlucose: TimeSeriesDataPoint[];
  weight: TimeSeriesDataPoint[];
}

interface HealthAlert {
  id: string;
  type: 'anomaly' | 'risk' | 'reminder' | 'device';
  severity: 'info' | 'warning' | 'alert' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  anomaly?: BiometricAnomaly;
  risk?: HealthRiskAssessment;
}

interface ConnectedDevice {
  deviceId: string;
  info: DeviceSource;
  syncState: DeviceSyncState;
  lastSyncedAt: string | null;
  errorMessage?: string;
}

interface HealthScore {
  overall: number;
  breakdown: {
    cardiovascular: number;
    activity: number;
    sleep: number;
    nutrition: number;
  };
  lastUpdated: string;
}

interface HealthState {
  /** Cached vital sign time series */
  vitals: VitalsCache;
  /** Current date range selection */
  selectedDateRange: DateRange;
  /** Active health alerts */
  alerts: HealthAlert[];
  /** Unread alert count */
  unreadAlertCount: number;
  /** Connected wearable devices */
  connectedDevices: ConnectedDevice[];
  /** Overall health score */
  healthScore: HealthScore | null;
  /** Latest vital signs snapshot */
  latestVitals: VitalSigns | null;
  /** Whether vitals are currently loading */
  isLoading: boolean;
  /** Last time vitals cache was refreshed */
  lastRefreshedAt: string | null;

  // Actions
  setVitals: (vitals: Partial<VitalsCache>) => void;
  addVitals: (vitals: Partial<VitalSigns>) => void;
  setSelectedDateRange: (range: DateRange) => void;
  addAlert: (alert: HealthAlert) => void;
  markAlertRead: (alertId: string) => void;
  dismissAlert: (alertId: string) => void;
  clearAlerts: () => void;
  addConnectedDevice: (device: ConnectedDevice) => void;
  removeConnectedDevice: (deviceId: string) => void;
  setDeviceSyncStatus: (deviceId: string, state: DeviceSyncState) => void;
  setHealthScore: (score: HealthScore) => void;
  setLatestVitals: (vitals: VitalSigns) => void;
  setIsLoading: (loading: boolean) => void;
  refreshCache: () => void;
  resetHealth: () => void;
}

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

const initialVitals: VitalsCache = {
  heartRate: [],
  spO2: [],
  hrv: [],
  steps: [],
  sleep: [],
  bloodPressure: [],
  temperature: [],
  bloodGlucose: [],
  weight: [],
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useHealthStore = create<HealthState>()((set, get) => ({
  // Initial state
  vitals: { ...initialVitals },
  selectedDateRange: 'today',
  alerts: [],
  unreadAlertCount: 0,
  connectedDevices: [],
  healthScore: null,
  latestVitals: null,
  isLoading: false,
  lastRefreshedAt: null,

  // Actions
  setVitals: (newVitals) =>
    set((state) => ({
      vitals: { ...state.vitals, ...newVitals },
      lastRefreshedAt: new Date().toISOString(),
    })),

  addVitals: (vitalSnapshot) => {
    const timestamp = vitalSnapshot.recorded_at || new Date().toISOString();

    set((state) => {
      const updated = { ...state.vitals };

      if (vitalSnapshot.heart_rate_bpm !== undefined) {
        updated.heartRate = [
          ...updated.heartRate,
          { timestamp, value: vitalSnapshot.heart_rate_bpm },
        ];
      }

      if (vitalSnapshot.spO2_percent !== undefined) {
        updated.spO2 = [
          ...updated.spO2,
          { timestamp, value: vitalSnapshot.spO2_percent },
        ];
      }

      if (vitalSnapshot.temperature_celsius !== undefined) {
        updated.temperature = [
          ...updated.temperature,
          { timestamp, value: vitalSnapshot.temperature_celsius },
        ];
      }

      if (vitalSnapshot.blood_pressure) {
        updated.bloodPressure = [
          ...updated.bloodPressure,
          {
            timestamp,
            systolic: vitalSnapshot.blood_pressure.systolic,
            diastolic: vitalSnapshot.blood_pressure.diastolic,
          },
        ];
      }

      return {
        vitals: updated,
        latestVitals: { ...state.latestVitals, ...vitalSnapshot } as VitalSigns,
      };
    });
  },

  setSelectedDateRange: (range) => set({ selectedDateRange: range }),

  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts],
      unreadAlertCount: state.unreadAlertCount + (alert.read ? 0 : 1),
    })),

  markAlertRead: (alertId) =>
    set((state) => {
      const alert = state.alerts.find((a) => a.id === alertId);
      const wasUnread = alert && !alert.read;

      return {
        alerts: state.alerts.map((a) =>
          a.id === alertId ? { ...a, read: true } : a
        ),
        unreadAlertCount: wasUnread
          ? Math.max(0, state.unreadAlertCount - 1)
          : state.unreadAlertCount,
      };
    }),

  dismissAlert: (alertId) =>
    set((state) => {
      const alert = state.alerts.find((a) => a.id === alertId);
      const wasUnread = alert && !alert.read;

      return {
        alerts: state.alerts.filter((a) => a.id !== alertId),
        unreadAlertCount: wasUnread
          ? Math.max(0, state.unreadAlertCount - 1)
          : state.unreadAlertCount,
      };
    }),

  clearAlerts: () => set({ alerts: [], unreadAlertCount: 0 }),

  addConnectedDevice: (device) =>
    set((state) => ({
      connectedDevices: [
        ...state.connectedDevices.filter((d) => d.deviceId !== device.deviceId),
        device,
      ],
    })),

  removeConnectedDevice: (deviceId) =>
    set((state) => ({
      connectedDevices: state.connectedDevices.filter(
        (d) => d.deviceId !== deviceId
      ),
    })),

  setDeviceSyncStatus: (deviceId, syncState) =>
    set((state) => ({
      connectedDevices: state.connectedDevices.map((d) =>
        d.deviceId === deviceId
          ? {
              ...d,
              syncState,
              lastSyncedAt:
                syncState === 'synced' ? new Date().toISOString() : d.lastSyncedAt,
            }
          : d
      ),
    })),

  setHealthScore: (score) => set({ healthScore: score }),

  setLatestVitals: (vitals) => set({ latestVitals: vitals }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  refreshCache: () =>
    set({ lastRefreshedAt: new Date().toISOString() }),

  resetHealth: () =>
    set({
      vitals: { ...initialVitals },
      alerts: [],
      unreadAlertCount: 0,
      connectedDevices: [],
      healthScore: null,
      latestVitals: null,
      lastRefreshedAt: null,
    }),
}));
