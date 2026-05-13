import { z } from 'zod';
import { query } from '../../config/database.js';
import { callModel } from './ai-router.js';
import { logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetricDataPoint {
  timestamp: Date;
  metricType: string;
  value: number;
}

export interface LongitudinalInput {
  patientId: string;
  metricTypes: string[]; // e.g. ['heart_rate', 'spo2', 'hrv', 'blood_pressure_systolic']
  periodDays: number;
}

export interface LongitudinalOutput {
  patientId: string;
  periodDays: number;
  trends: MetricTrend[];
  alerts: HealthAlert[];
  overallAssessment: string;
  riskFactors: string[];
  recommendations: string[];
  modelUsed: string;
}

export interface MetricTrend {
  metricType: string;
  direction: 'improving' | 'stable' | 'worsening' | 'insufficient_data';
  currentMean: number;
  previousMean: number;
  changePercent: number;
  volatility: number;
  circadianScore: number | null;
}

export interface HealthAlert {
  severity: 'critical' | 'warning' | 'info';
  metricType: string;
  message: string;
  value: number;
  threshold: number;
  guidelineSource: string;
}

// ---------------------------------------------------------------------------
// AHA / WHO threshold definitions
// ---------------------------------------------------------------------------

interface ThresholdDef {
  metric: string;
  criticalLow?: number;
  warningLow?: number;
  warningHigh?: number;
  criticalHigh?: number;
  source: string;
}

const THRESHOLDS: ThresholdDef[] = [
  {
    metric: 'heart_rate',
    criticalLow: 40,
    warningLow: 50,
    warningHigh: 100,
    criticalHigh: 130,
    source: 'AHA 2023 Guidelines',
  },
  {
    metric: 'spo2',
    criticalLow: 90,
    warningLow: 94,
    source: 'WHO Pulse Oximetry Guidelines',
  },
  {
    metric: 'blood_pressure_systolic',
    warningHigh: 130,
    criticalHigh: 180,
    source: 'AHA/ACC 2017 Hypertension Guidelines',
  },
  {
    metric: 'blood_pressure_diastolic',
    warningHigh: 80,
    criticalHigh: 120,
    source: 'AHA/ACC 2017 Hypertension Guidelines',
  },
  {
    metric: 'temperature',
    criticalLow: 35.0,
    warningLow: 36.0,
    warningHigh: 37.5,
    criticalHigh: 39.5,
    source: 'WHO Clinical Guidelines',
  },
  {
    metric: 'respiratory_rate',
    criticalLow: 8,
    warningLow: 12,
    warningHigh: 20,
    criticalHigh: 30,
    source: 'WHO IMAI Guidelines',
  },
  {
    metric: 'hrv',
    warningLow: 20,
    criticalLow: 10,
    source: 'European Society of Cardiology Task Force',
  },
];

// ---------------------------------------------------------------------------
// Data resampling
// ---------------------------------------------------------------------------

/**
 * Resample irregular wearable data to fixed intervals using linear interpolation.
 * This normalizes the data stream for consistent analysis.
 */
export function resampleData(
  metrics: MetricDataPoint[],
  intervalHours: number,
): MetricDataPoint[] {
  if (metrics.length < 2) return metrics;

  // Sort by timestamp
  const sorted = [...metrics].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const startTime = sorted[0].timestamp.getTime();
  const endTime = sorted[sorted.length - 1].timestamp.getTime();
  const intervalMs = intervalHours * 60 * 60 * 1000;

  const resampled: MetricDataPoint[] = [];
  let currentTime = startTime;

  while (currentTime <= endTime) {
    // Find the two nearest data points for interpolation
    let leftIdx = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].timestamp.getTime() <= currentTime) {
        leftIdx = i;
      } else {
        break;
      }
    }

    const rightIdx = Math.min(leftIdx + 1, sorted.length - 1);

    if (leftIdx === rightIdx) {
      resampled.push({
        timestamp: new Date(currentTime),
        metricType: sorted[leftIdx].metricType,
        value: sorted[leftIdx].value,
      });
    } else {
      // Linear interpolation
      const leftTime = sorted[leftIdx].timestamp.getTime();
      const rightTime = sorted[rightIdx].timestamp.getTime();
      const fraction = (currentTime - leftTime) / (rightTime - leftTime);
      const interpolatedValue =
        sorted[leftIdx].value + fraction * (sorted[rightIdx].value - sorted[leftIdx].value);

      resampled.push({
        timestamp: new Date(currentTime),
        metricType: sorted[leftIdx].metricType,
        value: Math.round(interpolatedValue * 100) / 100,
      });
    }

    currentTime += intervalMs;
  }

  return resampled;
}

