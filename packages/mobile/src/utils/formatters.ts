/**
 * Mobile Formatting Utilities & Design Tokens
 *
 * Centralizes color palette, spacing, typography, and formatting functions
 * for the Aura Health design system. All visual constants derive from
 * these tokens to ensure consistency across the application.
 */

import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import type { UrgencyLevel } from '@aura/shared/types/triage';

// ---------------------------------------------------------------------------
// Color Palette - Aura Health Design System
// ---------------------------------------------------------------------------

export const Colors = {
  /** Primary teal - used for primary actions, links, and active states */
  primary: '#0D9488',
  primaryLight: '#14B8A6',
  primaryDark: '#0F766E',
  primaryFaded: 'rgba(13, 148, 136, 0.12)',

  /** Dark blue - used for headings, navbar, emphasis text */
  darkBlue: '#1E3A5F',
  darkBlueFaded: 'rgba(30, 58, 95, 0.08)',

  /** Background colors */
  background: '#FAFAFA',
  white: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',

  /** Text hierarchy */
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',

  /** Urgency & alert colors */
  urgencyLow: '#22C55E',
  urgencyModerate: '#F59E0B',
  urgencyHigh: '#F97316',
  urgencyCritical: '#EF4444',
  urgencyEmergency: '#9333EA',

  /** Semantic colors */
  success: '#22C55E',
  successLight: '#DCFCE7',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  /** Neutral palette */
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',

  /** Utility */
  border: '#E2E8F0',
  divider: '#F1F5F9',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  skeleton: '#E2E8F0',

  /** Chart palette */
  chartHeartRate: '#EF4444',
  chartSpO2: '#3B82F6',
  chartHRV: '#8B5CF6',
  chartSleep: '#6366F1',
  chartSteps: '#22C55E',
  chartDeepSleep: '#312E81',
  chartLightSleep: '#818CF8',
  chartREM: '#A78BFA',
  chartAwake: '#F59E0B',
} as const;

// ---------------------------------------------------------------------------
// Spacing Scale (4px base unit)
// ---------------------------------------------------------------------------

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
  section: 48,
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const Typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
  h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  h4: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMedium: { fontSize: 16, fontWeight: '500' as const, lineHeight: 24 },
  bodySm: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodySmMedium: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  captionMedium: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  overline: { fontSize: 10, fontWeight: '600' as const, lineHeight: 14, letterSpacing: 1 },
  button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
  buttonSm: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
} as const;

// ---------------------------------------------------------------------------
// Border Radius
// ---------------------------------------------------------------------------

export const Radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

// ---------------------------------------------------------------------------
// Shadows
// ---------------------------------------------------------------------------

