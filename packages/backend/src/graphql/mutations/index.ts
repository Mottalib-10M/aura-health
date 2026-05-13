import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../../config/database.js';
import { requireAuth, requireRole, signToken, UserRole, type AuthenticatedUser } from '../../middleware/auth.js';
import { executeTriage } from '../../services/ai/triage-engine.js';
import { scheduleAppointment } from '../../modules/appointment/index.js';
import { logger } from '../../utils/logger.js';
import { generateCheckInCode } from '../../utils/crypto.js';
import { auditPrescriptionOutcome } from '../../services/blockchain/index.js';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface GraphQLContext {
  user?: AuthenticatedUser;
}

// ---------------------------------------------------------------------------
// Input types (mirrors SDL inputs)
// ---------------------------------------------------------------------------
interface SymptomTriageInput {
  patientId: string;
  symptoms: string[];
  symptomDescription: string;
  duration?: string;
  severity?: number;
  vitalSigns?: {
    heartRate?: number;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    temperature?: number;
    respiratoryRate?: number;
    spO2?: number;
  };
  language?: string;
}

interface CreateAppointmentInput {
  patientId: string;
  doctorId?: string;
  institutionId?: string;
  specialty: string;
  preferredDate?: string;
  preferredTimeStart?: string;
  preferredTimeEnd?: string;
  urgencyLevel?: string;
  reason?: string;
}

interface RecordPrescriptionOutcomeInput {
  prescriptionId: string;
  outcomeAssessment: string;
  efficacyScore: number;
  sideEffectsReported?: string[];
  followUpRequired?: boolean;
}

interface RegisterPatientInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodType?: string;
  region: string;
  city: string;
  language?: string;
  phone?: string;
  email?: string;
}

interface RegisterDoctorInput {
  firstName: string;
  lastName: string;
  licenseNumber: string;
  specialty: string;
  subspecialty?: string;
  institutionId?: string;
  region: string;
  languages: string[];
  credentialDocumentUrl?: string;
}

