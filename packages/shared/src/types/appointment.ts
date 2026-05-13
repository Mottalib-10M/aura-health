// ---------------------------------------------------------------------------
// Appointment Domain Types
// ---------------------------------------------------------------------------

import type { PatientId } from './patient';
import type { DoctorId } from './doctor';

export type AppointmentId = string;

/**
 * Appointment modality.
 */
export type AppointmentType = 'in_person' | 'telemedicine' | 'home_visit';

/**
 * Appointment lifecycle status.
 */
export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'rescheduled';

/**
 * Priority level for appointment scheduling, typically derived from triage.
 */
export type AppointmentPriority = 'routine' | 'urgent' | 'emergency';

/**
 * A single available time slot offered by a doctor.
 */
export interface TimeSlot {
  start: string; // ISO 8601 datetime
  end: string; // ISO 8601 datetime
  is_available: boolean;
  slot_type?: 'regular' | 'overflow' | 'emergency_reserve';
}

/**
 * Cancellation record with reason tracking.
 */
export interface CancellationRecord {
  cancelled_by: 'patient' | 'doctor' | 'system';
  reason: string;
  cancelled_at: string; // ISO 8601 datetime
  rescheduled_to?: AppointmentId;
}

/**
 * Appointment notes and clinical documentation.
 */
export interface AppointmentNotes {
  chief_complaint?: string;
  clinical_notes?: string;
  diagnosis_codes?: string[]; // ICD-10
  procedures_performed?: string[];
  prescriptions_issued?: string[]; // prescription IDs
  follow_up_required: boolean;
  follow_up_notes?: string;
}

/**
 * Full appointment record.
 */
export interface Appointment {
  id: AppointmentId;
  patient_id: PatientId;
  doctor_id: DoctorId;
  institution_id: string;
  triage_session_id?: string;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  priority: AppointmentPriority;
  scheduled_start: string; // ISO 8601 datetime
  scheduled_end: string; // ISO 8601 datetime
  actual_start?: string; // ISO 8601 datetime
  actual_end?: string; // ISO 8601 datetime
  reason_for_visit: string;
  notes?: AppointmentNotes;
  cancellation?: CancellationRecord;
  telemedicine_link?: string;
  room_number?: string;
  reminders_sent: number;
  created_at: string; // ISO 8601 datetime
  updated_at: string; // ISO 8601 datetime
}

/**
 * Lightweight appointment summary for calendar views.
 */
export interface AppointmentSummary {
  id: AppointmentId;
  patient_id: PatientId;
  patient_name: string;
  doctor_id: DoctorId;
  doctor_name: string;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  priority: AppointmentPriority;
  scheduled_start: string;
  scheduled_end: string;
  reason_for_visit: string;
}

/**
 * Request payload for creating a new appointment.
 */
export interface CreateAppointmentRequest {
  patient_id: PatientId;
  doctor_id: DoctorId;
  institution_id: string;
  triage_session_id?: string;
  appointment_type: AppointmentType;
  priority: AppointmentPriority;
  scheduled_start: string;
  scheduled_end: string;
  reason_for_visit: string;
  telemedicine_link?: string;
  room_number?: string;
}

/**
 * Request payload for rescheduling an appointment.
 */
export interface RescheduleAppointmentRequest {
  appointment_id: AppointmentId;
  new_start: string;
  new_end: string;
  reason: string;
}

/**
 * Parameters for querying appointments.
 */
export interface AppointmentSearchParams {
  patient_id?: PatientId;
  doctor_id?: DoctorId;
  institution_id?: string;
  status?: AppointmentStatus;
  appointment_type?: AppointmentType;
  priority?: AppointmentPriority;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
  sort_by?: 'scheduled_start' | 'status' | 'priority';
  sort_order?: 'asc' | 'desc';
}
