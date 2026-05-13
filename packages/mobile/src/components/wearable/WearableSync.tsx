/**
 * WearableSync Component
 *
 * Device connection management component displaying a list of supported
 * wearable devices with connection status, sync progress, and last sync
 * timestamps. Integrates with the useWearable hook for BLE device
 * scanning and data synchronization.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors, Spacing, Typography, Radius, Shadows } from '../../utils/formatters';
import { formatRelativeTime } from '../../utils/formatters';
import { Button } from '../ui/Button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'syncing' | 'error';

export interface WearableDevice {
  id: string;
  name: string;
  type: 'smartwatch' | 'fitness_band' | 'pulse_oximeter' | 'bp_monitor' | 'scale' | 'cgm';
  manufacturer: string;
  status: ConnectionStatus;
  batteryLevel?: number;
  lastSyncedAt?: string;
  syncProgress?: number;
  errorMessage?: string;
}

interface WearableSyncProps {
  /** List of discovered or paired devices */
  devices: WearableDevice[];
  /** Whether a BLE scan is currently in progress */
  isScanning: boolean;
  /** Called when the user initiates a device scan */
  onScan: () => void;
  /** Called when the user taps a device to connect */
  onConnect: (deviceId: string) => void;
  /** Called when the user initiates a data sync */
  onSync: (deviceId: string) => void;
  /** Called when the user disconnects a device */
  onDisconnect: (deviceId: string) => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DeviceIcon({ type, color }: { type: WearableDevice['type']; color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" accessibilityRole="image" accessibilityLabel={`${type} icon`}>
      {type === 'smartwatch' || type === 'fitness_band' ? (
        <>
          <Rect x={6} y={2} width={12} height={20} rx={3} stroke={color} strokeWidth={1.8} fill="none" />
          <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={1.5} fill="none" />
          <Path d="M12 9V12L14 14" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        </>
      ) : type === 'pulse_oximeter' ? (
        <>
          <Path d="M12 3C12 3 8 7 8 11C8 13.2091 9.79086 15 12 15C14.2091 15 16 13.2091 16 11C16 7 12 3 12 3Z" stroke={color} strokeWidth={1.8} fill="none" />
          <Path d="M8 17H16" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
          <Path d="M9 20H15" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} fill="none" />
          <Path d="M7 12H10L12 8L14 16L16 12H17" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </Svg>
  );
}

/** Rect needs to be imported from react-native-svg */
function Rect({ x, y, width, height, rx, stroke, strokeWidth, fill }: {
  x: number; y: number; width: number; height: number;
  rx: number; stroke: string; strokeWidth: number; fill: string;
}) {
  return (
    <Path
      d={`M${x + rx},${y} H${x + width - rx} A${rx},${rx} 0 0 1 ${x + width},${y + rx} V${y + height - rx} A${rx},${rx} 0 0 1 ${x + width - rx},${y + height} H${x + rx} A${rx},${rx} 0 0 1 ${x},${y + height - rx} V${y + rx} A${rx},${rx} 0 0 1 ${x + rx},${y} Z`}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill={fill}
    />
  );
}

function StatusIndicator({ status }: { status: ConnectionStatus }) {
  const colorMap: Record<ConnectionStatus, string> = {
    disconnected: Colors.gray400,
    scanning: Colors.warning,
    connecting: Colors.warning,
    connected: Colors.success,
    syncing: Colors.primary,
    error: Colors.error,
  };

  const labelMap: Record<ConnectionStatus, string> = {
    disconnected: 'Disconnected',
    scanning: 'Scanning...',
    connecting: 'Connecting...',
    connected: 'Connected',
    syncing: 'Syncing...',
    error: 'Error',
  };

  const rotation = useSharedValue(0);

  React.useEffect(() => {
    if (status === 'scanning' || status === 'connecting' || status === 'syncing') {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1500, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      rotation.value = 0;
    }
  }, [rotation, status]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const isAnimating = ['scanning', 'connecting', 'syncing'].includes(status);

  return (
    <View style={statusStyles.container}>
      {isAnimating ? (
        <Animated.View style={animatedStyle}>
          <ActivityIndicator size={12} color={colorMap[status]} />
        </Animated.View>
      ) : (
        <View
          style={[statusStyles.dot, { backgroundColor: colorMap[status] }]}
          accessibilityRole="text"
          accessibilityLabel={`Status: ${labelMap[status]}`}
        />
      )}
      <Text style={[statusStyles.label, { color: colorMap[status] }]}>
        {labelMap[status]}
      </Text>
    </View>
  );
}

const statusStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    ...Typography.caption,
    fontWeight: '500',
  },
});

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function WearableSync({
  devices,
  isScanning,
  onScan,
  onConnect,
  onSync,
  onDisconnect,
}: WearableSyncProps) {
  const renderDevice = ({ item }: { item: WearableDevice }) => {
    const isConnected = item.status === 'connected';
    const isBusy = ['scanning', 'connecting', 'syncing'].includes(item.status);

    return (
      <View
        style={styles.deviceCard}
        accessibilityRole="button"
        accessibilityLabel={`${item.name} by ${item.manufacturer}, ${item.status}`}
      >
        <View style={styles.deviceHeader}>
          <View style={[styles.deviceIconContainer, isConnected && styles.deviceIconConnected]}>
            <DeviceIcon
              type={item.type}
              color={isConnected ? Colors.primary : Colors.textSecondary}
            />
          </View>

          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.deviceManufacturer} numberOfLines={1}>
              {item.manufacturer}
            </Text>
            <StatusIndicator status={item.status} />
          </View>

          {item.batteryLevel !== undefined && isConnected && (
            <View style={styles.batteryContainer}>
              <Text
                style={[
                  styles.batteryText,
                  item.batteryLevel < 20 && styles.batteryLow,
                ]}
              >
                {item.batteryLevel}%
              </Text>
            </View>
          )}
        </View>

        {/* Sync progress bar */}
        {item.status === 'syncing' && item.syncProgress !== undefined && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${item.syncProgress}%` }]}
              />
            </View>
            <Text style={styles.progressText}>{item.syncProgress}%</Text>
          </View>
        )}

        {/* Last synced timestamp */}
        {item.lastSyncedAt && (
          <Text style={styles.lastSynced}>
            Last synced {formatRelativeTime(item.lastSyncedAt)}
          </Text>
        )}

        {/* Error message */}
        {item.status === 'error' && item.errorMessage && (
          <Text style={styles.errorMessage}>{item.errorMessage}</Text>
        )}

        {/* Action buttons */}
        <View style={styles.deviceActions}>
          {item.status === 'disconnected' && (
            <Button
              title="Connect"
              variant="primary"
              size="sm"
              onPress={() => onConnect(item.id)}
            />
          )}
          {isConnected && (
            <>
              <Button
                title="Sync Now"
                variant="secondary"
                size="sm"
                onPress={() => onSync(item.id)}
              />
              <Button
                title="Disconnect"
                variant="ghost"
                size="sm"
                onPress={() => onDisconnect(item.id)}
              />
            </>
          )}
          {item.status === 'error' && (
            <Button
              title="Retry"
              variant="outline"
              size="sm"
              onPress={() => onConnect(item.id)}
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with scan button */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Connected Devices</Text>
          <Text style={styles.headerSubtitle}>
            {devices.filter((d) => d.status === 'connected').length} of{' '}
            {devices.length} connected
          </Text>
        </View>
        <Button
          title={isScanning ? 'Scanning...' : 'Scan'}
          variant="outline"
          size="sm"
          loading={isScanning}
          onPress={onScan}
          accessibilityLabel="Scan for nearby Bluetooth devices"
        />
      </View>

      {/* Device list */}
      {devices.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" accessibilityRole="image" accessibilityLabel="No devices">
            <Path
              d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2Z"
              stroke={Colors.gray300}
              strokeWidth={1.5}
            />
            <Path d="M9 9L15 15M15 9L9 15" stroke={Colors.gray300} strokeWidth={1.5} strokeLinecap="round" />
          </Svg>
          <Text style={styles.emptyTitle}>No devices found</Text>
          <Text style={styles.emptySubtitle}>
            Tap "Scan" to search for nearby Bluetooth health devices
          </Text>
        </View>
      ) : (
        <FlatList
          data={devices}
          renderItem={renderDevice}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  headerTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xxs,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  separator: {
    height: Spacing.md,
  },
  deviceCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  deviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  deviceIconConnected: {
    backgroundColor: Colors.primaryFaded,
  },
  deviceInfo: {
    flex: 1,
    gap: Spacing.xxs,
  },
  deviceName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  deviceManufacturer: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  batteryContainer: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    backgroundColor: Colors.gray100,
    borderRadius: Radius.sm,
  },
  batteryText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  batteryLow: {
    color: Colors.error,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.gray200,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  progressText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
  lastSynced: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
  },
  errorMessage: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.sm,
  },
  deviceActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxxl,
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    ...Typography.bodySm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
