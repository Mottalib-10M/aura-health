// ---------------------------------------------------------------------------
// @uzavita/shared - Constants
// ---------------------------------------------------------------------------

import type { UrgencyLevel } from '../types/triage';
import type { MedicalSpecialty } from '../types/doctor';
import type { UserRole } from '../types/auth';
import type { AITask, TaskComplexity, ModelProvider } from '../types/ai-router';
import type { OutbreakAlertLevel } from '../types/surveillance';
import type { InstitutionType } from '../types/institution';

// ---- Urgency Levels ---------------------------------------------------------

export const URGENCY_LEVELS: readonly UrgencyLevel[] = [
  'low',
  'moderate',
  'high',
  'critical',
  'emergency',
] as const;

export const URGENCY_LEVEL_CONFIG: Record<
  UrgencyLevel,
  { label: string; color: string; maxWaitMinutes: number; priority: number }
> = {
  low: { label: 'Low', color: '#4CAF50', maxWaitMinutes: 240, priority: 5 },
  moderate: { label: 'Moderate', color: '#FF9800', maxWaitMinutes: 120, priority: 4 },
  high: { label: 'High', color: '#F44336', maxWaitMinutes: 60, priority: 3 },
  critical: { label: 'Critical', color: '#9C27B0', maxWaitMinutes: 15, priority: 2 },
  emergency: { label: 'Emergency', color: '#D50000', maxWaitMinutes: 0, priority: 1 },
} as const;

// ---- Medical Specialties ----------------------------------------------------

export const MEDICAL_SPECIALTIES: readonly MedicalSpecialty[] = [
  'general_practice',
  'cardiology',
  'neurology',
  'pulmonology',
  'gastroenterology',
  'endocrinology',
  'nephrology',
  'oncology',
  'pediatrics',
  'obstetrics_gynecology',
  'orthopedics',
  'dermatology',
  'ophthalmology',
  'otolaryngology',
  'psychiatry',
  'urology',
  'emergency_medicine',
  'surgery_general',
  'surgery_cardiac',
  'surgery_neuro',
  'radiology',
  'pathology',
  'anesthesiology',
  'infectious_disease',
  'rheumatology',
  'hematology',
  'allergy_immunology',
  'physical_rehabilitation',
  'palliative_care',
] as const;

export const SPECIALTY_LABELS: Record<MedicalSpecialty, string> = {
  general_practice: 'General Practice',
  cardiology: 'Cardiology',
  neurology: 'Neurology',
  pulmonology: 'Pulmonology',
  gastroenterology: 'Gastroenterology',
  endocrinology: 'Endocrinology',
  nephrology: 'Nephrology',
  oncology: 'Oncology',
  pediatrics: 'Pediatrics',
  obstetrics_gynecology: 'Obstetrics & Gynecology',
  orthopedics: 'Orthopedics',
  dermatology: 'Dermatology',
  ophthalmology: 'Ophthalmology',
  otolaryngology: 'Otolaryngology (ENT)',
  psychiatry: 'Psychiatry',
  urology: 'Urology',
  emergency_medicine: 'Emergency Medicine',
  surgery_general: 'General Surgery',
  surgery_cardiac: 'Cardiac Surgery',
  surgery_neuro: 'Neurosurgery',
  radiology: 'Radiology',
  pathology: 'Pathology',
  anesthesiology: 'Anesthesiology',
  infectious_disease: 'Infectious Disease',
  rheumatology: 'Rheumatology',
  hematology: 'Hematology',
  allergy_immunology: 'Allergy & Immunology',
  physical_rehabilitation: 'Physical Rehabilitation',
  palliative_care: 'Palliative Care',
} as const;

// ---- Central Asian Regions --------------------------------------------------

