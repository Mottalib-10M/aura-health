// ---------------------------------------------------------------------------
// Epidemiological Surveillance Domain Types
// ---------------------------------------------------------------------------

// ---- Outbreak ---------------------------------------------------------------

/**
 * Alert level for disease outbreaks, aligned with WHO IHR classifications.
 */
export type OutbreakAlertLevel = 'watch' | 'warning' | 'alert' | 'emergency' | 'pandemic';

/**
 * Status of an outbreak tracking record.
 */
export type OutbreakStatus = 'suspected' | 'confirmed' | 'contained' | 'resolved';

/**
 * A geographic cluster of cases associated with an outbreak.
 */
export interface OutbreakCluster {
  region: string;
  city: string;
  case_count: number;
  first_case_date: string; // ISO 8601 date
  latest_case_date: string; // ISO 8601 date
  growth_rate: number; // daily percentage
  coordinates?: { latitude: number; longitude: number };
}

/**
 * Full outbreak record tracked by the epidemiological surveillance module.
 */
export interface OutbreakRecord {
  id: string;
  disease_name: string;
  icd10_code?: string;
  pathogen_type?: 'bacterial' | 'viral' | 'fungal' | 'parasitic' | 'prion' | 'unknown';
  alert_level: OutbreakAlertLevel;
  status: OutbreakStatus;
  total_cases: number;
  total_deaths: number;
  case_fatality_rate: number; // 0-1
  reproductive_number?: number; // R0 or Rt
  clusters: OutbreakCluster[];
  affected_regions: string[];
  containment_measures: string[];
  reporting_institutions: string[]; // institution IDs
  first_reported: string; // ISO 8601 date
  last_updated: string; // ISO 8601 datetime
  who_notified: boolean;
  notes?: string;
}

/**
 * Summary for outbreak dashboards.
 */
export interface OutbreakSummary {
  id: string;
  disease_name: string;
  alert_level: OutbreakAlertLevel;
  status: OutbreakStatus;
  total_cases: number;
  affected_regions_count: number;
  growth_rate: number;
  last_updated: string;
}

// ---- Case Reporting ---------------------------------------------------------

/**
 * Individual case report for a notifiable disease.
 */
export interface DiseaseCase {
  id: string;
  outbreak_id?: string;
  patient_id: string;
  disease_name: string;
  icd10_code: string;
  diagnosis_date: string; // ISO 8601 date
  symptom_onset_date?: string;
  confirmation_method: 'clinical' | 'laboratory' | 'epidemiological_link';
  laboratory_results?: {
    test_type: string;
    result: 'positive' | 'negative' | 'inconclusive';
    test_date: string;
    laboratory_id?: string;
  };
  hospitalized: boolean;
  icu_admission: boolean;
  outcome?: 'recovering' | 'recovered' | 'deceased' | 'unknown';
  reporting_institution_id: string;
  reporting_doctor_id: string;
  region: string;
  city: string;
  reported_at: string; // ISO 8601 datetime
}

// ---- Supply Forecast --------------------------------------------------------

/**
 * Demand forecasting model type.
 */
export type ForecastModel = 'arima' | 'prophet' | 'lstm';

/**
 * A single month's demand prediction.
 */
export interface DemandPrediction {
  month: string; // YYYY-MM
  units: number;
  confidence: number; // 0-1
}

/**
 * Pharmaceutical supply forecast combining inventory data, demand projections,
 * and risk assessment.
 */
export interface SupplyForecast {
  pharmaceutical_id: string;
  current_stock: {
    units: number;
    days_of_supply_remaining: number;
    warehouse_distribution: Record<string, number>;
  };
  demand_forecast: {
    model: ForecastModel;
    horizon_months: number;
    predictions: DemandPrediction[];
  };
  risk_assessment: {
    stockout_probability: number; // 0-1
    criticality_score: number; // 0-10
    alternative_availability: boolean;
  };
  recommended_orders: Array<{
    supplier: string;
    quantity: number;
    order_date: string; // ISO 8601 date
    estimated_delivery: string; // ISO 8601 date
  }>;
}

/**
 * Regional supply status for a pharmaceutical item.
 */
export interface RegionalSupplyStatus {
  pharmaceutical_id: string;
  drug_name: string;
  region: string;
  stock_level: 'adequate' | 'low' | 'critical' | 'stockout';
  days_remaining: number;
  forecast?: SupplyForecast;
  last_updated: string; // ISO 8601 datetime
}

// ---- Surveillance Query Params ----------------------------------------------

/**
 * Parameters for querying outbreak records.
 */
export interface OutbreakSearchParams {
  disease_name?: string;
  alert_level?: OutbreakAlertLevel;
  status?: OutbreakStatus;
  region?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
  sort_by?: 'alert_level' | 'total_cases' | 'last_updated';
  sort_order?: 'asc' | 'desc';
}

/**
 * Parameters for querying supply forecasts.
 */
export interface SupplyForecastParams {
  pharmaceutical_id?: string;
  region?: string;
  stock_level?: 'adequate' | 'low' | 'critical' | 'stockout';
  min_criticality_score?: number;
  page?: number;
  page_size?: number;
}
