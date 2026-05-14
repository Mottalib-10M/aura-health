import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { sendNotification, broadcastNotification } from '../../services/notification/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SurveillanceDataInput {
  region: string;
  city: string;
  diseaseCode: string;
  diseaseName: string;
  caseCount: number;
  deathCount: number;
  recoveredCount: number;
  testPositivityRate: number;
  reportDate: string;
  dataSource?: string;
}

export interface SurveillanceRecord {
  id: string;
  region: string;
  city: string;
  diseaseCode: string;
  diseaseName: string;
  caseCount: number;
  deathCount: number;
  recoveredCount: number;
  testPositivityRate: number;
  alertLevel: string;
  reportDate: string;
  dataSource: string | null;
}

export interface OutbreakAlertRecord {
  id: string;
  region: string;
  city: string | null;
  diseaseCode: string;
  diseaseName: string;
  alertLevel: string;
  caseCount: number;
  growthRate: number;
  detectionMethod: string;
  message: string;
  recommendations: string[];
  isActive: boolean;
  declaredAt: string;
  resolvedAt: string | null;
}

// ---------------------------------------------------------------------------
// EWMA (Exponentially Weighted Moving Average) outbreak detection
// ---------------------------------------------------------------------------

interface EwmaState {
  mean: number;
  variance: number;
  count: number;
}

/**
 * Compute EWMA statistics for a time series of case counts.
 * Used for early detection of anomalous increases.
 *
 * @param values - Array of case counts ordered chronologically
 * @param lambda - Smoothing parameter (0 < lambda <= 1, typically 0.2-0.3)
 * @returns EWMA mean, variance, and whether the latest value triggers an alert
 */