export const CENTRAL_ASIAN_REGIONS = {
  // Kazakhstan
  KZ: [
    'Almaty',
    'Astana',
    'Shymkent',
    'Akmola',
    'Aktobe',
    'Almaty Region',
    'Atyrau',
    'East Kazakhstan',
    'Jambyl',
    'Karaganda',
    'Kostanay',
    'Kyzylorda',
    'Mangystau',
    'North Kazakhstan',
    'Pavlodar',
    'Turkistan',
    'West Kazakhstan',
    'Abai',
    'Jetisu',
    'Ulytau',
  ],
  // Uzbekistan
  UZ: [
    'Tashkent',
    'Tashkent Region',
    'Samarkand',
    'Bukhara',
    'Fergana',
    'Andijan',
    'Namangan',
    'Kashkadarya',
    'Surkhandarya',
    'Khorezm',
    'Navoi',
    'Jizzakh',
    'Syrdarya',
    'Karakalpakstan',
  ],
  // Kyrgyzstan
  KG: [
    'Bishkek',
    'Osh',
    'Chuy',
    'Issyk-Kul',
    'Naryn',
    'Jalal-Abad',
    'Batken',
    'Talas',
    'Osh Region',
  ],
  // Tajikistan
  TJ: [
    'Dushanbe',
    'Sughd',
    'Khatlon',
    'GBAO',
    'Districts of Republican Subordination',
  ],
  // Turkmenistan
  TM: [
    'Ashgabat',
    'Ahal',
    'Balkan',
    'Dashoguz',
    'Lebap',
    'Mary',
  ],
} as const;

export type CountryCode = keyof typeof CENTRAL_ASIAN_REGIONS;

export const COUNTRY_NAMES: Record<CountryCode, string> = {
  KZ: 'Kazakhstan',
  UZ: 'Uzbekistan',
  KG: 'Kyrgyzstan',
  TJ: 'Tajikistan',
  TM: 'Turkmenistan',
} as const;

/**
 * Flat list of all supported regions for validation.
 */
export const ALL_REGIONS: readonly string[] = Object.values(CENTRAL_ASIAN_REGIONS).flat();

// ---- Supported Languages ----------------------------------------------------

export const SUPPORTED_LANGUAGES = [
  { code: 'kk', name: 'Kazakh', nativeName: 'Qazaq tili' },
  { code: 'uz', name: 'Uzbek', nativeName: 'O\'zbek tili' },
  { code: 'ky', name: 'Kyrgyz', nativeName: 'Kyrgyz tili' },
  { code: 'tg', name: 'Tajik', nativeName: 'Zaboni tojiki' },
  { code: 'tk', name: 'Turkmen', nativeName: 'Turkmen dili' },
  { code: 'ru', name: 'Russian', nativeName: 'Russkiy yazyk' },
  { code: 'en', name: 'English', nativeName: 'English' },
] as const;

export const DEFAULT_LANGUAGE = 'ru' as const;

// ---- User Roles -------------------------------------------------------------

export const USER_ROLES: readonly UserRole[] = [
  'patient',
  'doctor',
  'nurse',
  'pharmacist',
  'lab_technician',
  'admin',
  'institution_admin',
  'regional_health_officer',
  'epidemiologist',
  'system_admin',
  'auditor',
] as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  patient: 'Patient',
  doctor: 'Doctor',
  nurse: 'Nurse',
  pharmacist: 'Pharmacist',
  lab_technician: 'Lab Technician',
  admin: 'Administrator',
  institution_admin: 'Institution Admin',
  regional_health_officer: 'Regional Health Officer',
  epidemiologist: 'Epidemiologist',
  system_admin: 'System Administrator',
  auditor: 'Auditor',
} as const;

/**
 * Role hierarchy for permission inheritance. Higher-index roles inherit
 * permissions from lower-index roles within the same branch.
 */
export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  patient: [],
  doctor: [],
  nurse: [],
  pharmacist: [],
  lab_technician: [],
  admin: ['doctor', 'nurse', 'pharmacist', 'lab_technician'],
  institution_admin: ['admin'],
  regional_health_officer: ['institution_admin', 'epidemiologist'],
  epidemiologist: [],
  system_admin: ['regional_health_officer'],
  auditor: [],
} as const;

// ---- AI Router Constants ----------------------------------------------------

export const AI_TASKS: readonly AITask[] = [
  'triage',
  'longitudinal',
  'vision_ocr',
  'forecasting',
] as const;

export const TASK_COMPLEXITIES: readonly TaskComplexity[] = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export const MODEL_PROVIDERS: readonly ModelProvider[] = [
  'openai',
  'anthropic',
  'google',
  'local_llama',
  'local_mistral',
  'azure_openai',
  'custom',
] as const;

/**
 * Default latency requirements (ms) by task type.
 */