export const Shadows = {
  sm: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  xl: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// ---------------------------------------------------------------------------
// Urgency Level Utilities
// ---------------------------------------------------------------------------

export const urgencyColorMap: Record<UrgencyLevel, string> = {
  low: Colors.urgencyLow,
  moderate: Colors.urgencyModerate,
  high: Colors.urgencyHigh,
  critical: Colors.urgencyCritical,
  emergency: Colors.urgencyEmergency,
};

export const urgencyBackgroundMap: Record<UrgencyLevel, string> = {
  low: '#DCFCE7',
  moderate: '#FEF3C7',
  high: '#FFEDD5',
  critical: '#FEE2E2',
  emergency: '#F3E8FF',
};

export const urgencyLabelMap: Record<UrgencyLevel, string> = {
  low: 'Low Urgency',
  moderate: 'Moderate',
  high: 'High',
  critical: 'Critical',
  emergency: 'Emergency',
};

/**
 * Returns the display color for a given urgency level.
 */
export function getUrgencyColor(level: UrgencyLevel): string {
  return urgencyColorMap[level];
}

/**
 * Returns the background color for a given urgency level badge.
 */
export function getUrgencyBackground(level: UrgencyLevel): string {
  return urgencyBackgroundMap[level];
}

// ---------------------------------------------------------------------------
// Date & Time Formatting
// ---------------------------------------------------------------------------

/**
 * Formats an ISO 8601 date string for display.
 * Returns "Invalid date" for unparseable inputs.
 */
export function formatDate(isoDate: string, pattern = 'MMM d, yyyy'): string {
  try {
    const date = parseISO(isoDate);
    if (!isValid(date)) return 'Invalid date';
    return format(date, pattern);
  } catch {
    return 'Invalid date';
  }
}

/**
 * Formats an ISO 8601 datetime for display with time.
 */
export function formatDateTime(isoDate: string): string {
  return formatDate(isoDate, 'MMM d, yyyy h:mm a');
}

/**
 * Formats a time string (e.g., from appointment).
 */
export function formatTime(isoDate: string): string {
  return formatDate(isoDate, 'h:mm a');
}

/**
 * Returns a human-readable relative time string (e.g., "2 hours ago").
 */
export function formatRelativeTime(isoDate: string): string {
  try {
    const date = parseISO(isoDate);
    if (!isValid(date)) return '';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Number & Health Data Formatting
// ---------------------------------------------------------------------------

/**
 * Formats a heart rate value with "bpm" suffix.
 */
export function formatHeartRate(bpm: number): string {
  return `${Math.round(bpm)} bpm`;
}

/**
 * Formats an SpO2 percentage value.
 */
export function formatSpO2(percent: number): string {
  return `${Math.round(percent)}%`;
}

/**
 * Formats a blood pressure reading.
 */
export function formatBloodPressure(systolic: number, diastolic: number): string {
  return `${Math.round(systolic)}/${Math.round(diastolic)} mmHg`;
}

/**
 * Formats a temperature value with unit.
 */
export function formatTemperature(celsius: number): string {
  return `${celsius.toFixed(1)}\u00B0C`;
}

/**
 * Formats a number with thousands separators.
 */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

/**
 * Formats a percentage (0-1 scale to display percentage).
 */
export function formatPercentage(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Formats a duration in minutes to a human-readable string.
 */
export function formatWaitTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// ---------------------------------------------------------------------------
// Phone Number Formatting
// ---------------------------------------------------------------------------

export interface CountryCode {
  code: string;
  dialCode: string;
  name: string;
  flag: string;
}

export const countryCodes: CountryCode[] = [
  { code: 'UZ', dialCode: '+998', name: 'Uzbekistan', flag: '\u{1F1FA}\u{1F1FF}' },
  { code: 'KG', dialCode: '+996', name: 'Kyrgyzstan', flag: '\u{1F1F0}\u{1F1EC}' },
  { code: 'TJ', dialCode: '+992', name: 'Tajikistan', flag: '\u{1F1F9}\u{1F1EF}' },
  { code: 'RU', dialCode: '+7', name: 'Russia', flag: '\u{1F1F7}\u{1F1FA}' },
  { code: 'KZ', dialCode: '+7', name: 'Kazakhstan', flag: '\u{1F1F0}\u{1F1FF}' },
];

/**
 * Formats a phone number with country code for display.
 */
export function formatPhoneNumber(phone: string, countryDialCode: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length <= 2) return `${countryDialCode} ${cleaned}`;
  if (cleaned.length <= 5) return `${countryDialCode} (${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  return `${countryDialCode} (${cleaned.slice(0, 2)}) ${cleaned.slice(2, 5)}-${cleaned.slice(5, 9)}`;
}

// ---------------------------------------------------------------------------
// Language Definitions
// ---------------------------------------------------------------------------

export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export const supportedLanguages: Language[] = [
  { code: 'uz', name: 'Uzbek', nativeName: "O'zbek" },
  { code: 'ky', name: 'Kyrgyz', nativeName: '\u041A\u044B\u0440\u0433\u044B\u0437' },
  { code: 'tg', name: 'Tajik', nativeName: '\u0422\u043E\u04B7\u0438\u043A\u04E3' },
  { code: 'ru', name: 'Russian', nativeName: '\u0420\u0443\u0441\u0441\u043A\u0438\u0439' },
  { code: 'en', name: 'English', nativeName: 'English' },
];

// ---------------------------------------------------------------------------
// Specialist Name Formatting
// ---------------------------------------------------------------------------

/**
 * Converts a medical specialty slug (e.g., "general_practice") into a
 * human-readable display name (e.g., "General Practice").
 */
export function formatSpecialtyName(specialty: string): string {
  return specialty
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
