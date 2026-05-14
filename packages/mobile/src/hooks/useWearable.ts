/**
 * useWearable Hook
 *
 * Manages BLE (Bluetooth Low Energy) device scanning, connection,
 * and health data synchronization using react-native-ble-plx.
 * Handles the full lifecycle from device discovery through data
 * ingestion and backend sync.
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import { BleManager, type Device, type Subscription } from 'react-native-ble-plx';
import { useHealthStore } from '../stores/healthStore';
import { apiClient } from '../services/api';
import type { WearableDevice, ConnectionStatus } from '../components/wearable/WearableSync';

// ---------------------------------------------------------------------------
// Base64 Decode Helper (Buffer is not available in React Native)
// ---------------------------------------------------------------------------

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseWearableReturn {
  /** List of discovered/paired devices */
  devices: WearableDevice[];
  /** Whether a BLE scan is in progress */
  isScanning: boolean;
  /** Start scanning for nearby BLE devices */
  scan: () => Promise<void>;
  /** Stop an active scan */
  stopScan: () => void;
  /** Connect to a specific device */
  connect: (deviceId: string) => Promise<boolean>;
  /** Disconnect from a device */
  disconnect: (deviceId: string) => Promise<void>;
  /** Sync data from a connected device */
  syncData: (deviceId: string) => Promise<boolean>;
  /** Error message from the last operation */
  error: string | null;
}

// ---------------------------------------------------------------------------
// BLE Service UUIDs (standard Health profiles)
// ---------------------------------------------------------------------------

const BLE_SERVICE_UUIDS = {
  HEART_RATE: '0000180d-0000-1000-8000-00805f9b34fb',
  BLOOD_PRESSURE: '00001810-0000-1000-8000-00805f9b34fb',
  HEALTH_THERMOMETER: '00001809-0000-1000-8000-00805f9b34fb',
  PULSE_OXIMETER: '00001822-0000-1000-8000-00805f9b34fb',
  BATTERY: '0000180f-0000-1000-8000-00805f9b34fb',
} as const;

