/**
 * VitalChart Component
 *
 * A reusable charting component for health telemetry data built on
 * victory-native. Supports line, area, and bar chart types with
 * configurable reference range shading, customizable colors, and
 * responsive sizing. Used throughout the Health dashboard to display
 * heart rate, SpO2, HRV, sleep, and step data.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, type ViewStyle } from 'react-native';
import {
  VictoryLine,
  VictoryArea,
  VictoryBar,
  VictoryChart,
  VictoryTheme,
  VictoryAxis,
  VictoryTooltip,
  VictoryVoronoiContainer,
  VictoryScatter,
} from 'victory-native';
import { Colors, Spacing, Typography, Radius, Shadows } from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChartType = 'line' | 'area' | 'bar';

export interface ChartDataPoint {
  x: Date | number | string;
  y: number;
  label?: string;
}

export interface ReferenceRange {
  min: number;
  max: number;
  label?: string;
  color?: string;
}

interface VitalChartProps {
  /** Chart title displayed above the chart */
  title: string;
  /** Data points to render */
  data: ChartDataPoint[];
  /** Chart visualization type */
  type?: ChartType;
  /** Primary chart color */
  color?: string;
  /** Fill color for area charts (defaults to color with opacity) */
  fillColor?: string;
  /** Normal reference range overlay */
  referenceRange?: ReferenceRange;
  /** Goal line value (e.g., step goal) */
  goalLine?: number;
  /** Y-axis unit suffix (e.g., "bpm", "%") */
  unit?: string;
  /** Chart height in pixels */
  height?: number;
  /** Show scatter points on data values */
  showPoints?: boolean;
  /** Summary statistics to display below the chart */
  summary?: {
    min: number;
    max: number;
    avg: number;
  };
  /** Override container style */
  style?: ViewStyle;
  /** Enable voronoi tooltip interaction */
  interactive?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHART_PADDING = { top: 20, bottom: 40, left: 50, right: 20 };
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VitalChart({
  title,
  data,
  type = 'line',
  color = Colors.chartHeartRate,
  fillColor,
  referenceRange,
  goalLine,
  unit = '',
  height = 200,
  showPoints = false,
  summary,
  style,
  interactive = true,
}: VitalChartProps) {
  // Compute fill color if not provided
  const areaFill = fillColor || `${color}20`;

  // Generate reference range area data
  const referenceData = useMemo(() => {
    if (!referenceRange || data.length === 0) return null;
    return data.map((point) => ({
      x: point.x,
      y: referenceRange.max,
      y0: referenceRange.min,
    }));
  }, [referenceRange, data]);

  // Goal line data
  const goalData = useMemo(() => {
    if (goalLine === undefined || data.length === 0) return null;
    return [
      { x: data[0].x, y: goalLine },
      { x: data[data.length - 1].x, y: goalLine },
    ];
  }, [goalLine, data]);

  // Format axis tick labels
  const formatYTick = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return `${Math.round(value)}`;
  };

  const formatXTick = (value: Date | number | string) => {
    if (value instanceof Date) {
      return `${value.getMonth() + 1}/${value.getDate()}`;
    }
    return String(value);
  };

  if (data.length === 0) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.emptyChart, { height }]}>
          <Text style={styles.emptyText}>No data available</Text>
        </View>
      </View>
    );
  }

  const containerProps = interactive
    ? {
        containerComponent: (
          <VictoryVoronoiContainer
            labels={({ datum }: { datum: ChartDataPoint }) =>
              `${Math.round(datum.y)} ${unit}`
            }
            labelComponent={
              <VictoryTooltip
                cornerRadius={Radius.sm}
                flyoutStyle={{
                  fill: Colors.gray800,
                  stroke: 'none',
                }}
                style={{
                  fill: Colors.textInverse,
                  fontSize: 12,
                  fontWeight: '600',
                }}
                flyoutPadding={{ top: 4, bottom: 4, left: 8, right: 8 }}
              />
            }
          />
        ),
      }
    : {};

  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="image"
      accessibilityLabel={`${title} chart. ${summary ? `Average: ${Math.round(summary.avg)} ${unit}` : ''}`}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>

      <VictoryChart
        width={CHART_WIDTH}
        height={height}
        padding={CHART_PADDING}
        theme={VictoryTheme.material}
        domainPadding={{ x: type === 'bar' ? 20 : 0, y: 10 }}
        {...containerProps}
      >
        {/* Y Axis */}
        <VictoryAxis
          dependentAxis
          tickFormat={formatYTick}
          style={{
            axis: { stroke: Colors.border },
            grid: { stroke: Colors.divider, strokeDasharray: '4,4' },
            tickLabels: {
              fill: Colors.textTertiary,
              fontSize: 10,
              fontWeight: '400',
            },
          }}
        />

        {/* X Axis */}
        <VictoryAxis
          tickFormat={formatXTick}
          style={{
            axis: { stroke: Colors.border },
            grid: { stroke: 'none' },
            tickLabels: {
              fill: Colors.textTertiary,
              fontSize: 10,
              fontWeight: '400',
              angle: 0,
            },
          }}
        />

        {/* Reference range shading */}
        {referenceData && (
          <VictoryArea
            data={referenceData}
            style={{
              data: {
                fill: referenceRange?.color || Colors.successLight,
                fillOpacity: 0.3,
                stroke: 'none',
              },
            }}
          />
        )}

        {/* Goal line */}
        {goalData && (
          <VictoryLine
            data={goalData}
            style={{
              data: {
                stroke: Colors.warning,
                strokeWidth: 1.5,
                strokeDasharray: '6,4',
              },
            }}
          />
        )}

        {/* Main data visualization */}
        {type === 'line' && (
          <VictoryLine
            data={data}
            style={{
              data: {
                stroke: color,
                strokeWidth: 2.5,
              },
            }}
            interpolation="monotoneX"
          />
        )}

        {type === 'area' && (
          <VictoryArea
            data={data}
            style={{
              data: {
                fill: areaFill,
                stroke: color,
                strokeWidth: 2,
              },
            }}
            interpolation="monotoneX"
          />
        )}

        {type === 'bar' && (
          <VictoryBar
            data={data}
            style={{
              data: {
                fill: color,
                fillOpacity: 0.8,
                width: 12,
              },
            }}
            cornerRadius={{ top: 3 }}
          />
        )}

        {/* Data points */}
        {showPoints && type !== 'bar' && (
          <VictoryScatter
            data={data}
            size={3}
            style={{
              data: {
                fill: Colors.white,
                stroke: color,
                strokeWidth: 2,
              },
            }}
          />
        )}
      </VictoryChart>

      {/* Summary statistics */}
      {summary && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Min</Text>
            <Text style={[styles.summaryValue, { color }]}>
              {Math.round(summary.min)} {unit}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Avg</Text>
            <Text style={[styles.summaryValue, { color }]}>
              {Math.round(summary.avg)} {unit}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Max</Text>
            <Text style={[styles.summaryValue, { color }]}>
              {Math.round(summary.max)} {unit}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
  },
  unit: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  emptyChart: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
    borderRadius: Radius.md,
  },
  emptyText: {
    ...Typography.bodySm,
    color: Colors.textTertiary,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    marginTop: Spacing.sm,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginBottom: Spacing.xxs,
  },
  summaryValue: {
    ...Typography.bodySmMedium,
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: Colors.divider,
  },
});