interface UpdateVerificationStatusInput {
  doctorId: string;
  status: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Mutation resolvers
// ---------------------------------------------------------------------------
export const mutationResolvers = {
  Mutation: {
    // ── Symptom Triage ────────────────────────────────────────────────
    async submitSymptomTriage(
      _: unknown,
      { input }: { input: SymptomTriageInput },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx.user);
      logger.info({ patientId: input.patientId }, 'Symptom triage requested');

      const startTime = performance.now();

      // Execute AI triage pipeline
      const triageResult = await executeTriage({
        patientId: input.patientId,
        symptoms: input.symptoms,
        symptomDescription: input.symptomDescription,
        duration: input.duration,
        severity: input.severity,
        vitalSigns: input.vitalSigns,
        language: input.language ?? 'en',
      });

      const latencyMs = Math.round(performance.now() - startTime);

      // Persist triage event
      const triageEventId = uuidv4();
      await query(
        `INSERT INTO triage_events (
          id, patient_id, symptoms, symptom_description,
          urgency_level, confidence_score,
          recommended_specializations, red_flags,
          suggested_diagnostics, differential_diagnoses,
          model_used, response_latency_ms, follow_up_scheduled,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
        [
          triageEventId,
          input.patientId,
          JSON.stringify(input.symptoms),
          input.symptomDescription,
          triageResult.urgencyLevel,
          triageResult.confidenceScore,
          JSON.stringify(triageResult.recommendedSpecializations),
          JSON.stringify(triageResult.redFlags),
          JSON.stringify(triageResult.suggestedDiagnostics),
          JSON.stringify(triageResult.differentialDiagnoses),
          triageResult.modelUsed,
          latencyMs,
          triageResult.followUpRecommended,
        ],
      );

      logger.info(
        { triageEventId, urgency: triageResult.urgencyLevel, latencyMs },
        'Triage event persisted',
      );

      return {
        triageEventId,
        urgencyLevel: triageResult.urgencyLevel,
        confidenceScore: triageResult.confidenceScore,
        recommendedSpecializations: triageResult.recommendedSpecializations,
        redFlags: triageResult.redFlags,
        suggestedDiagnostics: triageResult.suggestedDiagnostics,
        differentialDiagnoses: triageResult.differentialDiagnoses,
        patientGuidance: triageResult.patientGuidance,
        followUpRecommended: triageResult.followUpRecommended,
        modelUsed: triageResult.modelUsed,
        responseLatencyMs: latencyMs,
      };
    },

    // ── Create Appointment ────────────────────────────────────────────
    async createAppointment(
      _: unknown,
      { input }: { input: CreateAppointmentInput },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx.user);
      logger.info({ patientId: input.patientId, specialty: input.specialty }, 'Appointment creation requested');

      const result = await scheduleAppointment({
        patientId: input.patientId,
        doctorId: input.doctorId,
        institutionId: input.institutionId,
        specialty: input.specialty,
        preferredDate: input.preferredDate,
        preferredTimeStart: input.preferredTimeStart,
        preferredTimeEnd: input.preferredTimeEnd,
        urgencyLevel: input.urgencyLevel ?? 'NON_URGENT',
        reason: input.reason,
      });

      return result;
    },

    // ── Cancel Appointment ────────────────────────────────────────────
    async cancelAppointment(
      _: unknown,
      { appointmentId, reason }: { appointmentId: string; reason?: string },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx.user);

      const result = await query(
        `UPDATE appointments
         SET status = 'CANCELLED', notes = COALESCE(notes || E'\\n', '') || $2, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [appointmentId, reason ? `Cancelled: ${reason}` : 'Cancelled by user'],
      );

      if (result.rows.length === 0) {
        throw new Error('Appointment not found');
      }

      logger.info({ appointmentId }, 'Appointment cancelled');
      return mapAppointmentRow(result.rows[0]);
    },

    // ── Check-In Appointment ──────────────────────────────────────────
    async checkInAppointment(
      _: unknown,
      { appointmentId, checkInCode }: { appointmentId: string; checkInCode: string },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx.user);

      const existing = await query(
        `SELECT * FROM appointments WHERE id = $1`,
        [appointmentId],
      );

      if (existing.rows.length === 0) {
        throw new Error('Appointment not found');
      }

      const appointment = existing.rows[0];

      if (appointment.check_in_code !== checkInCode) {
        throw new Error('Invalid check-in code');
      }

      if (appointment.status !== 'CONFIRMED' && appointment.status !== 'SCHEDULED') {
        throw new Error(`Cannot check in appointment with status: ${appointment.status}`);
      }

      const result = await query(
        `UPDATE appointments
         SET status = 'CHECKED_IN', updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [appointmentId],
      );

      logger.info({ appointmentId }, 'Patient checked in');
      return mapAppointmentRow(result.rows[0]);
    },

    // ── Record Prescription Outcome ───────────────────────────────────
    async recordPrescriptionOutcome(
      _: unknown,
      { input }: { input: RecordPrescriptionOutcomeInput },
      ctx: GraphQLContext,
    ) {
      requireRole(ctx.user, UserRole.DOCTOR, UserRole.SYSTEM_ADMIN);

      const result = await withTransaction(async (client) => {
        // Update prescription
        const updated = await client.query(
          `UPDATE prescriptions
           SET outcome_assessment = $2,
               efficacy_score = $3,
               side_effects_reported = $4,
               follow_up_date = CASE WHEN $5 THEN NOW() + INTERVAL '30 days' ELSE NULL END,
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [
            input.prescriptionId,
            input.outcomeAssessment,
            input.efficacyScore,
            JSON.stringify(input.sideEffectsReported ?? []),
            input.followUpRequired ?? false,
          ],
        );

        if (updated.rows.length === 0) {
          throw new Error('Prescription not found');
        }

        const prescription = updated.rows[0];

        // Update the doctor's aggregate efficacy score
        await client.query(
          `UPDATE doctors
           SET efficacy_score = (
             SELECT AVG(efficacy_score)
             FROM prescriptions
             WHERE doctor_id = $1 AND efficacy_score IS NOT NULL
           ),
           updated_at = NOW()
           WHERE id = $1`,
          [prescription.doctor_id],
        );

        return prescription;
      });

      // Audit to blockchain (non-blocking)
      auditPrescriptionOutcome({
        prescriptionId: input.prescriptionId,
        efficacyScore: input.efficacyScore,
        recordedBy: ctx.user!.id,
        timestamp: new Date().toISOString(),
      }).catch((err) => {
        logger.error({ err }, 'Blockchain audit failed for prescription outcome');
      });

      logger.info({ prescriptionId: input.prescriptionId }, 'Prescription outcome recorded');
      return mapPrescriptionRow(result);
    },

    // ── Register Patient ──────────────────────────────────────────────
    async registerPatient(
      _: unknown,
      { input }: { input: RegisterPatientInput },
    ) {
      const patientId = uuidv4();
      // Generate a unique Aura ID: AH-<region code>-<8 random chars>
      const regionCode = input.region.slice(0, 3).toUpperCase();
      const randomSuffix = Math.random().toString(36).slice(2, 10).toUpperCase();
      const auraId = `AH-${regionCode}-${randomSuffix}`;

      await query(
        `INSERT INTO patients (
          id, aura_id, first_name, last_name,
          date_of_birth, gender, blood_type,
          region, city, language,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
        [
          patientId,
          auraId,
          input.firstName,
          input.lastName,
          input.dateOfBirth,
          input.gender,
          input.bloodType ?? null,
          input.region,
          input.city,
          input.language ?? 'uz',
        ],
      );

      const token = signToken({ id: patientId, role: UserRole.PATIENT, auraId });

      logger.info({ patientId, auraId, region: input.region }, 'Patient registered');

      return {
        token,
        user: {
          id: patientId,
          role: 'PATIENT',
          auraId,
        },
      };
    },

    // ── Register Doctor ───────────────────────────────────────────────
    async registerDoctor(
      _: unknown,
      { input }: { input: RegisterDoctorInput },
    ) {
      // Check for duplicate license number
      const existing = await query(
        `SELECT id FROM doctors WHERE license_number = $1`,
        [input.licenseNumber],
      );

      if (existing.rows.length > 0) {
        throw new Error('A doctor with this license number is already registered');
      }

      const doctorId = uuidv4();

      await query(
        `INSERT INTO doctors (
          id, first_name, last_name, license_number,
          specialty, subspecialty, institution_id,
          verification_status, region, languages,
          consultation_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, $9, 0, NOW(), NOW())`,
        [
          doctorId,
          input.firstName,
          input.lastName,
          input.licenseNumber,
          input.specialty,
          input.subspecialty ?? null,
          input.institutionId ?? null,
          input.region,
          JSON.stringify(input.languages),
        ],
      );

      // If credential document URL is provided, store it for review
      if (input.credentialDocumentUrl) {
        await query(
          `INSERT INTO doctor_credentials (id, doctor_id, document_url, uploaded_at)
           VALUES ($1, $2, $3, NOW())`,
          [uuidv4(), doctorId, input.credentialDocumentUrl],
        );
      }

      const token = signToken({ id: doctorId, role: UserRole.DOCTOR });

      logger.info({ doctorId, specialty: input.specialty, region: input.region }, 'Doctor registered');

      return {
        token,
        user: {
          id: doctorId,
          role: 'DOCTOR',
          auraId: null,
        },
      };
    },

    // ── Update Verification Status (Admin) ────────────────────────────
    async updateVerificationStatus(
      _: unknown,
      { input }: { input: UpdateVerificationStatusInput },
      ctx: GraphQLContext,
    ) {
      requireRole(ctx.user, UserRole.SYSTEM_ADMIN, UserRole.HOSPITAL_ADMIN);

      const validStatuses = ['PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED'];
      if (!validStatuses.includes(input.status)) {
        throw new Error(`Invalid verification status: ${input.status}`);
      }

      const result = await query(
        `UPDATE doctors
         SET verification_status = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [input.doctorId, input.status],
      );

      if (result.rows.length === 0) {
        throw new Error('Doctor not found');
      }

      // Log the verification action for audit trail
      await query(
        `INSERT INTO verification_audit_log (id, doctor_id, new_status, changed_by, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [uuidv4(), input.doctorId, input.status, ctx.user!.id, input.notes ?? null],
      );

      logger.info(
        { doctorId: input.doctorId, status: input.status, changedBy: ctx.user!.id },
        'Doctor verification status updated',
      );

      return mapDoctorRow(result.rows[0]);
    },
  },
};

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function mapAppointmentRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    institutionId: row.institution_id,
    scheduledAt: (row.scheduled_at as Date)?.toISOString(),
    durationMinutes: row.duration_minutes ?? 30,
    status: row.status,
    checkInCode: row.check_in_code,
    estimatedWait: row.estimated_wait,
    reason: row.reason,
    notes: row.notes,
    createdAt: (row.created_at as Date)?.toISOString(),
    updatedAt: (row.updated_at as Date)?.toISOString(),
  };
}

function mapPrescriptionRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    diagnosisCodes: row.diagnosis_codes ?? [],
    medications: row.medications ?? [],
    outcomeAssessment: row.outcome_assessment,
    efficacyScore: row.efficacy_score,
    sideEffectsReported: row.side_effects_reported ?? [],
    followUpDate: row.follow_up_date ? (row.follow_up_date as Date).toISOString() : null,
    createdAt: (row.created_at as Date)?.toISOString(),
    updatedAt: (row.updated_at as Date)?.toISOString(),
  };
}

function mapDoctorRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    licenseNumber: row.license_number,
    specialty: row.specialty,
    subspecialty: row.subspecialty,
    institutionId: row.institution_id,
    verificationStatus: row.verification_status,
    efficacyScore: row.efficacy_score,
    satisfactionScore: row.satisfaction_score,
    consultationCount: row.consultation_count ?? 0,
    region: row.region,
    languages: row.languages ?? [],
    createdAt: (row.created_at as Date)?.toISOString(),
    updatedAt: (row.updated_at as Date)?.toISOString(),
  };
}