export function computeEwma(
  values: number[],
  lambda = 0.2,
): { state: EwmaState; alert: boolean; zScore: number } {
  if (values.length === 0) {
    return { state: { mean: 0, variance: 0, count: 0 }, alert: false, zScore: 0 };
  }

  // Initialize with the first value
  let mean = values[0];
  let variance = 0;
  const L = 3.0; // Control limit factor (3-sigma)

  for (let i = 1; i < values.length; i++) {
    const prevMean = mean;
    mean = lambda * values[i] + (1 - lambda) * mean;
    variance = lambda * (values[i] - prevMean) ** 2 + (1 - lambda) * variance;
  }

  const stddev = Math.sqrt(variance);
  const latestValue = values[values.length - 1];
  const zScore = stddev > 0 ? (latestValue - mean) / stddev : 0;

  return {
    state: { mean, variance, count: values.length },
    alert: Math.abs(zScore) > L,
    zScore: Math.round(zScore * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// CUSUM (Cumulative Sum) outbreak detection
// ---------------------------------------------------------------------------

/**
 * Tabular CUSUM algorithm for detecting persistent shifts in mean case count.
 * More sensitive to small but sustained increases than EWMA.
 *
 * @param values - Array of case counts
 * @param k - Reference value (allowance, typically 0.5 * delta where delta is the shift to detect)
 * @param h - Decision interval (threshold for alerting, typically 4-5 sigma)
 * @returns Whether the CUSUM statistic exceeds the threshold
 */
export function computeCusum(
  values: number[],
  k?: number,
  h?: number,
): { cusumHigh: number; cusumLow: number; alert: boolean } {
  if (values.length < 5) {
    return { cusumHigh: 0, cusumLow: 0, alert: false };
  }

  // Estimate baseline mean and stddev from the first half of data
  const baselineSize = Math.floor(values.length / 2);
  const baseline = values.slice(0, baselineSize);
  const baselineMean = baseline.reduce((s, v) => s + v, 0) / baseline.length;
  const baselineStddev = Math.sqrt(
    baseline.reduce((s, v) => s + (v - baselineMean) ** 2, 0) / baseline.length,
  );

  // Default parameters
  const kParam = k ?? 0.5 * baselineStddev;
  const hParam = h ?? 4 * baselineStddev;

  let cusumHigh = 0;
  let cusumLow = 0;

  for (const value of values) {
    cusumHigh = Math.max(0, cusumHigh + value - baselineMean - kParam);
    cusumLow = Math.max(0, cusumLow - value + baselineMean - kParam);
  }

  return {
    cusumHigh: Math.round(cusumHigh * 100) / 100,
    cusumLow: Math.round(cusumLow * 100) / 100,
    alert: cusumHigh > hParam || cusumLow > hParam,
  };
}

// ---------------------------------------------------------------------------
// Surveillance data aggregation
// ---------------------------------------------------------------------------

/**
 * Ingest a batch of surveillance data points and run outbreak detection.
 */
export async function ingestSurveillanceData(
  dataPoints: SurveillanceDataInput[],
): Promise<{ inserted: number; alertsGenerated: number }> {
  let alertsGenerated = 0;

  await withTransaction(async (client) => {
    for (const dp of dataPoints) {
      const alertLevel = calculateAlertLevel(dp);

      await client.query(
        `INSERT INTO surveillance_data (
          id, region, city, disease_code, disease_name,
          case_count, death_count, recovered_count,
          test_positivity_rate, alert_level,
          report_date, data_source, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
        [
          uuidv4(), dp.region, dp.city, dp.diseaseCode, dp.diseaseName,
          dp.caseCount, dp.deathCount, dp.recoveredCount,
          dp.testPositivityRate, alertLevel,
          dp.reportDate, dp.dataSource ?? null,
        ],
      );
    }
  });

  // Run outbreak detection for each unique region-disease combination
  const combinations = new Map<string, SurveillanceDataInput>();
  for (const dp of dataPoints) {
    const key = `${dp.region}:${dp.diseaseCode}`;
    combinations.set(key, dp);
  }

  for (const [_, dp] of combinations) {
    const alert = await detectOutbreak(dp.region, dp.diseaseCode);
    if (alert) alertsGenerated++;
  }

  logger.info(
    { inserted: dataPoints.length, alertsGenerated },
    'Surveillance data ingested',
  );

  return { inserted: dataPoints.length, alertsGenerated };
}

/**
 * Calculate alert level based on case count and positivity rate thresholds.
 */
function calculateAlertLevel(data: SurveillanceDataInput): string {
  const caseFatalityRate = data.caseCount > 0 ? data.deathCount / data.caseCount : 0;

  if (caseFatalityRate > 0.05 || data.testPositivityRate > 0.2) {
    return 'EMERGENCY';
  }
  if (caseFatalityRate > 0.02 || data.testPositivityRate > 0.1) {
    return 'ALERT';
  }
  if (data.testPositivityRate > 0.05) {
    return 'WARNING';
  }
  return 'WATCH';
}

// ---------------------------------------------------------------------------
// Outbreak detection
// ---------------------------------------------------------------------------

/**
 * Run EWMA and CUSUM outbreak detection on the last 90 days of data
 * for a region-disease pair.
 */
async function detectOutbreak(
  region: string,
  diseaseCode: string,
): Promise<OutbreakAlertRecord | null> {
  // Fetch historical case counts
  const result = await query(
    `SELECT case_count, report_date
     FROM surveillance_data
     WHERE region = $1 AND disease_code = $2
       AND report_date > NOW() - INTERVAL '90 days'
     ORDER BY report_date ASC`,
    [region, diseaseCode],
  );

  if (result.rows.length < 7) return null; // Need at least a week of data

  const values = result.rows.map((r) => Number(r.case_count));

  // Run both detection algorithms
  const ewmaResult = computeEwma(values, 0.2);
  const cusumResult = computeCusum(values);

  // Alert if either algorithm triggers
  const isOutbreak = ewmaResult.alert || cusumResult.alert;

  if (!isOutbreak) return null;

  // Check if there's already an active alert for this combination
  const existingAlert = await query(
    `SELECT id FROM outbreak_alerts
     WHERE region = $1 AND disease_code = $2 AND is_active = true`,
    [region, diseaseCode],
  );

  if (existingAlert.rows.length > 0) {
    // Update existing alert
    await query(
      `UPDATE outbreak_alerts
       SET case_count = $2, growth_rate = $3, updated_at = NOW()
       WHERE id = $1`,
      [existingAlert.rows[0].id, values[values.length - 1], ewmaResult.zScore],
    );
    return null; // Don't create a new alert
  }

  // Calculate growth rate (week-over-week)
  const recentWeek = values.slice(-7);
  const previousWeek = values.slice(-14, -7);
  const recentSum = recentWeek.reduce((s, v) => s + v, 0);
  const previousSum = previousWeek.length > 0
    ? previousWeek.reduce((s, v) => s + v, 0)
    : recentSum;
  const growthRate = previousSum > 0 ? (recentSum - previousSum) / previousSum : 0;

  // Determine alert level
  let alertLevel = 'WARNING';
  if (ewmaResult.zScore > 5 || growthRate > 1.0) {
    alertLevel = 'EMERGENCY';
  } else if (ewmaResult.zScore > 3 || growthRate > 0.5) {
    alertLevel = 'ALERT';
  }

  const detectionMethod = [
    ewmaResult.alert ? 'EWMA' : null,
    cusumResult.alert ? 'CUSUM' : null,
  ]
    .filter(Boolean)
    .join('+');

  // Look up disease name
  const diseaseResult = await query(
    `SELECT disease_name FROM surveillance_data
     WHERE disease_code = $1 LIMIT 1`,
    [diseaseCode],
  );
  const diseaseName = (diseaseResult.rows[0]?.disease_name as string) ?? diseaseCode;

  // Create alert
  const alertId = uuidv4();
  const message = `Potential ${diseaseName} outbreak detected in ${region}. Case growth rate: ${Math.round(growthRate * 100)}% week-over-week. Z-score: ${ewmaResult.zScore}.`;
  const recommendations = generateRecommendations(alertLevel, diseaseName);

  await query(
    `INSERT INTO outbreak_alerts (
      id, region, disease_code, disease_name,
      alert_level, case_count, growth_rate,
      detection_method, message, recommendations,
      is_active, declared_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW())`,
    [
      alertId, region, diseaseCode, diseaseName,
      alertLevel, values[values.length - 1], growthRate,
      detectionMethod, message, JSON.stringify(recommendations),
    ],
  );

  logger.warn(
    { alertId, region, diseaseCode, alertLevel, growthRate },
    'Outbreak alert generated',
  );

  // Notify relevant stakeholders (non-blocking)
  notifyOutbreakStakeholders(region, diseaseName, message, alertLevel).catch((err) => {
    logger.error({ err }, 'Failed to notify outbreak stakeholders');
  });

  return {
    id: alertId,
    region,
    city: null,
    diseaseCode,
    diseaseName,
    alertLevel,
    caseCount: values[values.length - 1],
    growthRate,
    detectionMethod,
    message,
    recommendations,
    isActive: true,
    declaredAt: new Date().toISOString(),
    resolvedAt: null,
  };
}

function generateRecommendations(alertLevel: string, diseaseName: string): string[] {
  const base = [
    `Increase surveillance and testing capacity for ${diseaseName}`,
    'Report all suspected cases to the regional health authority',
    'Review and update infection prevention protocols',
  ];

  if (alertLevel === 'ALERT' || alertLevel === 'EMERGENCY') {
    base.push(
      'Activate emergency response team',
      'Prepare additional hospital bed capacity',
      'Issue public health advisory to the community',
      'Coordinate with neighboring regions for resource sharing',
    );
  }

  if (alertLevel === 'EMERGENCY') {
    base.push(
      'Consider implementing quarantine measures',
      'Request national-level support and resources',
      'Deploy mobile testing and treatment units',
    );
  }

  return base;
}

async function notifyOutbreakStakeholders(
  region: string,
  diseaseName: string,
  message: string,
  alertLevel: string,
): Promise<void> {
  // Notify all hospital admins and analysts in the affected region
  const stakeholders = await query(
    `SELECT DISTINCT d.id
     FROM doctors d
     JOIN institutions i ON i.id = d.institution_id
     WHERE i.region = $1
       AND d.verification_status = 'VERIFIED'
     LIMIT 100`,
    [region],
  );

  const recipientIds = stakeholders.rows.map((r) => r.id as string);

  if (recipientIds.length > 0) {
    await broadcastNotification(recipientIds, {
      urgency: alertLevel === 'EMERGENCY' ? 'critical' : 'high',
      template: 'outbreak.alert',
      templateData: {
        region,
        disease: diseaseName,
        message,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Alert management
// ---------------------------------------------------------------------------

/**
 * Resolve an active outbreak alert.
 */
export async function resolveOutbreakAlert(
  alertId: string,
  resolvedBy: string,
): Promise<void> {
  await query(
    `UPDATE outbreak_alerts
     SET is_active = false, resolved_at = NOW()
     WHERE id = $1`,
    [alertId],
  );

  logger.info({ alertId, resolvedBy }, 'Outbreak alert resolved');
}

/**
 * Get active outbreak alerts, optionally filtered by region.
 */
export async function getActiveAlerts(region?: string): Promise<OutbreakAlertRecord[]> {
  let sql = `SELECT * FROM outbreak_alerts WHERE is_active = true`;
  const params: unknown[] = [];

  if (region) {
    sql += ` AND region = $1`;
    params.push(region);
  }

  sql += ` ORDER BY declared_at DESC`;

  const result = await query(sql, params);
  return result.rows.map(mapOutbreakAlertRow);
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/**
 * Generate an aggregated surveillance report for a region.
 */
export async function generateSurveillanceReport(
  region: string,
  startDate: string,
  endDate: string,
): Promise<{
  region: string;
  period: { start: string; end: string };
  summary: Array<{
    diseaseCode: string;
    diseaseName: string;
    totalCases: number;
    totalDeaths: number;
    totalRecovered: number;
    avgPositivityRate: number;
    trend: string;
  }>;
  activeAlerts: number;
}> {
  const result = await query(
    `SELECT
       disease_code,
       MAX(disease_name) AS disease_name,
       SUM(case_count) AS total_cases,
       SUM(death_count) AS total_deaths,
       SUM(recovered_count) AS total_recovered,
       AVG(test_positivity_rate) AS avg_positivity_rate
     FROM surveillance_data
     WHERE region = $1 AND report_date BETWEEN $2 AND $3
     GROUP BY disease_code
     ORDER BY total_cases DESC`,
    [region, startDate, endDate],
  );

  const alertResult = await query(
    `SELECT COUNT(*) AS count FROM outbreak_alerts
     WHERE region = $1 AND is_active = true`,
    [region],
  );

  return {
    region,
    period: { start: startDate, end: endDate },
    summary: result.rows.map((row) => ({
      diseaseCode: row.disease_code as string,
      diseaseName: (row.disease_name as string) ?? '',
      totalCases: Number(row.total_cases),
      totalDeaths: Number(row.total_deaths),
      totalRecovered: Number(row.total_recovered),
      avgPositivityRate: Math.round(Number(row.avg_positivity_rate) * 1000) / 1000,
      trend: 'stable', // Would be computed from time-series analysis
    })),
    activeAlerts: Number(alertResult.rows[0]?.count ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function mapOutbreakAlertRow(row: Record<string, unknown>): OutbreakAlertRecord {
  return {
    id: row.id as string,
    region: row.region as string,
    city: (row.city as string) ?? null,
    diseaseCode: row.disease_code as string,
    diseaseName: (row.disease_name as string) ?? '',
    alertLevel: row.alert_level as string,
    caseCount: Number(row.case_count),
    growthRate: Number(row.growth_rate),
    detectionMethod: row.detection_method as string,
    message: row.message as string,
    recommendations: (row.recommendations as string[]) ?? [],
    isActive: row.is_active as boolean,
    declaredAt: (row.declared_at as Date)?.toISOString(),
    resolvedAt: row.resolved_at ? (row.resolved_at as Date).toISOString() : null,
  };
}
