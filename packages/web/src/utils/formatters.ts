import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import type { UrgencyLevel } from '@aura/shared/types/triage';

// ---------------------------------------------------------------------------
// Date / Time Formatters
// ---------------------------------------------------------------------------

/**
 * Format an ISO date string to a human-readable date.
 * @example formatDate('2025-03-15T10:30:00Z') => 'Mar 15, 2025'
 */
export function formatDate(isoString: string, pattern = 'MMM d, yyyy'): string {
  const date = parseISO(isoString);
  if (!isValid(date)) return 'Invalid date';
  return format(date, pattern);
}

/**
 * Format an ISO datetime string to a human-readable datetime.
 * @example formatDateTime('2025-03-15T10:30:00Z') => 'Mar 15, 2025 10:30 AM'
 */
export function formatDateTime(isoString: string): string {
  return formatDate(isoString, 'MMM d, yyyy h:mm a');
}

/**
 * Format an ISO datetime string to a time-only string.
 * @example formatTime('2025-03-15T10:30:00Z') => '10:30 AM'
 */
export function formatTime(isoString: string): string {
  return formatDate(isoString, 'h:mm a');
}

/**
 * Format an ISO datetime string to a relative time string.
 * @example formatRelativeTime('2025-03-15T10:30:00Z') => '2 hours ago'
 */
export function formatRelativeTime(isoString: string): string {
  const date = parseISO(isoString);
  if (!isValid(date)) return 'Unknown';
  return formatDistanceToNow(date, { addSuffix: true });
}

// ---------------------------------------------------------------------------
// Vital Sign Formatters
// ---------------------------------------------------------------------------

interface VitalFormatOptions {
  value: number;
  unit: string;
  decimals?: number;
}

/**
 * Format a vital sign value with its unit.
 * @example formatVitalSign({ value: 72, unit: 'bpm' }) => '72 bpm'
 */
export function formatVitalSign({ value, unit, decimals = 0 }: VitalFormatOptions): string {
  return `${value.toFixed(decimals)} ${unit}`;
}

/**
 * Format heart rate with bpm unit.
 */
export function formatHeartRate(bpm: number): string {
  return formatVitalSign({ value: bpm, unit: 'bpm' });
}

/**
 * Format SpO2 percentage.
 */
export function formatSpO2(percent: number): string {
  return formatVitalSign({ value: percent, unit: '%', decimals: 0 });
}

/**
 * Format HRV in milliseconds.
 */
export function formatHRV(ms: number): string {
  return formatVitalSign({ value: ms, unit: 'ms', decimals: 1 });
}

/**
 * Format blood pressure as systolic/diastolic.
 */
export function formatBloodPressure(systolic: number, diastolic: number): string {
  return `${Math.round(systolic)}/${Math.round(diastolic)} mmHg`;
}

/**
 * Format temperature in Celsius.
 */
export function formatTemperature(celsius: number): string {
  return formatVitalSign({ value: celsius, unit: '\u00B0C', decimals: 1 });
}

// ---------------------------------------------------------------------------
// Urgency Level Formatter
// ---------------------------------------------------------------------------

const urgencyLabels: Record<UrgencyLevel, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  critical: 'Critical',
  emergency: 'Emergency',
};

const urgencyColors: Record<UrgencyLevel, string> = {
  low: 'text-urgency-low',
  moderate: 'text-urgency-moderate',
  high: 'text-urgency-high',
  critical: 'text-urgency-critical',
  emergency: 'text-urgency-emergency',
};

/**
 * Get the display label for an urgency level.
 */
export function formatUrgencyLevel(level: UrgencyLevel): string {
  return urgencyLabels[level] ?? level;
}

/**
 * Get the Tailwind text color class for an urgency level.
 */
export function getUrgencyColorClass(level: UrgencyLevel): string {
  return urgencyColors[level] ?? 'text-slate-500';
}

// ---------------------------------------------------------------------------
// Number / Currency Formatters
// ---------------------------------------------------------------------------

/**
 * Format a number as currency with locale support.
 * @example formatCurrency(1500, 'UZS') => 'UZS 1,500'
 */
export function formatCurrency(
  amount: number,
  currency = 'USD',
  locale = 'en-US',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a large number with abbreviation.
 * @example formatCompactNumber(1500000) => '1.5M'
 */
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Format a percentage with specified decimal places.
 * @example formatPercentage(0.852) => '85.2%'
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format a confidence score as a percentage.
 * @example formatConfidence(0.94) => '94%'
 */
export function formatConfidence(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Format duration in minutes to a human-readable string.
 * @example formatDuration(95) => '1h 35m'
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}