export const DEFAULT_LATENCY_REQUIREMENTS: Record<AITask, number> = {
  triage: 3000,
  longitudinal: 10000,
  vision_ocr: 5000,
  forecasting: 15000,
} as const;

/**
 * PHI exposure flags by default for each task type.
 */
export const DEFAULT_PHI_EXPOSURE: Record<AITask, boolean> = {
  triage: true,
  longitudinal: true,
  vision_ocr: true,
  forecasting: false,
} as const;

// ---- Outbreak Alert Levels --------------------------------------------------

export const OUTBREAK_ALERT_LEVELS: readonly OutbreakAlertLevel[] = [
  'watch',
  'warning',
  'alert',
  'emergency',
  'pandemic',
] as const;

export const ALERT_LEVEL_CONFIG: Record<
  OutbreakAlertLevel,
  { label: string; color: string; notifyWho: boolean; priority: number }
> = {
  watch: { label: 'Watch', color: '#2196F3', notifyWho: false, priority: 5 },
  warning: { label: 'Warning', color: '#FF9800', notifyWho: false, priority: 4 },
  alert: { label: 'Alert', color: '#F44336', notifyWho: true, priority: 3 },
  emergency: { label: 'Emergency', color: '#9C27B0', notifyWho: true, priority: 2 },
  pandemic: { label: 'Pandemic', color: '#D50000', notifyWho: true, priority: 1 },
} as const;

// ---- Institution Types ------------------------------------------------------

export const INSTITUTION_TYPES: readonly InstitutionType[] = [
  'primary_care_clinic',
  'polyclinic',
  'district_hospital',
  'regional_hospital',
  'national_referral_center',
  'specialized_center',
  'maternity_hospital',
  'rehabilitation_center',
  'diagnostic_center',
  'pharmacy',
  'telemedicine_hub',
] as const;

export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  primary_care_clinic: 'Primary Care Clinic',
  polyclinic: 'Polyclinic',
  district_hospital: 'District Hospital',
  regional_hospital: 'Regional Hospital',
  national_referral_center: 'National Referral Center',
  specialized_center: 'Specialized Center',
  maternity_hospital: 'Maternity Hospital',
  rehabilitation_center: 'Rehabilitation Center',
  diagnostic_center: 'Diagnostic Center',
  pharmacy: 'Pharmacy',
  telemedicine_hub: 'Telemedicine Hub',
} as const;

// ---- Pagination Defaults ----------------------------------------------------

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 1,
} as const;

// ---- Vital Signs Reference Ranges -------------------------------------------

export const VITAL_SIGNS_RANGES = {
  heart_rate_bpm: { min: 40, max: 200, normalMin: 60, normalMax: 100 },
  systolic_bp: { min: 60, max: 250, normalMin: 90, normalMax: 140 },
  diastolic_bp: { min: 30, max: 150, normalMin: 60, normalMax: 90 },
  temperature_celsius: { min: 34.0, max: 42.0, normalMin: 36.1, normalMax: 37.2 },
  spO2_percent: { min: 50, max: 100, normalMin: 95, normalMax: 100 },
  respiratory_rate: { min: 6, max: 60, normalMin: 12, normalMax: 20 },
} as const;

// ---- Session & Security -----------------------------------------------------

export const AUTH = {
  ACCESS_TOKEN_EXPIRY_SECONDS: 900, // 15 minutes
  REFRESH_TOKEN_EXPIRY_SECONDS: 604800, // 7 days
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_SECONDS: 1800, // 30 minutes
  MFA_CODE_LENGTH: 6,
  MFA_CODE_EXPIRY_SECONDS: 300, // 5 minutes
  SESSION_INACTIVITY_TIMEOUT_SECONDS: 1800, // 30 minutes
  WEBAUTHN_CHALLENGE_TIMEOUT_MS: 60000, // 1 minute
  BIOMETRIC_MAX_ATTEMPTS: 3,
  PASSWORD_MIN_LENGTH: 12,
  PASSWORD_MAX_LENGTH: 128,
} as const;

// ---- API Versioning ---------------------------------------------------------

export const API = {
  CURRENT_VERSION: 'v2',
  SUPPORTED_VERSIONS: ['v1', 'v2'] as const,
  BASE_PATH: '/api',
} as const;
