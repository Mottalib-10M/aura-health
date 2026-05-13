/**
 * HealthScreen
 *
 * Health telemetry dashboard with date range tabs and charts for:
 *   - Heart Rate (line chart with min/max/avg)
 *   - SpO2 (area chart with normal range shading)
 *   - HRV (bar chart)
 *   - Sleep (stacked bar: deep/light/REM/awake)
 *   - Steps (daily bars with goal line)
 *   - Connected devices with sync status
 *   - "Connect Wearable" button
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { VitalChart, type ChartDataPoint } from '../../components/charts/VitalChart';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useHealthStore } from '../../stores/healthStore';
import { useAuthStore } from '../../stores/authStore';
import { apiClient } from '../../services/api';
import {
  Colors,
  Spacing,
  Typography,
  Radius,
  Shadows,
  formatRelativeTime,
} from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DateRange = 'today' | '7d' | '30d' | '90d';

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: 'Today',
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HealthScreen() {
  const { user } = useAuthStore();
  const { vitals, selectedDateRange, setSelectedDateRange, connectedDevices } =
    useHealthStore();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch health data from backend
  const healthQuery = useQuery({
    queryKey: ['health', user?.id, selectedDateRange],
    queryFn: () =>
      apiClient.getHealthData(
        user?.id || '',
        selectedDateRange,
        ['heartRate', 'spO2', 'hrv', 'steps', 'sleep']
      ),
    enabled: Boolean(user?.id),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await healthQuery.refetch();
    setRefreshing(false);
  }, [healthQuery]);

  // Transform data for charts
  const heartRateData = useMemo((): ChartDataPoint[] => {
    return vitals.heartRate.map((p) => ({
      x: new Date(p.timestamp),
      y: p.value,
    }));
  }, [vitals.heartRate]);

  const heartRateSummary = useMemo(() => {
    if (vitals.heartRate.length === 0) return undefined;
    const values = vitals.heartRate.map((p) => p.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
    };
  }, [vitals.heartRate]);

  const spo2Data = useMemo((): ChartDataPoint[] => {
    return vitals.spO2.map((p) => ({
      x: new Date(p.timestamp),
      y: p.value,
    }));
  }, [vitals.spO2]);

  const spo2Summary = useMemo(() => {
    if (vitals.spO2.length === 0) return undefined;
    const values = vitals.spO2.map((p) => p.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
    };
  }, [vitals.spO2]);

  const hrvData = useMemo((): ChartDataPoint[] => {
    return vitals.hrv.map((p) => ({
      x: new Date(p.timestamp),
      y: p.value,
    }));
  }, [vitals.hrv]);

  const hrvSummary = useMemo(() => {
    if (vitals.hrv.length === 0) return undefined;
    const values = vitals.hrv.map((p) => p.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
    };
  }, [vitals.hrv]);

  const sleepData = useMemo((): ChartDataPoint[] => {
    return vitals.sleep.map((p) => ({
      x: new Date(p.timestamp),
      y: p.value,
    }));
  }, [vitals.sleep]);

  const stepsData = useMemo((): ChartDataPoint[] => {
    return vitals.steps.map((p) => ({
      x: new Date(p.timestamp),
      y: p.value,
    }));
  }, [vitals.steps]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
        />
      }
    >
      {/* Date Range Tabs */}
      <View style={styles.dateRangeTabs} accessibilityRole="tablist">
        {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((range) => (
          <Pressable
            key={range}
            style={[
              styles.dateRangeTab,
              selectedDateRange === range && styles.dateRangeTabActive,
            ]}
            onPress={() => setSelectedDateRange(range)}
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedDateRange === range }}
            accessibilityLabel={`${DATE_RANGE_LABELS[range]} date range`}
          >
            <Text
              style={[
                styles.dateRangeText,
                selectedDateRange === range && styles.dateRangeTextActive,
              ]}
            >
              {DATE_RANGE_LABELS[range]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Heart Rate Chart */}
      <VitalChart
        title="Heart Rate"
        data={heartRateData}
        type="line"
        color={Colors.chartHeartRate}
        unit="bpm"
        summary={heartRateSummary}
        referenceRange={{ min: 60, max: 100, label: 'Normal range' }}
        showPoints={selectedDateRange === 'today'}
        style={styles.chart}
      />

      {/* SpO2 Chart */}
      <VitalChart
        title="Blood Oxygen (SpO2)"
        data={spo2Data}
        type="area"
        color={Colors.chartSpO2}
        unit="%"
        summary={spo2Summary}
        referenceRange={{ min: 95, max: 100, label: 'Normal range', color: Colors.successLight }}
        style={styles.chart}
      />

      {/* HRV Chart */}
      <VitalChart
        title="Heart Rate Variability"
        data={hrvData}
        type="bar"
        color={Colors.chartHRV}
        unit="ms"
        summary={hrvSummary}
        style={styles.chart}
      />

      {/* Sleep Chart */}
      <VitalChart
        title="Sleep"
        data={sleepData}
        type="bar"
        color={Colors.chartSleep}
        unit="hrs"
        goalLine={8}
        style={styles.chart}
      />

      {/* Steps Chart */}
      <VitalChart
        title="Steps"
        data={stepsData}
        type="bar"
        color={Colors.chartSteps}
        goalLine={10000}
        style={styles.chart}
      />

      {/* Connected Devices */}
      <View style={styles.devicesSection}>
        <View style={styles.devicesSectionHeader}>
          <Text style={styles.devicesSectionTitle}>Connected Devices</Text>
        </View>

        {connectedDevices.length === 0 ? (
          <Card style={styles.noDeviceCard} elevation="sm">
            <View style={styles.noDeviceContent}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" accessibilityRole="image" accessibilityLabel="No devices connected">
                <Path d="M18 8C18 8 22 12 22 12C22 12 18 16 18 16" stroke={Colors.gray300} strokeWidth={1.5} strokeLinecap="round" />
                <Path d="M6 8C6 8 2 12 2 12C2 12 6 16 6 16" stroke={Colors.gray300} strokeWidth={1.5} strokeLinecap="round" />
                <Path d="M14 4L10 20" stroke={Colors.gray300} strokeWidth={1.5} strokeLinecap="round" />
              </Svg>
              <Text style={styles.noDeviceText}>
                Connect a wearable device to automatically sync your health data.
              </Text>
              <Button
                title="Connect Wearable"
                variant="primary"
                size="md"
                onPress={() => {}}
                accessibilityLabel="Connect a wearable health device"
              />
            </View>
          </Card>
        ) : (
          connectedDevices.map((device) => (
            <Card key={device.deviceId} style={styles.deviceCard} elevation="sm">
              <View style={styles.deviceRow}>
                <View style={styles.deviceIcon}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2Z" stroke={Colors.primary} strokeWidth={1.5} />
                    <Path d="M7 12H10L12 8L14 16L16 12H17" stroke={Colors.primary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>
                    {device.info.manufacturer} {device.info.model}
                  </Text>
                  <Text style={styles.deviceSync}>
                    {device.lastSyncedAt
                      ? `Synced ${formatRelativeTime(device.lastSyncedAt)}`
                      : 'Never synced'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.syncDot,
                    {
                      backgroundColor:
                        device.syncState === 'connected' || device.syncState === 'synced'
                          ? Colors.success
                          : device.syncState === 'error'
                          ? Colors.error
                          : Colors.gray400,
                    },
                  ]}
                />
              </View>
            </Card>
          ))
        )}
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  dateRangeTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.gray100,
    borderRadius: Radius.md,
    padding: Spacing.xxs,
    marginBottom: Spacing.xl,
  },
  dateRangeTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  dateRangeTabActive: {
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  dateRangeText: {
    ...Typography.bodySmMedium,
    color: Colors.textTertiary,
  },
  dateRangeTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  chart: {
    marginBottom: Spacing.lg,
  },
  devicesSection: {
    marginTop: Spacing.lg,
  },
  devicesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  devicesSectionTitle: {
    ...Typography.h4,
    color: Colors.darkBlue,
  },
  noDeviceCard: {
    padding: Spacing.xl,
  },
  noDeviceContent: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  noDeviceText: {
    ...Typography.bodySm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.xl,
  },
  deviceCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.lg,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    ...Typography.bodySmMedium,
    color: Colors.textPrimary,
  },
  deviceSync: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.xxs,
  },
  syncDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bottomSpacer: {
    height: Spacing.section,
  },
});