// ---------------------------------------------------------------------------
// Feature calculation
// ---------------------------------------------------------------------------

export interface MetricFeatures {
  metricType: string;
  mean: number;
  median: number;
  stddev: number;
  min: number;
  max: number;
  iqr: number;
  volatility: number; // coefficient of variation
  trend: number; // linear regression slope
  circadianScore: number | null;
  dataPointCount: number;
}

/**
 * Calculate rolling statistics, volatility, and circadian scores from a time series.
 */
export function calculateFeatures(metrics: MetricDataPoint[]): MetricFeatures {
  if (metrics.length === 0) {
    return {
      metricType: '',
      mean: 0,
      median: 0,
      stddev: 0,
      min: 0,
      max: 0,
      iqr: 0,
      volatility: 0,
      trend: 0,
      circadianScore: null,
      dataPointCount: 0,
    };
  }

  const values = metrics.map((m) => m.value);
  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;

  // Basic statistics
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);

  const min = sorted[0];
  const max = sorted[n - 1];

  // Interquartile range
  const q1Idx = Math.floor(n * 0.25);
  const q3Idx = Math.floor(n * 0.75);
  const iqr = sorted[q3Idx] - sorted[q1Idx];

  // Coefficient of variation (volatility)
  const volatility = mean !== 0 ? stddev / Math.abs(mean) : 0;

  // Linear regression slope (trend direction)
  let trend = 0;
  if (n >= 2) {
    const xMean = (n - 1) / 2;
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - mean);
      denominator += (i - xMean) ** 2;
    }
    trend = denominator !== 0 ? numerator / denominator : 0;
  }

  // Circadian score: ratio of daytime vs nighttime mean
  // Higher score = stronger circadian rhythm (normal for heart_rate / HRV)
  let circadianScore: number | null = null;
  if (n >= 24) {
    const daytimeValues: number[] = [];
    const nighttimeValues: number[] = [];

    for (const m of metrics) {
      const hour = m.timestamp.getHours();
      if (hour >= 7 && hour < 22) {
        daytimeValues.push(m.value);
      } else {
        nighttimeValues.push(m.value);
      }
    }

    if (daytimeValues.length > 0 && nighttimeValues.length > 0) {
      const dayMean = daytimeValues.reduce((s, v) => s + v, 0) / daytimeValues.length;
      const nightMean = nighttimeValues.reduce((s, v) => s + v, 0) / nighttimeValues.length;
      circadianScore = nightMean !== 0 ? Math.abs(dayMean - nightMean) / nightMean : 0;
    }
  }

  return {
    metricType: metrics[0].metricType,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    stddev: Math.round(stddev * 100) / 100,
    min,
    max,
    iqr: Math.round(iqr * 100) / 100,
    volatility: Math.round(volatility * 1000) / 1000,
    trend: Math.round(trend * 1000) / 1000,
    circadianScore: circadianScore !== null ? Math.round(circadianScore * 100) / 100 : null,
    dataPointCount: n,
  };
}

// ---------------------------------------------------------------------------
// Critical threshold checking
// ---------------------------------------------------------------------------