const SCAN_TIMEOUT_MS = 15000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWearable(): UseWearableReturn {
  const bleManagerRef = useRef<BleManager | null>(null);
  const scanSubscriptionRef = useRef<Subscription | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [devices, setDevices] = useState<WearableDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addVitals, setDeviceSyncStatus } = useHealthStore();

  // Initialize BLE manager
  useEffect(() => {
    bleManagerRef.current = new BleManager();

    return () => {
      scanSubscriptionRef.current?.remove();
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      bleManagerRef.current?.destroy();
    };
  }, []);

  /**
   * Request Bluetooth permissions (required on Android 12+).
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      const apiLevel = Platform.Version;

      if (apiLevel >= 31) {
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        return Object.values(results).every(
          (r) => r === PermissionsAndroid.RESULTS.GRANTED
        );
      }

      const locationPermission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );

      return locationPermission === PermissionsAndroid.RESULTS.GRANTED;
    }

    // iOS permissions are handled via Info.plist
    return true;
  }, []);

  /**
   * Maps a raw BLE device to our WearableDevice interface.
   */
  const mapBleDevice = useCallback(
    (device: Device, status: ConnectionStatus = 'disconnected'): WearableDevice => ({
      id: device.id,
      name: device.localName || device.name || 'Unknown Device',
      type: inferDeviceType(device),
      manufacturer: device.manufacturerData
        ? 'Detected via BLE'
        : 'Unknown',
      status,
      lastSyncedAt: undefined,
      syncProgress: undefined,
    }),
    []
  );

  /**
   * Starts a BLE scan for nearby health devices.
   */
  const scan = useCallback(async () => {
    setError(null);

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      setError('Bluetooth permissions are required to scan for devices.');
      return;
    }

    const manager = bleManagerRef.current;
    if (!manager) {
      setError('Bluetooth manager not initialized.');
      return;
    }

    // Check BLE state
    const state = await manager.state();
    if (state !== 'PoweredOn') {
      setError('Please enable Bluetooth to scan for devices.');
      return;
    }

    setIsScanning(true);

    // Clear previously discovered (non-connected) devices
    setDevices((prev) =>
      prev.filter((d) => d.status === 'connected' || d.status === 'syncing')
    );

    // Start scan
    manager.startDeviceScan(
      Object.values(BLE_SERVICE_UUIDS),
      { allowDuplicates: false },
      (scanError, device) => {
        if (scanError) {
          setError(`Scan error: ${scanError.message}`);
          setIsScanning(false);
          return;
        }

        if (device && (device.localName || device.name)) {
          setDevices((prev) => {
            // Skip if already in the list
            if (prev.some((d) => d.id === device.id)) {
              return prev;
            }
            return [...prev, mapBleDevice(device)];
          });
        }
      }
    );

    // Auto-stop after timeout
    scanTimeoutRef.current = setTimeout(() => {
      stopScan();
    }, SCAN_TIMEOUT_MS);
  }, [mapBleDevice, requestPermissions]);

  /**
   * Stops an active BLE scan.
   */
  const stopScan = useCallback(() => {
    bleManagerRef.current?.stopDeviceScan();
    setIsScanning(false);

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
  }, []);

  /**
   * Connects to a specific BLE device.
   */
  const connect = useCallback(
    async (deviceId: string): Promise<boolean> => {
      const manager = bleManagerRef.current;
      if (!manager) return false;

      setError(null);
      updateDeviceStatus(deviceId, 'connecting');

      try {
        const device = await manager.connectToDevice(deviceId, {
          requestMTU: 512,
          timeout: 10000,
        });

        await device.discoverAllServicesAndCharacteristics();

        // Read battery level if available
        try {
          const batteryChar = await device.readCharacteristicForService(
            BLE_SERVICE_UUIDS.BATTERY,
            '00002a19-0000-1000-8000-00805f9b34fb'
          );
          if (batteryChar.value) {
            const batteryLevel = base64ToUint8Array(batteryChar.value)[0];
            setDevices((prev) =>
              prev.map((d) =>
                d.id === deviceId ? { ...d, batteryLevel } : d
              )
            );
          }
        } catch {
          // Battery service not available - non-fatal
        }

        updateDeviceStatus(deviceId, 'connected');
        setDeviceSyncStatus(deviceId, 'connected');

        // Set up disconnect listener
        manager.onDeviceDisconnected(deviceId, () => {
          updateDeviceStatus(deviceId, 'disconnected');
          setDeviceSyncStatus(deviceId, 'disconnected');
        });

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Connection failed.';
        setError(message);
        updateDeviceStatus(deviceId, 'error', message);
        return false;
      }
    },
    [setDeviceSyncStatus]
  );

  /**
   * Disconnects from a device.
   */
  const disconnect = useCallback(
    async (deviceId: string) => {
      const manager = bleManagerRef.current;
      if (!manager) return;

      try {
        await manager.cancelDeviceConnection(deviceId);
        updateDeviceStatus(deviceId, 'disconnected');
        setDeviceSyncStatus(deviceId, 'disconnected');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Disconnect failed.';
        setError(message);
      }
    },
    [setDeviceSyncStatus]
  );

  /**
   * Syncs health data from a connected device to the backend.
   */
  const syncData = useCallback(
    async (deviceId: string): Promise<boolean> => {
      const manager = bleManagerRef.current;
      if (!manager) return false;

      setError(null);
      updateDeviceStatus(deviceId, 'syncing');
      updateDeviceSyncProgress(deviceId, 0);

      try {
        const device = await manager.devices([deviceId]);
        if (device.length === 0) {
          throw new Error('Device not found. Please reconnect.');
        }

        // Read heart rate data
        updateDeviceSyncProgress(deviceId, 20);
        try {
          const hrChar = await device[0].readCharacteristicForService(
            BLE_SERVICE_UUIDS.HEART_RATE,
            '00002a37-0000-1000-8000-00805f9b34fb'
          );
          if (hrChar.value) {
            const hrData = base64ToUint8Array(hrChar.value);
            const heartRate = hrData[1]; // Simplified parsing
            addVitals({
              heart_rate_bpm: heartRate,
              recorded_at: new Date().toISOString(),
            });
          }
        } catch {
          // Heart rate not available
        }

        updateDeviceSyncProgress(deviceId, 50);

        // Read SpO2 data
        try {
          const spo2Char = await device[0].readCharacteristicForService(
            BLE_SERVICE_UUIDS.PULSE_OXIMETER,
            '00002a5e-0000-1000-8000-00805f9b34fb'
          );
          if (spo2Char.value) {
            const spo2Data = base64ToUint8Array(spo2Char.value);
            addVitals({
              spO2_percent: spo2Data[1],
              recorded_at: new Date().toISOString(),
            });
          }
        } catch {
          // SpO2 not available
        }

        updateDeviceSyncProgress(deviceId, 80);

        // Sync to backend
        await apiClient.syncWearableData(deviceId);

        updateDeviceSyncProgress(deviceId, 100);

        // Update device with last sync time
        setDevices((prev) =>
          prev.map((d) =>
            d.id === deviceId
              ? { ...d, lastSyncedAt: new Date().toISOString(), syncProgress: undefined }
              : d
          )
        );

        updateDeviceStatus(deviceId, 'connected');
        setDeviceSyncStatus(deviceId, 'synced');

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Data sync failed.';
        setError(message);
        updateDeviceStatus(deviceId, 'error', message);
        return false;
      }
    },
    [addVitals, setDeviceSyncStatus]
  );

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function updateDeviceStatus(
    deviceId: string,
    status: ConnectionStatus,
    errorMessage?: string
  ) {
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId ? { ...d, status, errorMessage } : d
      )
    );
  }

  function updateDeviceSyncProgress(deviceId: string, progress: number) {
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId ? { ...d, syncProgress: progress } : d
      )
    );
  }

  return {
    devices,
    isScanning,
    scan,
    stopScan,
    connect,
    disconnect,
    syncData,
    error,
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Infers the device type based on BLE service UUIDs and device name heuristics.
 */
function inferDeviceType(device: Device): WearableDevice['type'] {
  const name = (device.localName || device.name || '').toLowerCase();

  if (name.includes('watch') || name.includes('galaxy') || name.includes('apple')) {
    return 'smartwatch';
  }
  if (name.includes('band') || name.includes('fitbit') || name.includes('mi band')) {
    return 'fitness_band';
  }
  if (name.includes('oximeter') || name.includes('spo2')) {
    return 'pulse_oximeter';
  }
  if (name.includes('pressure') || name.includes('bp')) {
    return 'bp_monitor';
  }
  if (name.includes('scale') || name.includes('weight')) {
    return 'scale';
  }
  if (name.includes('cgm') || name.includes('glucose') || name.includes('libre')) {
    return 'cgm';
  }

  return 'fitness_band';
}
