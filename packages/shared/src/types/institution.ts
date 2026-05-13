// ---------------------------------------------------------------------------
// Hospital / Institution Domain Types
// ---------------------------------------------------------------------------

export type InstitutionId = string;

/**
 * Institution category within the Central Asian healthcare hierarchy.
 */
export type InstitutionType =
  | 'primary_care_clinic'
  | 'polyclinic'
  | 'district_hospital'
  | 'regional_hospital'
  | 'national_referral_center'
  | 'specialized_center'
  | 'maternity_hospital'
  | 'rehabilitation_center'
  | 'diagnostic_center'
  | 'pharmacy'
  | 'telemedicine_hub';

/**
 * Operational status of the institution.
 */
export type InstitutionStatus = 'operational' | 'limited_capacity' | 'emergency_only' | 'temporarily_closed' | 'under_construction';

/**
 * Bed availability breakdown by ward type.
 */
export interface BedCapacity {
  ward_type: 'general' | 'icu' | 'pediatric' | 'maternity' | 'surgical' | 'psychiatric' | 'isolation';
  total_beds: number;
  occupied_beds: number;
  available_beds: number;
  reserved_beds: number;
}

/**
 * Department within an institution.
 */
export interface Department {
  id: string;
  name: string;
  specialty: string;
  head_doctor_id?: string;
  floor?: string;
  phone?: string;
  is_active: boolean;
}

/**
 * Equipment or facility capability.
 */
export interface InstitutionCapability {
  category: 'imaging' | 'laboratory' | 'surgical' | 'therapeutic' | 'diagnostic' | 'emergency' | 'pharmacy';
  name: string;
  description?: string;
  available: boolean;
  operational_hours?: string; // e.g. "24/7" or "08:00-18:00"
}

/**
 * Geographic and address information for an institution.
 */
export interface InstitutionAddress {
  street: string;
  city: string;
  district?: string;
  region: string;
  postal_code?: string;
  country: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Real-time operational metrics for an institution.
 */
export interface InstitutionMetrics {
  current_patient_count: number;
  emergency_queue_length: number;
  average_wait_time_minutes: number;
  bed_occupancy_rate: number; // 0-1
  staff_on_duty: number;
  ambulances_available: number;
  last_updated: string; // ISO 8601 datetime
}

/**
 * Full institution record.
 */
export interface Institution {
  id: InstitutionId;
  name: string;
  type: InstitutionType;
  status: InstitutionStatus;
  address: InstitutionAddress;
  phone: string;
  email?: string;
  website?: string;
  departments: Department[];
  bed_capacity: BedCapacity[];
  capabilities: InstitutionCapability[];
  metrics?: InstitutionMetrics;
  accreditation_level?: string;
  accreditation_expiry?: string; // ISO 8601 date
  operating_hours: string; // e.g. "24/7" or "Mon-Fri 08:00-20:00"
  emergency_services: boolean;
  helipad_available: boolean;
  languages_supported: string[];
  created_at: string; // ISO 8601 datetime
  updated_at: string; // ISO 8601 datetime
}

/**
 * Lightweight institution summary for search results and maps.
 */
export interface InstitutionSummary {
  id: InstitutionId;
  name: string;
  type: InstitutionType;
  status: InstitutionStatus;
  city: string;
  region: string;
  coordinates: { latitude: number; longitude: number };
  emergency_services: boolean;
  bed_occupancy_rate?: number;
  average_wait_time_minutes?: number;
  distance_km?: number; // calculated relative to user location
}

/**
 * Parameters for searching / filtering institutions.
 */
export interface InstitutionSearchParams {
  query?: string;
  type?: InstitutionType;
  status?: InstitutionStatus;
  region?: string;
  city?: string;
  capability?: string;
  emergency_only?: boolean;
  max_distance_km?: number;
  user_latitude?: number;
  user_longitude?: number;
  page?: number;
  page_size?: number;
  sort_by?: 'name' | 'distance' | 'wait_time' | 'bed_availability';
  sort_order?: 'asc' | 'desc';
}