export function checkCriticalThresholds(
  features: MetricFeatures,
  recentValues: number[],
): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  const thresholdDef = THRESHOLDS.find((t) => t.metric === features.metricType);
  if (!thresholdDef) return alerts;

  // Check the most recent value and the mean
  const checkValue = recentValues.length > 0 ? recentValues[recentValues.length - 1] : features.mean;

  if (thresholdDef.criticalLow !== undefined && checkValue < thresholdDef.criticalLow) {
    alerts.push({
      severity: 'critical',
      metricType: features.metricType,
      message: `${features.metricType} is critically low at ${checkValue} (threshold: ${thresholdDef.criticalLow})`,
      value: checkValue,
      threshold: thresholdDef.criticalLow,
      guidelineSource: thresholdDef.source,
    });
  } else if (thresholdDef.warningLow !== undefined && checkValue < thresholdDef.warningLow) {
    alerts.push({
      severity: 'warning',
      metricType: features.metricType,
      message: `${features.metricType} is below normal at ${checkValue} (threshold: ${thresholdDef.warningLow})`,
      value: checkValue,
      threshold: thresholdDef.warningLow,
      guidelineSource: thresholdDef.source,
    });
  }

  if (thresholdDef.criticalHigh !== undefined && checkValue > thresholdDef.criticalHigh) {
    alerts.push({
      severity: 'critical',
      metricType: features.metricType,
      message: `${features.metricType} is critically high at ${checkValue} (threshold: ${thresholdDef.criticalHigh})`,
      value: checkValue,
      threshold: thresholdDef.criticalHigh,
      guidelineSource: thresholdDef.source,
    });
  } else if (thresholdDef.warningHigh !== undefined && checkValue > thresholdDef.warningHigh) {
    alerts.push({
      severity: 'warning',
      metricType: features.metricType,
      message: `${features.metricType} is above normal at ${checkValue} (threshold: ${thresholdDef.warningHigh})`,
      value: checkValue,
      threshold: thresholdDef.warningHigh,
      guidelineSource: thresholdDef.source,
    });
  }

  // Volatility alert — excessively erratic readings
  if (features.volatility > 0.3 && features.dataPointCount > 10) {
    alerts.push({
      severity: 'warning',
      metricType: features.metricType,
      message: `${features.metricType} shows high variability (CV=${(features.volatility * 100).toFixed(1)}%)`,
      value: features.volatility,
      threshold: 0.3,
      guidelineSource: 'Internal clinical analysis',
    });
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Main longitudinal analysis
// ---------------------------------------------------------------------------

export async function analyzeHealth(input: LongitudinalInput): Promise<LongitudinalOutput> {
  logger.info(
    { patientId: input.patientId, metrics: input.metricTypes, periodDays: input.periodDays },
    'Starting longitudinal health analysis',
  );

  // Fetch raw telemetry data
  const rawData = await query(
    `SELECT metric_type, value, recorded_at AS timestamp
     FROM biometric_telemetry
     WHERE patient_id = $1
       AND metric_type = ANY($2)
       AND recorded_at > NOW() - ($3 || ' days')::INTERVAL
     ORDER BY recorded_at ASC`,
    [input.patientId, input.metricTypes, input.periodDays],
  );

  // Group by metric type
  const groupedMetrics = new Map<string, MetricDataPoint[]>();
  for (const row of rawData.rows) {
    const metricType = row.metric_type as string;
    if (!groupedMetrics.has(metricType)) {
      groupedMetrics.set(metricType, []);
    }
    groupedMetrics.get(metricType)!.push({
      timestamp: new Date(row.timestamp as string),
      metricType,
      value: row.value as number,
    });
  }

  // Process each metric type
  const trends: MetricTrend[] = [];
  const allAlerts: HealthAlert[] = [];
  const featuresSummary: MetricFeatures[] = [];

  for (const [metricType, dataPoints] of groupedMetrics.entries()) {
    if (dataPoints.length < 3) {
      trends.push({
        metricType,
        direction: 'insufficient_data',
        currentMean: dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].value : 0,
        previousMean: 0,
        changePercent: 0,
        volatility: 0,
        circadianScore: null,
      });
      continue;
    }

    // Resample to 1-hour intervals
    const resampled = resampleData(dataPoints, 1);

    // Calculate features
    const features = calculateFeatures(resampled);
    featuresSummary.push(features);

    // Split into recent half vs previous half for trend comparison
    const midpoint = Math.floor(resampled.length / 2);
    const previousHalf = resampled.slice(0, midpoint);
    const recentHalf = resampled.slice(midpoint);

    const previousFeatures = calculateFeatures(previousHalf);
    const recentFeatures = calculateFeatures(recentHalf);

    // Determine trend direction
    let direction: MetricTrend['direction'] = 'stable';
    const changePct =
      previousFeatures.mean !== 0
        ? ((recentFeatures.mean - previousFeatures.mean) / Math.abs(previousFeatures.mean)) * 100
        : 0;

    if (Math.abs(changePct) < 5) {
      direction = 'stable';
    } else {
      // For metrics like SpO2, "up" is improving; for heart_rate at rest, "down toward normal" may be improving
      const improvingDirections: Record<string, 'up' | 'down'> = {
        heart_rate: 'down',
        spo2: 'up',
        hrv: 'up',
        blood_pressure_systolic: 'down',
        blood_pressure_diastolic: 'down',
      };
      const improvingDir = improvingDirections[metricType] ?? 'down';
      if (improvingDir === 'up') {
        direction = changePct > 0 ? 'improving' : 'worsening';
      } else {
        direction = changePct < 0 ? 'improving' : 'worsening';
      }
    }

    trends.push({
      metricType,
      direction,
      currentMean: recentFeatures.mean,
      previousMean: previousFeatures.mean,
      changePercent: Math.round(changePct * 10) / 10,
      volatility: features.volatility,
      circadianScore: features.circadianScore,
    });

    // Check thresholds on recent values
    const recentValues = recentHalf.map((dp) => dp.value);
    const alerts = checkCriticalThresholds(features, recentValues);
    allAlerts.push(...alerts);
  }

  // Use AI model for overall assessment if we have meaningful data
  let overallAssessment = 'Insufficient data for comprehensive assessment.';
  let riskFactors: string[] = [];
  let recommendations: string[] = [];
  let modelUsed = 'none';

  if (featuresSummary.length > 0) {
    try {
      const aiResult = await callModel('longitudinal_analysis', {
        messages: [
          {
            role: 'system',
            content: `You are a clinical health analyst. Given longitudinal biometric data trends and alerts, provide:
1. An overall health assessment (2-3 sentences)
2. Risk factors identified
3. Actionable recommendations

Respond in JSON: {"assessment": "...", "riskFactors": ["..."], "recommendations": ["..."]}`,
          },
          {
            role: 'user',
            content: JSON.stringify({ trends, alerts: allAlerts, features: featuresSummary }),
          },
        ],
        responseFormat: { type: 'json_object' },
      });

      const parsed = JSON.parse(aiResult.content);
      overallAssessment = parsed.assessment ?? overallAssessment;
      riskFactors = parsed.riskFactors ?? [];
      recommendations = parsed.recommendations ?? [];
      modelUsed = aiResult.modelUsed;
    } catch (err) {
      logger.warn({ err }, 'AI assessment for longitudinal analysis failed; using rule-based fallback');
      overallAssessment = generateRuleBasedAssessment(trends, allAlerts);
      modelUsed = 'rule-based-fallback';
    }
  }

  return {
    patientId: input.patientId,
    periodDays: input.periodDays,
    trends,
    alerts: allAlerts,
    overallAssessment,
    riskFactors,
    recommendations,
    modelUsed,
  };
}

// ---------------------------------------------------------------------------
// Rule-based fallback assessment
// ---------------------------------------------------------------------------

function generateRuleBasedAssessment(trends: MetricTrend[], alerts: HealthAlert[]): string {
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');
  const worseningTrends = trends.filter((t) => t.direction === 'worsening');

  const parts: string[] = [];

  if (criticalAlerts.length > 0) {
    parts.push(
      `URGENT: ${criticalAlerts.length} critical alert(s) detected requiring immediate medical attention.`,
    );
  }

  if (warningAlerts.length > 0) {
    parts.push(`${warningAlerts.length} warning(s) identified that should be monitored closely.`);
  }

  if (worseningTrends.length > 0) {
    const names = worseningTrends.map((t) => t.metricType).join(', ');
    parts.push(`Worsening trends observed in: ${names}.`);
  }

  if (parts.length === 0) {
    parts.push('All monitored metrics are within normal ranges with stable trends.');
  }

  return parts.join(' ');
}
